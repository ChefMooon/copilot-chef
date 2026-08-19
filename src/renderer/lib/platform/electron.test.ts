// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createElectronPlatform } from "./electron";

describe("electron platform archive dialogs", () => {
  const openDataArchive = vi.fn();
  const saveDataArchive = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "api", {
      configurable: true,
      value: {
        invoke: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        openDataArchive,
        saveDataArchive,
      },
    });
  });

  it("preserves native open-dialog cancellation", async () => {
    openDataArchive.mockResolvedValue({ status: "canceled" });

    const platform = createElectronPlatform();

    expect(platform.capabilities.dataManagement).toBe(true);
    await expect(platform.openDataArchive()).resolves.toEqual({
      status: "canceled",
    });
  });

  it("forwards archive bytes to the native save dialog", async () => {
    saveDataArchive.mockResolvedValue({
      status: "saved",
      filePath: "C:/Backups/backup.lrb",
    });
    const payload = {
      data: new Uint8Array([1, 2, 3]),
      suggestedFileName: "backup.lrb",
    };

    await expect(createElectronPlatform().saveDataArchive(payload)).resolves.toEqual({
      status: "saved",
      filePath: "C:/Backups/backup.lrb",
    });
    expect(saveDataArchive).toHaveBeenCalledWith(payload);
  });
});