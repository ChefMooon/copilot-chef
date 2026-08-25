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
  onAvailable?: (info: UpdateInfo) => void;
  onNotAvailable?: () => void;
  onProgress?: (progress: UpdateProgress) => void;
  onDownloaded?: (info: UpdateInfo) => void;
  onError?: (message: string) => void;
};

import type {
  DataArchiveOpenResult,
  DataArchiveSavePayload,
  DataArchiveSaveResult,
  UpdateInfo,
  UpdateProgress,
  UpdateState,
} from "../../../shared/ipc";

export type {
  DataArchiveOpenResult,
  DataArchiveSavePayload,
  DataArchiveSaveResult,
  UpdateInfo,
  UpdateProgress,
  UpdateState,
} from "../../../shared/ipc";

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
  dataManagement: boolean;
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

export type PairingCodeResult = {
  code: string;
  expiresAt: string;
  apiUrl: string | null;
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
  getUpdatesSupported: () => Promise<boolean>;
  checkForUpdates: () => Promise<unknown>;
  getUpdateState: () => Promise<UpdateState>;
  installUpdate: () => Promise<unknown>;
  getLifecycleStatus: () => Promise<LifecycleStatus>;
  setLaunchAtLogin: (enabled: boolean) => Promise<LifecycleStatus>;
  exportMenuPdf: (payload: MenuPdfExportPayload) => Promise<MenuPdfExportResult>;
  openDataArchive: () => Promise<DataArchiveOpenResult>;
  saveDataArchive: (
    payload: DataArchiveSavePayload
  ) => Promise<DataArchiveSaveResult>;
  subscribeShutdown: (listener: () => void) => () => void;
  getLanStatus: () => Promise<LanStatus | null>;
  restartLanServices: () => Promise<unknown>;
  createLanPairingCode: () => Promise<PairingCodeResult | null>;
  createBrowserPairingCode: () => Promise<PairingCodeResult | null>;
  redeemBrowserPairingCode: (
    apiUrl: string,
    code: string
  ) => Promise<BrowserConnection>;
  revealMachineToken: () => Promise<string | null>;
  generateMachineToken: () => Promise<MachineTokenResult>;
  rotateMachineToken: () => Promise<MachineTokenResult>;
  clearMachineToken: () => Promise<LanStatus["machineToken"] | null>;
  minimizeWindow?: () => Promise<void>;
  toggleMaximizeWindow?: () => Promise<void>;
  isWindowMaximized?: () => Promise<boolean>;
  resetWindowLayout?: () => Promise<void>;
  closeWindow?: () => Promise<void>;
};

export type BrowserConnection = {
  apiUrl: string;
  token: string;
};