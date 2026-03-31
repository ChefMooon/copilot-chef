type ServerConfig = {
  url: string;
  token: string;
  mode: "local" | "remote";
};

let cachedConfig: ServerConfig | null = null;

export async function loadServerConfig(): Promise<ServerConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const config = (await window.api.invoke("server:getConfig")) as ServerConfig;
    cachedConfig = config;
    return config;
  } catch {
    // Fallback defaults
    cachedConfig = {
      url: "http://localhost:3001",
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

