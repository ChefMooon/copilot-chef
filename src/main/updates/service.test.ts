import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updater = Object.assign(new EventEmitter(), {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
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
    updater.downloadUpdate.mockReset();
    updater.quitAndInstall.mockReset();
  });

  it("requires explicit download, forwards lifecycle events, replays state, and installs explicitly", async () => {
    updater.checkForUpdates.mockResolvedValue({ updateInfo: { version: "2.0.0" } });
    setupAutoUpdater(win, { checkOnStartup: false });

    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);

    const info = { version: "2.0.0" };
    updater.emit("update-available", info);
    updater.downloadUpdate.mockResolvedValue([]);
    await handlers.get("updates:download")?.();
    expect(updater.downloadUpdate).toHaveBeenCalledOnce();
    updater.emit("download-progress", { percent: 42 });
    updater.emit("update-downloaded", info);

    expect(send).toHaveBeenCalledWith("updates:available", info);
    expect(send).toHaveBeenCalledWith("updates:progress", { percent: 42 });
    expect(send).toHaveBeenCalledWith("updates:downloaded", info);
    expect(handlers.get("updates:get-state")?.()).toEqual({
      status: "downloaded",
      info,
    });

    await handlers.get("updates:download")?.();
    expect(updater.downloadUpdate).toHaveBeenCalledOnce(); // already downloaded is idempotent

    await handlers.get("updates:install")?.();
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();

    updater.emit(
      "error",
      new Error(
        'Cannot find latest.yml in the latest release artifacts: HttpError: 404 "method: GET url: https://github.com/ChefMooon/local-recipe-book/releases/download/v1.2.6/latest.yml\\n\\nPlease double check that your authentication token is correct."'
      )
    );

    expect(handlers.get("updates:get-state")?.()).toEqual({
      status: "error",
      info,
      error:
        "The latest update is temporarily unavailable because of a release issue. No action is needed; please wait for the developer to publish a fix.",
    });
    expect(send).toHaveBeenCalledWith(
      "updates:error",
      "The latest update is temporarily unavailable because of a release issue. No action is needed; please wait for the developer to publish a fix."
    );
  });
});
