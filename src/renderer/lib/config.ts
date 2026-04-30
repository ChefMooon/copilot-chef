import { getPlatform, type ServerConfig } from "./platform";

let cachedConfig: ServerConfig | null = null;

export async function loadServerConfig(): Promise<ServerConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const config = await getPlatform().getServerConfig();
    cachedConfig = config;
    return config;
  } catch {
    // Fallback defaults
    cachedConfig = {
      url: "http://127.0.0.1:3001",
      token: "",
      mode: "local",
    };
    return cachedConfig;
  }
}

export function getCachedConfig(): ServerConfig | null {
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

