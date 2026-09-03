import { autoUpdater } from "electron-updater";
import { ipcMain, BrowserWindow } from "electron";
import type {
  UpdateCheckOrigin,
  UpdateCheckResult,
  UpdateInfo,
  UpdateProgress,
  UpdateState,
} from "../../shared/ipc";
import { getSetting, setSetting } from "../settings/store";

let updateState: UpdateState = { status: "idle" };
let configured = false;
let checkInFlight: Promise<UpdateCheckResult | null> | null = null;
let downloadInFlight: Promise<unknown> | null = null;
let currentCheckOrigin: UpdateCheckOrigin = "manual";

function formatUpdaterError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("latest.yml") && /\b404\b/.test(message)) {
    return "The latest update is temporarily unavailable because of a release issue. No action is needed; please wait for the developer to publish a fix.";
  }

  const firstLine = message.split(/\r?\n/, 1)[0]?.trim();
  if (firstLine && firstLine.length <= 240) {
    return firstLine;
  }

  return "Could not check for updates. Please try again later.";
}

function sendUpdateEvent(
  windowRef: BrowserWindow | (() => BrowserWindow | null),
  channel: string,
  payload?: unknown
): void {
  const win = typeof windowRef === "function" ? windowRef() : windowRef;
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

function normalizeVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const version = value.trim().replace(/^v/i, "");
  return version || null;
}

function isDeferredVersion(version: string | undefined): boolean {
  let stored: unknown;
  try {
    stored = getSetting("updates_deferred_version");
  } catch {
    stored = null;
  }
  const deferred = normalizeVersion(stored);
  const available = normalizeVersion(version);
  return Boolean(deferred && available && deferred === available);
}

function clearDeferredVersion(): void {
  try {
    if (getSetting("updates_deferred_version") !== null) {
      setSetting("updates_deferred_version", null);
    }
  } catch {
    // Settings may be unavailable in a test or during early startup.
  }
}

async function checkForUpdates(
  origin: UpdateCheckOrigin
): Promise<UpdateCheckResult | null> {
  if (checkInFlight) return checkInFlight;

  currentCheckOrigin = origin;
  if (origin === "manual") {
    clearDeferredVersion();
  }
  updateState = { status: "checking" };
  checkInFlight = autoUpdater
    .checkForUpdates()
    .then((result) => result as UpdateCheckResult)
    .catch((error) => {
      console.error(`[updater] ${origin} check failed:`, error);
      const message = formatUpdaterError(error);
      updateState = { status: "error", error: message };
      sendUpdateEvent(windowRefForService, "updates:error", message);
      return null;
    })
    .finally(() => {
      checkInFlight = null;
    });
  return checkInFlight;
}

let windowRefForService: BrowserWindow | (() => BrowserWindow | null);

export function setupAutoUpdater(
  windowRef: BrowserWindow | (() => BrowserWindow | null),
  options?: { checkOnStartup?: boolean }
): void {
  if (configured) return;
  configured = true;
  windowRefForService = windowRef;
  const checkOnStartup = options?.checkOnStartup ?? true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", (rawInfo) => {
    const info = rawInfo as UpdateInfo;
    if (currentCheckOrigin === "startup" && isDeferredVersion(info.version)) {
      updateState = { status: "deferred", info };
      return;
    }
    updateState = { status: "available", info };
    sendUpdateEvent(windowRef, "updates:available", info);
  });

  autoUpdater.on("update-not-available", () => {
    updateState = { status: "not-available" };
    sendUpdateEvent(windowRef, "updates:not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    updateState = {
      status: "downloading",
      info: "info" in updateState && updateState.info ? updateState.info : {},
      progress: progress as UpdateProgress,
    };
    sendUpdateEvent(windowRef, "updates:progress", progress);
  });

  autoUpdater.on("update-downloaded", (rawInfo) => {
    const info = rawInfo as UpdateInfo;
    updateState = { status: "downloaded", info };
    downloadInFlight = null;
    sendUpdateEvent(windowRef, "updates:downloaded", info);
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] error:", err);
    const message = formatUpdaterError(err);
    updateState = {
      status: "error",
      info: "info" in updateState ? updateState.info : undefined,
      progress: "progress" in updateState ? updateState.progress : undefined,
      error: message,
    };
    checkInFlight = null;
    downloadInFlight = null;
    sendUpdateEvent(windowRef, "updates:error", message);
  });

  ipcMain.handle("updates:check", (_event, origin: UpdateCheckOrigin = "manual") =>
    checkForUpdates(origin === "startup" ? "startup" : "manual")
  );

  ipcMain.handle("updates:download", async () => {
    if (downloadInFlight || updateState.status === "downloading") {
      return updateState;
    }
    if (
      updateState.status !== "available" &&
      updateState.status !== "error"
    ) {
      return updateState;
    }

    const info = "info" in updateState && updateState.info ? updateState.info : {};
    if (!info.version && updateState.status === "error") {
      return updateState;
    }
    updateState = { status: "downloading", info };
    downloadInFlight = autoUpdater
      .downloadUpdate()
      .catch((error) => {
        const message = formatUpdaterError(error);
        updateState = { status: "error", info, error: message };
        sendUpdateEvent(windowRef, "updates:error", message);
        throw error;
      })
      .finally(() => {
        downloadInFlight = null;
      });
    await downloadInFlight;
    return updateState;
  });

  ipcMain.handle("updates:get-state", () => updateState);

  ipcMain.handle("updates:install", () => {
    autoUpdater.quitAndInstall();
    clearDeferredVersion();
  });

  if (checkOnStartup) {
    void checkForUpdates("startup");
  }
}
