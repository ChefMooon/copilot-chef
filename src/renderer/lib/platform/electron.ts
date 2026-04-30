import type {
  MenuPdfExportPayload,
  MenuPdfExportResult,
  MachineTokenResult,
  LanStatus,
  RendererPlatform,
  ServerConfig,
  UpdateEventHandlers,
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
      updates: true,
      lanManagement: true,
    },
    getServerConfig: async () => {
      return (await api.invoke("server:getConfig")) as ServerConfig;
    },
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
        handlers.onAvailable?.(args[0] as { version?: string } | undefined);
      };
      const notAvailable = () => handlers.onNotAvailable?.();
      const error = (...args: unknown[]) => {
        handlers.onError?.(args[0] as string | undefined);
      };

      api.on("updates:available", available);
      api.on("updates:not-available", notAvailable);
      api.on("updates:error", error);

      return () => {
        api.off("updates:available", available);
        api.off("updates:not-available", notAvailable);
        api.off("updates:error", error);
      };
    },
    checkForUpdates: () => api.invoke("updates:check"),
    exportMenuPdf: async (payload: MenuPdfExportPayload) => {
      return (await api.invoke(
        "menu:exportPdf",
        payload
      )) as MenuPdfExportResult;
    },
    getLanStatus: async () => {
      return (await api.invoke("lan:getStatus")) as LanStatus;
    },
    restartLanServices: () => api.invoke("lan:restart"),
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
  };
}