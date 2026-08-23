import { app, BrowserWindow, dialog, ipcMain, screen } from "electron";
import { basename } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type {
  DataArchiveOpenResult,
  DataArchiveSavePayload,
  DataArchiveSaveResult,
} from "../../shared/ipc";
import { getServerInfo, restartServer } from "../server/start";
import { resolveLanRuntimeSettings, probeLanReachability } from "../server/lib/lan";
import { getStaticWebInfo, restartStaticWebServer } from "../server/static-web";
import {
  clearMachineToken,
  generateMachineToken,
  getMachineTokenMetadata,
  revealMachineToken,
} from "../server/lib/machine-token";
import { getSetting, setSetting, getAllSettings } from "../settings/store";
import { createPairingCode } from "../server/lib/pairing";
import { getLifecycleStatus, setLaunchAtLogin } from "../lifecycle";
import {
  DEFAULT_WINDOW_STATE_OPTIONS,
  WINDOW_STATE_SETTING_KEY,
  resetWindowLayout,
} from "../window-state";

type MenuPdfExportPayload = {
  htmlContent: string;
  suggestedFileName: string;
};

type MenuPdfExportResult =
  | { status: "saved"; filePath: string }
  | { status: "canceled" }
  | { status: "error"; message: string };

const dataArchiveDialogFilters = [
  { name: "Local Recipe Book archives", extensions: ["lrb"] },
];

function normalizeArchiveFileName(value: string | undefined) {
  const candidate = basename(value?.trim() || "local-recipe-book-backup.lrb");
  return candidate.toLowerCase().endsWith(".lrb") ? candidate : `${candidate}.lrb`;
}

export function registerIpcHandlers(): void {
  // ── Server config ────────────────────────────────────────
  ipcMain.handle("server:getConfig", () => {
    const mode = getSetting("server_mode") ?? "local";
    if (mode === "remote") {
      return {
        url: (getSetting("remote_server_url") as string) || "http://127.0.0.1:3001",
        token: (getSetting("remote_api_key") as string) || "",
        mode: "remote" as const,
      };
    }

    const info = getServerInfo();
    return {
      url: info?.url ?? "http://127.0.0.1:3001",
      token: info?.token ?? "",
      mode: "local" as const,
    };
  });

  ipcMain.handle("server:getStatus", () => {
    const info = getServerInfo();
    return {
      running: info !== null,
      port: info?.port ?? null,
      bindHost: info?.bindHost ?? null,
      advertisedHost: info?.advertisedHost ?? null,
      url: info?.url ?? null,
      lanEnabled: info?.lanEnabled ?? false,
    };
  });

  ipcMain.handle("lan:getStatus", async () => {
    const info = getServerInfo();
    const settings = resolveLanRuntimeSettings(
      (getSetting("server_port") as number | undefined) ?? 3001
    );

    let firewallWarning = false;
    if (settings.lanEnabled && info !== null) {
      const reachable = await probeLanReachability(settings.apiAdvertisedHost, settings.apiPort);
      firewallWarning = !reachable;
    }

    return {
      api: {
        running: info !== null,
        bindHost: info?.bindHost ?? settings.apiBindHost,
        advertisedHost: info?.advertisedHost ?? settings.apiAdvertisedHost,
        url: info?.url ?? settings.apiUrl,
        port: info?.port ?? settings.apiPort,
      },
      web: {
        running: getStaticWebInfo().running,
        enabled: settings.webEnabled,
        bindHost: getStaticWebInfo().bindHost ?? settings.webBindHost,
        advertisedHost: getStaticWebInfo().advertisedHost ?? settings.webAdvertisedHost,
        url: getStaticWebInfo().url ?? settings.webUrl,
        port: getStaticWebInfo().port ?? settings.webPort,
      },
      lanEnabled: settings.lanEnabled,
      firewallWarning,
      candidates: settings.candidates,
      machineToken: getMachineTokenMetadata(),
    };
  });

  // ── App info ─────────────────────────────────────────────
  ipcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });

  ipcMain.handle("updates:is-supported", () => {
    return app.isPackaged && process.platform === "win32";
  });

  ipcMain.handle("lifecycle:getStatus", () => getLifecycleStatus());
  ipcMain.handle("lifecycle:setLaunchAtLogin", (_event, enabled: boolean) =>
    setLaunchAtLogin(enabled)
  );

  // ── Window controls ─────────────────────────────────────
  ipcMain.handle("window:minimize", () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.minimize();
  });

  ipcMain.handle("window:toggleMaximize", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
      return;
    }
    win.maximize();
  });

  ipcMain.handle("window:isMaximized", () => {
    const win = BrowserWindow.getFocusedWindow();
    return win?.isMaximized() ?? false;
  });

  ipcMain.handle("window:resetLayout", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;

    const workArea = screen.getDisplayMatching(win.getNormalBounds()).workArea;
    resetWindowLayout(win, workArea, DEFAULT_WINDOW_STATE_OPTIONS);
    setSetting(WINDOW_STATE_SETTING_KEY, null);
  });

  ipcMain.handle("window:close", () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.close();
  });

  // ── Settings ─────────────────────────────────────────────
  ipcMain.handle("app:settings:get", (_event, key: string) => {
    return getSetting(key);
  });

  ipcMain.handle("app:settings:set", async (_event, payload: { key: string; value: unknown }) => {
    setSetting(payload.key, payload.value);
    if (payload.key === "app_launch_minimized") {
      return getLifecycleStatus();
    }
    if (
      payload.key === "machine_api_key" ||
      payload.key.startsWith("lan_") ||
      payload.key === "server_port"
    ) {
      if (getSetting("server_mode") !== "remote" && getServerInfo()) {
        await restartServer();
        await restartStaticWebServer();
      }
    }
  });

  ipcMain.handle("lan:restart", async () => {
    if (getSetting("server_mode") === "remote") {
      return { api: null, web: null };
    }
    const api = await restartServer();
    const web = await restartStaticWebServer();
    return { api, web };
  });

  ipcMain.handle("app:settings:getAll", () => {
    return getAllSettings();
  });

  ipcMain.handle("machine-token:metadata", () => getMachineTokenMetadata());
  ipcMain.handle("machine-token:reveal", () => revealMachineToken());
  ipcMain.handle("machine-token:generate", async () => {
    const result = generateMachineToken();
    if (getServerInfo()) {
      await restartServer();
    }
    return result;
  });
  ipcMain.handle("machine-token:rotate", async () => {
    const result = generateMachineToken();
    if (getServerInfo()) {
      await restartServer();
    }
    return result;
  });
  ipcMain.handle("machine-token:clear", async () => {
    const result = clearMachineToken();
    if (getServerInfo()) {
      await restartServer();
    }
    return result;
  });

  ipcMain.handle("lan:pairing-code", () => {
    const token = revealMachineToken();
    if (!token) return null;
    return {
      ...createPairingCode(token),
      apiUrl: getServerInfo()?.url ?? null,
    };
  });

  // ── Menu export ──────────────────────────────────────────
  ipcMain.handle(
    "menu:exportPdf",
    async (_event, payload: MenuPdfExportPayload): Promise<MenuPdfExportResult> => {
      const htmlContent = payload?.htmlContent?.trim();
      if (!htmlContent) {
        return { status: "error", message: "Missing menu content for PDF export." };
      }

      const suggestedFileName =
        payload?.suggestedFileName?.trim().toLowerCase().endsWith(".pdf")
          ? payload.suggestedFileName.trim()
          : `${payload?.suggestedFileName?.trim() || "meal-plan-menu"}.pdf`;

      const parentWindow = BrowserWindow.getFocusedWindow() ?? null;
      const exportWindow = new BrowserWindow({
        show: false,
        width: 1200,
        height: 1600,
        webPreferences: {
          sandbox: true,
        },
      });

      try {
        await exportWindow.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
        );

        const pdfBuffer = await exportWindow.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true,
        });

        const dialogResult = await dialog.showSaveDialog(parentWindow ?? undefined, {
          title: "Save Menu PDF",
          defaultPath: suggestedFileName,
          buttonLabel: "Save PDF",
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        });

        if (dialogResult.canceled || !dialogResult.filePath) {
          return { status: "canceled" };
        }

        await writeFile(dialogResult.filePath, pdfBuffer);
        return { status: "saved", filePath: dialogResult.filePath };
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof Error ? error.message : "Unable to export menu as PDF.",
        };
      } finally {
        if (!exportWindow.isDestroyed()) {
          exportWindow.destroy();
        }
      }
    }
  );

  ipcMain.handle(
    "data-management:openArchive",
    async (): Promise<DataArchiveOpenResult> => {
      try {
        const result = await dialog.showOpenDialog(
          {
            title: "Open Local Recipe Book archive",
            buttonLabel: "Open archive",
            properties: ["openFile"],
            filters: dataArchiveDialogFilters,
          }
        );

        const filePath = result.filePaths[0];
        if (result.canceled || !filePath) {
          return { status: "canceled" };
        }

        return {
          status: "selected",
          filePath,
          data: new Uint8Array(await readFile(filePath)),
        };
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to open the data archive.",
        };
      }
    }
  );

  ipcMain.handle(
    "data-management:saveArchive",
    async (
      _event,
      payload: DataArchiveSavePayload
    ): Promise<DataArchiveSaveResult> => {
      if (!(payload?.data instanceof Uint8Array)) {
        return { status: "error", message: "Archive data is missing." };
      }

      try {
        const result = await dialog.showSaveDialog(
          {
            title: "Save Local Recipe Book archive",
            buttonLabel: "Save archive",
            defaultPath: normalizeArchiveFileName(payload.suggestedFileName),
            filters: dataArchiveDialogFilters,
          }
        );

        if (result.canceled || !result.filePath) {
          return { status: "canceled" };
        }

        await writeFile(result.filePath, Buffer.from(payload.data));
        return { status: "saved", filePath: result.filePath };
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to save the data archive.",
        };
      }
    }
  );
}
