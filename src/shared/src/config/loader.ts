import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { parse as parseToml } from "smol-toml";

import { ServerConfigSchema } from "./server-config";
import { ClientConfigSchema } from "./client-config";

const ENV_PREFIX = "COPILOT_CHEF_";

/** Map of env var suffixes → config paths for server config. */
const SERVER_ENV_MAP: Record<string, string[]> = {
  SERVER_PORT: ["server", "port"],
  SERVER_HOST: ["server", "host"],
  SERVER_LOG_LEVEL: ["server", "logLevel"],
  DATABASE_URL: ["database", "url"],
  AUTH_TOKENS: ["auth", "tokens"],
  COPILOT_MODEL: ["auth", "copilotModel"],
  UPDATES_FEED_URL: ["updates", "feedUrl"],
  UPDATES_CHECK_ON_STARTUP: ["updates", "checkOnStartup"],
  CORS_ORIGINS: ["cors", "origins"],
};

/** Map of env var suffixes → config paths for client config. */
const CLIENT_ENV_MAP: Record<string, string[]> = {
  CLIENT_SERVER_URL: ["connection", "serverUrl"],
  CLIENT_API_KEY: ["connection", "apiKey"],
  CLIENT_AUTO_LAUNCH_SERVER: ["connection", "autoLaunchServer"],
  CLIENT_SERVER_BINARY_PATH: ["connection", "serverBinaryPath"],
  CLIENT_UPDATES_CHECK_ON_STARTUP: ["updates", "checkOnStartup"],
  CLIENT_UI_THEME: ["ui", "theme"],
};

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Recursively converts all snake_case keys to camelCase. */
function camelCaseKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(camelCaseKeys);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamel(key)] = camelCaseKeys(value);
    }
    return result;
  }
  return obj;
}

function findConfigFile(
  filename: string,
  explicitPath?: string
): string | undefined {
  if (explicitPath) {
    return fs.existsSync(explicitPath) ? explicitPath : undefined;
  }
  const candidates = [
    path.join(process.cwd(), filename),
    path.join(os.homedir(), ".config", "copilot-chef", filename),
    path.join(os.homedir(), filename),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function readTomlFile(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(filePath, "utf-8");
  const raw = parseToml(content);
  return camelCaseKeys(raw) as Record<string, unknown>;
}

function coerceValue(value: string, configPath: string[]): unknown {
  const key = configPath[configPath.length - 1];

  // Comma-separated arrays
  if (key === "tokens" || key === "origins") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Booleans
  if (key === "checkOnStartup" || key === "autoLaunchServer") {
    return value === "true" || value === "1";
  }

  // Numbers
  if (key === "port") {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? value : parsed;
  }

  return value;
}

function applyEnvOverrides(
  config: Record<string, unknown>,
  envMap: Record<string, string[]>
): void {
  for (const [suffix, configPath] of Object.entries(envMap)) {
    const envValue = process.env[`${ENV_PREFIX}${suffix}`];
    if (envValue === undefined) continue;

    let target = config;
    for (let i = 0; i < configPath.length - 1; i++) {
      const key = configPath[i];
      if (
        target[key] === undefined ||
        typeof target[key] !== "object"
      ) {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }
    target[configPath[configPath.length - 1]] = coerceValue(
      envValue,
      configPath
    );
  }

  // Backward compat: bare DATABASE_URL maps to database.url
  if (
    process.env.DATABASE_URL &&
    !process.env[`${ENV_PREFIX}DATABASE_URL`]
  ) {
    if (!config.database || typeof config.database !== "object") {
      config.database = {};
    }
    const db = config.database as Record<string, unknown>;
    if (db.url === undefined) {
      db.url = process.env.DATABASE_URL;
    }
  }
}

export function loadServerConfig(configPath?: string) {
  const filePath = findConfigFile("copilot-chef-server.toml", configPath);
  let raw: Record<string, unknown> = {};
  if (filePath) {
    raw = readTomlFile(filePath);
  }
  applyEnvOverrides(raw, SERVER_ENV_MAP);
  return ServerConfigSchema.parse(raw);
}

export function loadClientConfig(configPath?: string) {
  const filePath = findConfigFile("copilot-chef-client.toml", configPath);
  let raw: Record<string, unknown> = {};
  if (filePath) {
    raw = readTomlFile(filePath);
  }
  applyEnvOverrides(raw, CLIENT_ENV_MAP);
  return ClientConfigSchema.parse(raw);
}
