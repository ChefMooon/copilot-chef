import { getPlatform, type ServerConfig } from "./platform";

let cachedConfig: ServerConfig | null = null;

const CONFIG_UPDATED_EVENT = "copilot-chef:config-updated";

export class ConfigNotReadyError extends Error {
  constructor(message = "Server configuration is not ready") {
    super(message);
    this.name = "ConfigNotReadyError";
  }
}

function emitConfigUpdated(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CONFIG_UPDATED_EVENT));
}

export function subscribeConfigUpdates(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(CONFIG_UPDATED_EVENT, listener);
  return () => {
    window.removeEventListener(CONFIG_UPDATED_EVENT, listener);
  };
}

export function isServerConfigReady(config: ServerConfig | null): boolean {
  if (!config) {
    return false;
  }

  const urlReady = Boolean(config.url.trim());
  if (!urlReady) {
    return false;
  }

  const runtime = getPlatform().runtime;
  if (runtime === "browser" || config.mode === "remote") {
    return Boolean(config.token.trim());
  }

  return true;
}

export function assertServerConfigReady(
  config: ServerConfig | null,
  message?: string
): asserts config is ServerConfig {
  if (!isServerConfigReady(config)) {
    throw new ConfigNotReadyError(message);
  }
}

export async function loadServerConfig(): Promise<ServerConfig> {
  if (isServerConfigReady(cachedConfig)) {
    return cachedConfig;
  }

  const config = await getPlatform().getServerConfig();
  assertServerConfigReady(config);

  if (
    !cachedConfig ||
    cachedConfig.url !== config.url ||
    cachedConfig.token !== config.token ||
    cachedConfig.mode !== config.mode
  ) {
    cachedConfig = config;
    emitConfigUpdated();
    return config;
  }

  cachedConfig = config;
  return config;
}

export function getCachedConfig(): ServerConfig | null {
  return cachedConfig;
}

export function resetConfigCache(): void {
  if (!cachedConfig) {
    return;
  }

  cachedConfig = null;
  emitConfigUpdated();
}

export function setCachedConfigForTests(config: ServerConfig | null): void {
  cachedConfig = config;
}

