import { ipcMain, app } from "electron";
import { getServerInfo } from "../server/start";
import { getSetting, setSetting, getAllSettings } from "../settings/store";

export function registerIpcHandlers(): void {
  // ── Server config ────────────────────────────────────────
  ipcMain.handle("server:getConfig", () => {
    const mode = getSetting("server_mode") ?? "local";
    if (mode === "remote") {
      return {
        url: (getSetting("remote_server_url") as string) || "http://localhost:3001",
        token: (getSetting("remote_api_key") as string) || "",
        mode: "remote" as const,
      };
    }

    const info = getServerInfo();
    return {
      url: info?.url ?? "http://localhost:3001",
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
  });

  ipcMain.handle("app:settings:getAll", () => {
    return getAllSettings();
  });
}
