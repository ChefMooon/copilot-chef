import { createBrowserPlatform } from "./browser";
import { createElectronPlatform } from "./electron";
import type { RendererPlatform } from "./types";

let platform: RendererPlatform | null = null;
let electronApiRef: Window["api"] | null = null;

export function getPlatform(): RendererPlatform {
  const runtime = window.api ? "electron" : "browser";
  if (
    platform?.runtime === runtime &&
    (runtime === "browser" || electronApiRef === window.api)
  ) {
    return platform;
  }

  platform = runtime === "electron" ? createElectronPlatform() : createBrowserPlatform();
  electronApiRef = window.api ?? null;
  return platform;
}

export type {
  MenuPdfExportPayload,
  MenuPdfExportResult,
  DataArchiveOpenResult,
  DataArchiveSavePayload,
  DataArchiveSaveResult,
  LanStatus,
  LifecycleStatus,
  MachineTokenResult,
  PairingCodeResult,
  RendererPlatform,
  ServerConfig,
  ServerStatus,
  UpdateEventHandlers,
  UpdateInfo,
  UpdateProgress,
  UpdateState,
} from "./types";

export {
  clearBrowserConnection,
  getBrowserConnectionMetadata,
  getBrowserConnection,
  importBrowserConnectionFromLocation,
  markBrowserConnectionStale,
  saveBrowserConnection,
} from "./browser";
