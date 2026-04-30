import type {
  MenuPdfExportPayload,
  MenuPdfExportResult,
  RendererPlatform,
  ServerConfig,
} from "./types";

const API_URL_KEY = "copilot-chef.browser.api-url";
const API_TOKEN_KEY = "copilot-chef.browser.api-token";
const SETTING_PREFIX = "copilot-chef.browser.setting.";

export type BrowserConnection = {
  apiUrl: string;
  token: string;
};

type BrowserRuntimeConfig = {
  apiUrl: string | null;
  webUrl: string | null;
  version?: string;
};

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeApiUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getBrowserConnection(): BrowserConnection | null {
  const storage = getStorage();
  if (!storage) return null;

  const apiUrl = normalizeApiUrl(storage.getItem(API_URL_KEY) ?? "");
  const token = storage.getItem(API_TOKEN_KEY) ?? "";

  if (!apiUrl || !token) return null;
  return { apiUrl, token };
}

export function saveBrowserConnection(connection: BrowserConnection): void {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(API_URL_KEY, normalizeApiUrl(connection.apiUrl));
  storage.setItem(API_TOKEN_KEY, connection.token.trim());
}

export function clearBrowserConnection(): void {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(API_URL_KEY);
  storage.removeItem(API_TOKEN_KEY);
}

export function importBrowserConnectionFromLocation(): BrowserConnection | null {
  // With createBrowserRouter, path is in window.location.pathname (/connect)
  // and the token payload is in the URL fragment: /connect#api=...&token=...
  const fragment = window.location.hash.replace(/^#/, "");
  if (!fragment) return null;

  const params = new URLSearchParams(fragment);
  const apiUrl = normalizeApiUrl(params.get("api") ?? "");
  const token = params.get("token")?.trim() ?? "";
  if (!apiUrl || !token) return null;

  const connection = { apiUrl, token };
  saveBrowserConnection(connection);
  // Strip the fragment so the token is no longer visible in the address bar
  window.history.replaceState(null, "", window.location.pathname);
  return connection;
}

async function getBrowserRuntimeConfig(): Promise<BrowserRuntimeConfig | null> {
  try {
    const response = await fetch("/runtime-config.json", {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Partial<BrowserRuntimeConfig>;
    const apiUrl =
      typeof payload.apiUrl === "string" && payload.apiUrl.trim()
        ? normalizeApiUrl(payload.apiUrl)
        : null;
    const webUrl =
      typeof payload.webUrl === "string" && payload.webUrl.trim()
        ? payload.webUrl.trim()
        : null;

    return {
      apiUrl,
      webUrl,
      version: typeof payload.version === "string" ? payload.version : undefined,
    };
  } catch {
    return null;
  }
}

async function resolveBrowserServerConfig(): Promise<ServerConfig> {
  const imported = importBrowserConnectionFromLocation();
  if (imported) {
    return {
      url: imported.apiUrl,
      token: imported.token,
      mode: "local",
    };
  }

  const [runtimeConfig, savedConnection] = await Promise.all([
    getBrowserRuntimeConfig(),
    Promise.resolve(getBrowserConnection()),
  ]);

  const url = runtimeConfig?.apiUrl ?? savedConnection?.apiUrl ?? "";
  const token = savedConnection?.token ?? "";

  if (
    runtimeConfig?.apiUrl &&
    token &&
    savedConnection?.apiUrl !== runtimeConfig.apiUrl
  ) {
    saveBrowserConnection({
      apiUrl: runtimeConfig.apiUrl,
      token,
    });
  }

  return {
    url,
    token,
    mode: "local",
  };
}

function getSettingStorageKey(key: string): string {
  return `${SETTING_PREFIX}${key}`;
}

export function createBrowserPlatform(): RendererPlatform {
  return {
    runtime: "browser",
    capabilities: {
      pdfExport: false,
      updates: false,
      lanManagement: false,
    },
    getServerConfig: resolveBrowserServerConfig,
    getSetting: async (key) => {
      const storage = getStorage();
      if (!storage) return undefined;

      const raw = storage.getItem(getSettingStorageKey(key));
      if (raw === null) return undefined;

      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return raw;
      }
    },
    setSetting: async (key, value) => {
      const storage = getStorage();
      if (!storage) return;

      storage.setItem(getSettingStorageKey(key), JSON.stringify(value));
    },
    getAllSettings: async () => {
      const storage = getStorage();
      const all: Record<string, unknown> = {};
      if (!storage) return all;

      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (!key?.startsWith(SETTING_PREFIX)) continue;
        const settingKey = key.slice(SETTING_PREFIX.length);
        const raw = storage.getItem(key);
        if (raw === null) continue;
        try {
          all[settingKey] = JSON.parse(raw) as unknown;
        } catch {
          all[settingKey] = raw;
        }
      }
      return all;
    },
    subscribeUpdates: () => () => {},
    checkForUpdates: async () => null,
    exportMenuPdf: async (_payload: MenuPdfExportPayload): Promise<MenuPdfExportResult> => {
      return {
        status: "error",
        message: "PDF export is available in the desktop app.",
      };
    },
    getLanStatus: async () => null,
    restartLanServices: async () => null,
    revealMachineToken: async () => null,
    generateMachineToken: async () => {
      throw new Error("Machine token management is available in the desktop app.");
    },
    rotateMachineToken: async () => {
      throw new Error("Machine token management is available in the desktop app.");
    },
    clearMachineToken: async () => null,
  };
}