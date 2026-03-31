import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

import { bootstrapDatabase } from "./lib/bootstrap";
import { createApp } from "./app";
import { getSetting } from "../settings/store";
import type { ServerConfig } from "@shared/config/server-config";

// ── State ────────────────────────────────────────────────────
let httpServer: ServerType | null = null;
let serverToken: string | null = null;
let serverPort: number | null = null;

export interface ServerInfo {
  url: string;
  token: string;
  port: number;
}

// ── Helpers ──────────────────────────────────────────────────
function resolveDbPath(): string {
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
            url: `http://localhost:${info.port}`,
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

  // Compute DB path and set env
  const dbUrl = resolveDbPath();
  process.env["COPILOT_CHEF_DATABASE_URL"] = dbUrl;

  // Set Copilot model
  const copilotModel =
    (getSetting("copilot_model") as string) || "gpt-4o-mini";
  process.env["COPILOT_MODEL"] = copilotModel;

  // Bootstrap database
  await bootstrapDatabase();

  // Build server config (no TOML file — constructed from settings)
  const port = (getSetting("server_port") as number) || 3001;
  const config: ServerConfig = {
    server: {
      port,
      host: "127.0.0.1",
      logLevel: "info",
    },
    database: {
      url: dbUrl,
    },
    auth: {
      tokens: [serverToken],
      copilotModel,
    },
    updates: {
      feedUrl: "",
      checkOnStartup: false,
    },
    cors: {
      origins: ["http://localhost:5173", "app://localhost"],
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
    url: `http://localhost:${serverPort}`,
    token: serverToken,
    port: serverPort,
  };
}
