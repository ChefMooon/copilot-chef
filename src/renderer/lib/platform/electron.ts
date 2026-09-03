import type {
  MenuPdfExportPayload,
  MenuPdfExportResult,
  DataArchiveOpenResult,
  DataArchiveSavePayload,
  DataArchiveSaveResult,
  MachineTokenResult,
  LanStatus,
  LifecycleStatus,
  RendererPlatform,
  ServerConfig,
  ServerStatus,
  UpdateEventHandlers,
  UpdateInfo,
  UpdateProgress,
  PairingCodeResult,
  BrowserConnection,
} from "./types";

export function createElectronPlatform(): RendererPlatform {
  const api = window.api;
  if (!api) {
    throw new Error("Electron IPC bridge is unavailable.");
  }

  return {
    runtime: "electron",
    capabilities: {
      pdfExport: true,
      dataManagement: true,
      updates: true,
      lanManagement: true,
      lifecycle: true,
    },
    getServerConfig: async () => {
      return (await api.invoke("server:getConfig")) as ServerConfig;
    },
    getServerStatus: async () => {
      return (await api.invoke("server:getStatus")) as ServerStatus;
    },
    getAppVersion: () => api.invoke("app:getVersion"),
    getSetting: (key) => api.invoke("app:settings:get", key),
    setSetting: async (key, value) => {
      await api.invoke("app:settings:set", { key, value });
    },
    getAllSettings: async () => {
      return (await api.invoke("app:settings:getAll")) as Record<
        string,
        unknown
      >;
    },
    subscribeUpdates: (handlers: UpdateEventHandlers) => {
      const available = (...args: unknown[]) => {
        handlers.onAvailable?.(args[0] as UpdateInfo);
      };
      const notAvailable = () => handlers.onNotAvailable?.();
      const progress = (...args: unknown[]) => handlers.onProgress?.(args[0] as UpdateProgress);
      const downloaded = (...args: unknown[]) => handlers.onDownloaded?.(args[0] as UpdateInfo);
      const error = (...args: unknown[]) => {
        handlers.onError?.(args[0] as string);
      };

      api.on("updates:available", available);
      api.on("updates:not-available", notAvailable);
      api.on("updates:progress", progress);
      api.on("updates:downloaded", downloaded);
      api.on("updates:error", error);

      return () => {
        api.off("updates:available", available);
        api.off("updates:not-available", notAvailable);
        api.off("updates:progress", progress);
        api.off("updates:downloaded", downloaded);
        api.off("updates:error", error);
      };
    },
    getUpdatesSupported: () => api.invoke("updates:is-supported"),
    checkForUpdates: () => api.invoke("updates:check", "manual"),
    downloadUpdate: () => api.invoke("updates:download"),
    getUpdateState: () => api.invoke("updates:get-state"),
    installUpdate: () => api.invoke("updates:install"),
    getLifecycleStatus: async () => {
      return (await api.invoke("lifecycle:getStatus")) as LifecycleStatus;
    },
    setLaunchAtLogin: async (enabled) => {
      return (await api.invoke("lifecycle:setLaunchAtLogin", enabled)) as LifecycleStatus;
    },
    exportMenuPdf: async (payload: MenuPdfExportPayload) => {
      return (await api.invoke(
        "menu:exportPdf",
        payload
      )) as MenuPdfExportResult;
    },
    openDataArchive: async () => {
      return (await api.openDataArchive()) as DataArchiveOpenResult;
    },
    saveDataArchive: async (payload: DataArchiveSavePayload) => {
      return (await api.saveDataArchive(payload)) as DataArchiveSaveResult;
    },
    subscribeShutdown: (listener) => {
      api.on("app:shutdown", listener);
      return () => api.off("app:shutdown", listener);
    },
    getLanStatus: async () => {
      return (await api.invoke("lan:getStatus")) as LanStatus;
    },
    restartLanServices: () => api.invoke("lan:restart"),
    createLanPairingCode: async () => {
      return (await api.invoke("lan:pairing-code")) as PairingCodeResult | null;
    },
    createBrowserPairingCode: async () => null,
    redeemBrowserPairingCode: async (apiUrl: string, code: string): Promise<BrowserConnection> => {
      const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/pairing/redeem`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!response.ok) throw new Error("Invalid or expired pairing code.");
      const payload = (await response.json()) as { token?: unknown };
      if (typeof payload.token !== "string" || !payload.token.trim()) {
        throw new Error("The pairing response was invalid.");
      }
      return { apiUrl: apiUrl.replace(/\/+$/, ""), token: payload.token };
    },
    revealMachineToken: async () => {
      return (await api.invoke("machine-token:reveal")) as string | null;
    },
    generateMachineToken: async () => {
      return (await api.invoke("machine-token:generate")) as MachineTokenResult;
    },
    rotateMachineToken: async () => {
      return (await api.invoke("machine-token:rotate")) as MachineTokenResult;
    },
    clearMachineToken: async () => {
      return (await api.invoke("machine-token:clear")) as LanStatus["machineToken"];
    },
    minimizeWindow: async () => {
      await api.minimizeWindow();
    },
    toggleMaximizeWindow: async () => {
      await api.toggleMaximizeWindow();
    },
    isWindowMaximized: async () => {
      return api.isWindowMaximized();
    },
    resetWindowLayout: async () => {
      await api.resetWindowLayout();
    },
    closeWindow: async () => {
      await api.closeWindow();
    },
  };
}