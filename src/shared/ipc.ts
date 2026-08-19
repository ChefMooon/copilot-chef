export const IPC_CHANNELS = [
  "server:getConfig",
  "server:getStatus",
  "lan:getStatus",
  "lan:restart",
  "app:getVersion",
  "lifecycle:getStatus",
  "lifecycle:setLaunchAtLogin",
  "window:minimize",
  "window:toggleMaximize",
  "window:isMaximized",
  "window:resetLayout",
  "window:close",
  "app:settings:get",
  "app:settings:set",
  "app:settings:getAll",
  "machine-token:metadata",
  "machine-token:reveal",
  "machine-token:generate",
  "machine-token:rotate",
  "machine-token:clear",
  "menu:exportPdf",
  "updates:check",
  "updates:is-supported",
  "updates:get-state",
  "updates:install",
] as const;

export const IPC_EVENT_CHANNELS = [
  "updates:available",
  "updates:not-available",
  "updates:progress",
  "updates:downloaded",
  "updates:error",
] as const;

export type IpcChannel = (typeof IPC_CHANNELS)[number];
export type IpcEventChannel = (typeof IPC_EVENT_CHANNELS)[number];

export type IpcInvokeMap = {
  "server:getConfig": () => Promise<{
    url: string;
    token: string;
    mode: "local" | "remote";
  }>;
  "server:getStatus": () => Promise<{
    running: boolean;
    port: number | null;
    bindHost: string | null;
    advertisedHost: string | null;
    url: string | null;
    lanEnabled: boolean;
  }>;
  "lan:getStatus": () => Promise<unknown>;
  "lan:restart": () => Promise<{ api: unknown; web: unknown }>;
  "app:getVersion": () => Promise<string>;
  "lifecycle:getStatus": () => Promise<{
    supported: boolean;
    launchAtLogin: boolean;
    launchMinimized: boolean;
    reason?: string;
  }>;
  "lifecycle:setLaunchAtLogin": (enabled: boolean) => Promise<{
    supported: boolean;
    launchAtLogin: boolean;
    launchMinimized: boolean;
    reason?: string;
  }>;
  "window:minimize": () => Promise<void>;
  "window:toggleMaximize": () => Promise<void>;
  "window:isMaximized": () => Promise<boolean>;
  "window:resetLayout": () => Promise<void>;
  "window:close": () => Promise<void>;
  "app:settings:get": (key: string) => Promise<unknown>;
  "app:settings:set": (payload: { key: string; value: unknown }) => Promise<void>;
  "app:settings:getAll": () => Promise<Record<string, unknown>>;
  "machine-token:metadata": () => Promise<unknown>;
  "machine-token:reveal": () => Promise<string | null>;
  "machine-token:generate": () => Promise<unknown>;
  "machine-token:rotate": () => Promise<unknown>;
  "machine-token:clear": () => Promise<unknown>;
  "menu:exportPdf": (payload: {
    htmlContent: string;
    suggestedFileName: string;
  }) => Promise<
    | { status: "saved"; filePath: string }
    | { status: "canceled" }
    | { status: "error"; message: string }
  >;
  "updates:check": () => Promise<unknown>;
  "updates:is-supported": () => Promise<boolean>;
  "updates:get-state": () => Promise<UpdateState>;
  "updates:install": () => Promise<unknown>;
};

export type UpdateInfo = {
  version?: string;
  releaseDate?: string;
  releaseNotes?: string | null;
};

export type UpdateProgress = {
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
};

export type UpdateState =
  | { status: "idle" | "checking" | "not-available"; info?: undefined; progress?: undefined; error?: undefined }
  | { status: "available" | "downloading" | "downloaded"; info: UpdateInfo; progress?: UpdateProgress; error?: undefined }
  | { status: "error"; info?: UpdateInfo; progress?: UpdateProgress; error: string };

export type IpcEventMap = {
  "updates:available": (info: UpdateInfo) => void;
  "updates:not-available": (...args: unknown[]) => void;
  "updates:progress": (progress: UpdateProgress) => void;
  "updates:downloaded": (info: UpdateInfo) => void;
  "updates:error": (message: string) => void;
};
