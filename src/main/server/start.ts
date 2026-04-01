import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

import { bootstrapDatabase } from "./lib/bootstrap";
import { createApp } from "./app";
import { getSetting } from "../settings/store";
import type { ServerConfig } from "@shared/config/server-config";

const LOCAL_SERVER_HOST = "127.0.0.1";

// ── State ────────────────────────────────────────────────────
let httpServer: ServerType | null = null;
let serverToken: string | null = null;
let serverPort: number | null = null;

export interface ServerInfo {
  url: string;
  token: string;
  port: number;
}

function readEnvOverrideFromFile(key: string): string | undefined {
  if (app.isPackaged) return undefined;

  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return undefined;

  try {
    const raw = readFileSync(envPath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;

      const entryKey = trimmed.slice(0, separator).trim();
      if (entryKey !== key) continue;

      const rawValue = trimmed.slice(separator + 1).trim();
      const unquoted =
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
          ? rawValue.slice(1, -1)
          : rawValue;

      return unquoted || undefined;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

// ── Helpers ──────────────────────────────────────────────────
function resolveDbPath(): string {
  const dbOverride =
    process.env["COPILOT_CHEF_DATABASE_URL"] ??
    readEnvOverrideFromFile("COPILOT_CHEF_DATABASE_URL");
  if (dbOverride) {
    return dbOverride;
  }

  const userDataPath = app.getPath("userData");
  const dataDir = join(userDataPath, "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return `file:${join(dataDir, "copilot-chef.db")}`;
}

function tryPort(config: ServerConfig, port: number): Promise<ServerInfo> {
  return new Promise((resolve, reject) => {
    try {
      const honoApp = createApp(config);
      const server = serve(
        {
          fetch: honoApp.fetch,
          port,
          hostname: config.server.host,
        },
        (info) => {
          httpServer = server;
          serverPort = info.port;
          resolve({
            url: `http://${LOCAL_SERVER_HOST}:${info.port}`,
            token: serverToken!,
            port: info.port,
          });
        }
      );

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          reject(new Error(`Port ${port} in use`));
        } else {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ── Public API ───────────────────────────────────────────────
export async function startServer(): Promise<ServerInfo> {
  // Generate random auth token for this session
  serverToken = randomBytes(32).toString("hex");

  // Allow dev-only .env override for seed toggle.
  const seedOverride =
    process.env["COPILOT_CHEF_SEED_DATABASE"] ??
    readEnvOverrideFromFile("COPILOT_CHEF_SEED_DATABASE");
  if (seedOverride !== undefined) {
    process.env["COPILOT_CHEF_SEED_DATABASE"] = seedOverride;
  } else if (app.isPackaged) {
    // Production default: never seed sample data unless explicitly requested.
    process.env["COPILOT_CHEF_SEED_DATABASE"] = "false";
  }

  // Compute DB path and set env
  const dbUrl = resolveDbPath();
  process.env["COPILOT_CHEF_DATABASE_URL"] = dbUrl;

  // Set Copilot model — always derive from settings store so a .env value
  // (which electron-vite may inject) cannot shadow the user's saved preference.
  delete process.env["COPILOT_MODEL"];
  const copilotModel =
    (getSetting("copilot_model") as string) || "gpt-4.1";
  process.env["COPILOT_MODEL"] = copilotModel;

  // Bootstrap database
  await bootstrapDatabase();

  // Build server config (no TOML file — constructed from settings)
  const port = (getSetting("server_port") as number) || 3001;
  const config: ServerConfig = {
    server: {
      port,
      host: LOCAL_SERVER_HOST,
      logLevel: "info",
    },
    database: {
      url: dbUrl,
    },
    auth: {
      tokens: [serverToken, getSetting("machine_api_key") as string].filter(Boolean),
      copilotModel,
    },
    updates: {
      feedUrl: "",
      checkOnStartup: false,
    },
    cors: {
      // Packaged Electron renderer requests can send Origin: null (file://)
      origins: ["http://localhost:5173", "app://localhost", "null"],
    },
  };

  // Try configured port, then fallbacks
  const portsToTry = [port, port + 1, port + 2, 0];
  for (const p of portsToTry) {
    try {
      return await tryPort(config, p);
    } catch {
      if (p === 0) throw new Error("Could not bind to any port");
      console.warn(`[copilot-chef] port ${p} unavailable, trying next…`);
    }
  }

  throw new Error("Could not start server: all ports exhausted");
}

export async function stopServer(): Promise<void> {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
    serverPort = null;
  }
}

export function getServerInfo(): ServerInfo | null {
  if (!serverPort || !serverToken) return null;
  return {
    url: `http://${LOCAL_SERVER_HOST}:${serverPort}`,
    token: serverToken,
    port: serverPort,
  };
}
