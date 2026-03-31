import {
  BaseDirectory,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";

import { type ClientConfig, ClientConfigSchema } from "@copilot-chef/shared";

const CONFIG_FILE = "copilot-chef-client.toml";
const BASE_DIR = BaseDirectory.AppData;

let cachedConfig: ClientConfig | null = null;

export async function loadClientConfig(): Promise<ClientConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const raw = await readTextFile(CONFIG_FILE, { baseDir: BASE_DIR });
    // TOML is subset of JSON for simple key-value structures, but we need a real parser.
    // @copilot-chef/shared ships smol-toml; import dynamically to keep bundle small.
    const { parse } = await import("smol-toml");
    const parsed = parse(raw);
    cachedConfig = ClientConfigSchema.parse(parsed);
    return cachedConfig;
  } catch {
    // File not found or parse error — return defaults
    cachedConfig = ClientConfigSchema.parse({});
    return cachedConfig;
  }
}

export async function saveClientConfig(config: ClientConfig): Promise<void> {
  cachedConfig = config;

  const lines: string[] = [];

  lines.push("[connection]");
  lines.push(`serverUrl = "${config.connection.serverUrl}"`);
  lines.push(`apiKey = "${config.connection.apiKey}"`);
  lines.push(`autoLaunchServer = ${config.connection.autoLaunchServer}`);
  lines.push(`serverBinaryPath = "${config.connection.serverBinaryPath}"`);
  lines.push("");
  lines.push("[updates]");
  lines.push(`checkOnStartup = ${config.updates.checkOnStartup}`);
  lines.push("");
  lines.push("[ui]");
  lines.push(`theme = "${config.ui.theme}"`);

  await writeTextFile(CONFIG_FILE, lines.join("\n"), { baseDir: BASE_DIR });
}

export function getCachedConfig(): ClientConfig | null {
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
