import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";
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

type MenuPdfExportPayload = {
  htmlContent: string;
  suggestedFileName: string;
};

type MenuPdfExportResult =
  | { status: "saved"; filePath: string }
  | { status: "canceled" }
  | { status: "error"; message: string };

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

  // ── Settings ─────────────────────────────────────────────
  ipcMain.handle("app:settings:get", (_event, key: string) => {
    return getSetting(key);
  });

  ipcMain.handle("app:settings:set", async (_event, payload: { key: string; value: unknown }) => {
    setSetting(payload.key, payload.value);
    // Apply model change immediately so new sessions pick it up without a restart.
    if (payload.key === "copilot_model") {
      const model = (payload.value as string)?.trim() || "gpt-4.1";
      process.env["COPILOT_MODEL"] = model;
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
}
