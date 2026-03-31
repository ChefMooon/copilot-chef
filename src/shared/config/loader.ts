import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { parse as parseToml } from "smol-toml";

import { ServerConfigSchema } from "./server-config";
import { ClientConfigSchema } from "./client-config";

/** Map of env var names → config paths for server config. */
const SERVER_ENV_MAP: Record<string, string[]> = {
  COPILOT_CHEF_SERVER_PORT: ["server", "port"],
  COPILOT_CHEF_SERVER_HOST: ["server", "host"],
  COPILOT_CHEF_SERVER_LOG_LEVEL: ["server", "logLevel"],
  COPILOT_CHEF_DATABASE_URL: ["database", "url"],
  COPILOT_CHEF_AUTH_TOKENS: ["auth", "tokens"],
  COPILOT_CHEF_COPILOT_MODEL: ["auth", "copilotModel"],
  COPILOT_CHEF_UPDATES_FEED_URL: ["updates", "feedUrl"],
  COPILOT_CHEF_UPDATES_CHECK_ON_STARTUP: ["updates", "checkOnStartup"],
  COPILOT_CHEF_CORS_ORIGINS: ["cors", "origins"],
};

/** Map of env var names → config paths for client config. */
const CLIENT_ENV_MAP: Record<string, string[]> = {
  COPILOT_CHEF_CLIENT_SERVER_URL: ["connection", "serverUrl"],
  COPILOT_CHEF_CLIENT_API_KEY: ["connection", "apiKey"],
  COPILOT_CHEF_CLIENT_AUTO_LAUNCH_SERVER: ["connection", "autoLaunchServer"],
  COPILOT_CHEF_CLIENT_SERVER_BINARY_PATH: ["connection", "serverBinaryPath"],
  COPILOT_CHEF_CLIENT_UPDATES_CHECK_ON_STARTUP: ["updates", "checkOnStartup"],
  COPILOT_CHEF_CLIENT_UI_THEME: ["ui", "theme"],
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
  for (const [envName, configPath] of Object.entries(envMap)) {
    const envValue = process.env[envName];
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
