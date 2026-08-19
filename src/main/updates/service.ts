import { autoUpdater } from "electron-updater";
import { ipcMain, BrowserWindow } from "electron";
import type { UpdateInfo, UpdateProgress, UpdateState } from "../../shared/ipc";

let updateState: UpdateState = { status: "idle" };
let configured = false;

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

export function setupAutoUpdater(
  windowRef: BrowserWindow | (() => BrowserWindow | null),
  options?: { checkOnStartup?: boolean }
): void {
  if (configured) return;
  configured = true;
  const checkOnStartup = options?.checkOnStartup ?? true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    updateState = { status: "available", info: info as UpdateInfo };
    sendUpdateEvent(windowRef, "updates:available", info);
  });

  autoUpdater.on("update-not-available", () => {
    updateState = { status: "not-available" };
    sendUpdateEvent(windowRef, "updates:not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    updateState = {
      status: "downloading",
      info: updateState.info ?? {},
      progress: progress as UpdateProgress,
    };
    sendUpdateEvent(windowRef, "updates:progress", progress);
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateState = { status: "downloaded", info: info as UpdateInfo };
    sendUpdateEvent(windowRef, "updates:downloaded", info);
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] error:", err.message);
    updateState = { ...updateState, status: "error", error: err.message };
    sendUpdateEvent(windowRef, "updates:error", err.message);
  });

  ipcMain.handle("updates:check", async () => {
    updateState = { status: "checking" };
    try {
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      console.error("[updater] check failed:", err);
      return null;
    }
  });

  ipcMain.handle("updates:get-state", () => updateState);

  ipcMain.handle("updates:install", () => {
    autoUpdater.quitAndInstall();
  });

  if (checkOnStartup) {
    updateState = { status: "checking" };
    void autoUpdater.checkForUpdates().catch((err) => {
      console.error("[updater] startup check failed:", err);
      updateState = { status: "error", error: err instanceof Error ? err.message : "Update check failed." };
    });
  }
}
