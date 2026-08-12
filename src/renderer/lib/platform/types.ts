export type RuntimeMode = "electron" | "browser";

export type ServerConfig = {
  url: string;
  token: string;
  mode: "local" | "remote";
};

export type ServerStatus = {
  running: boolean;
  port: number | null;
  bindHost: string | null;
  advertisedHost: string | null;
  url: string | null;
  lanEnabled: boolean;
};

export type UpdateEventHandlers = {
  onAvailable?: (info?: { version?: string }) => void;
  onNotAvailable?: () => void;
  onError?: (message?: string) => void;
};

export type MenuPdfExportPayload = {
  htmlContent: string;
  suggestedFileName: string;
};

export type MenuPdfExportResult =
  | { status: "saved"; filePath: string }
  | { status: "canceled" }
  | { status: "error"; message: string };

export type PlatformCapabilities = {
  pdfExport: boolean;
  updates: boolean;
  lanManagement: boolean;
  lifecycle: boolean;
};

export type LifecycleStatus = {
  supported: boolean;
  launchAtLogin: boolean;
  launchMinimized: boolean;
  reason?: string;
};

export type LanStatus = {
  api: {
    running: boolean;
    bindHost: string;
    advertisedHost: string;
    url: string;
    port: number;
  };
  web: {
    running: boolean;
    enabled: boolean;
    bindHost: string;
    advertisedHost: string;
    url: string;
    port: number;
  };
  lanEnabled: boolean;
  firewallWarning: boolean;
  candidates: Array<{ name: string; address: string }>;
  machineToken: {
    configured: boolean;
    updatedAt: string | null;
  };
};

export type MachineTokenResult = {
  token: string;
  metadata: LanStatus["machineToken"];
};

export type RendererPlatform = {
  runtime: RuntimeMode;
  capabilities: PlatformCapabilities;
  getServerConfig: () => Promise<ServerConfig>;
  getServerStatus: () => Promise<ServerStatus>;
  getAppVersion: () => Promise<string>;
  getSetting: (key: string) => Promise<unknown>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  getAllSettings: () => Promise<Record<string, unknown>>;
  subscribeUpdates: (handlers: UpdateEventHandlers) => () => void;
  checkForUpdates: () => Promise<unknown>;
  getLifecycleStatus: () => Promise<LifecycleStatus>;
  setLaunchAtLogin: (enabled: boolean) => Promise<LifecycleStatus>;
  exportMenuPdf: (payload: MenuPdfExportPayload) => Promise<MenuPdfExportResult>;
  getLanStatus: () => Promise<LanStatus | null>;
  restartLanServices: () => Promise<unknown>;
  revealMachineToken: () => Promise<string | null>;
  generateMachineToken: () => Promise<MachineTokenResult>;
  rotateMachineToken: () => Promise<MachineTokenResult>;
  clearMachineToken: () => Promise<LanStatus["machineToken"] | null>;
  minimizeWindow?: () => Promise<void>;
  toggleMaximizeWindow?: () => Promise<void>;
  isWindowMaximized?: () => Promise<boolean>;
  closeWindow?: () => Promise<void>;
};