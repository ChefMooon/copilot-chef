import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updater = Object.assign(new EventEmitter(), {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
});
const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock("electron-updater", () => ({ autoUpdater: updater }));
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
  },
  BrowserWindow: class {},
}));

const { setupAutoUpdater } = await import("./service");

describe("auto updater service", () => {
  const send = vi.fn();
  const win = {
    isDestroyed: () => false,
    webContents: { send },
  } as never;

  beforeEach(() => {
    send.mockClear();
    updater.removeAllListeners();
    updater.checkForUpdates.mockReset();
    updater.quitAndInstall.mockReset();
  });

  it("automatically downloads, forwards lifecycle events, replays state, and installs explicitly", async () => {
    updater.checkForUpdates.mockResolvedValue({ updateInfo: { version: "2.0.0" } });
    setupAutoUpdater(win, { checkOnStartup: false });

    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);

    const info = { version: "2.0.0" };
    updater.emit("update-available", info);
    updater.emit("download-progress", { percent: 42 });
    updater.emit("update-downloaded", info);

    expect(send).toHaveBeenCalledWith("updates:available", info);
    expect(send).toHaveBeenCalledWith("updates:progress", { percent: 42 });
    expect(send).toHaveBeenCalledWith("updates:downloaded", info);
    expect(handlers.get("updates:get-state")?.()).toEqual({
      status: "downloaded",
      info,
    });

    await handlers.get("updates:install")?.();
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();
  });
});
