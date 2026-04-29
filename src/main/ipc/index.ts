import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";
import { getServerInfo } from "../server/start";
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
    return { running: info !== null, port: info?.port ?? null };
  });

  // ── App info ─────────────────────────────────────────────
  ipcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });

  // ── Settings ─────────────────────────────────────────────
  ipcMain.handle("app:settings:get", (_event, key: string) => {
    return getSetting(key);
  });

  ipcMain.handle("app:settings:set", (_event, payload: { key: string; value: unknown }) => {
    setSetting(payload.key, payload.value);
    // Apply model change immediately so new sessions pick it up without a restart.
    if (payload.key === "copilot_model") {
      const model = (payload.value as string)?.trim() || "gpt-4.1";
      process.env["COPILOT_MODEL"] = model;
    }
  });

  ipcMain.handle("app:settings:getAll", () => {
    return getAllSettings();
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
