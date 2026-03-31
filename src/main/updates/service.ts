import { autoUpdater } from "electron-updater";
import { ipcMain, BrowserWindow } from "electron";

export function setupAutoUpdater(
  win: BrowserWindow,
  options?: { checkOnStartup?: boolean }
): void {
  const checkOnStartup = options?.checkOnStartup ?? true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    win.webContents.send("updates:available", info);
  });

  autoUpdater.on("update-not-available", () => {
    win.webContents.send("updates:not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    win.webContents.send("updates:progress", progress);
  });

  autoUpdater.on("update-downloaded", (info) => {
    win.webContents.send("updates:downloaded", info);
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] error:", err.message);
    win.webContents.send("updates:error", err.message);
  });

  ipcMain.handle("updates:check", async () => {
    try {
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      console.error("[updater] check failed:", err);
      return null;
    }
  });

  ipcMain.handle("updates:install", () => {
    autoUpdater.quitAndInstall();
  });

  if (checkOnStartup) {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.error("[updater] startup check failed:", err);
    });
  }
}
