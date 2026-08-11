import { describe, expect, it } from "vitest";

import { IPC_CHANNELS, type IpcChannel, type IpcInvokeMap } from "./ipc";

describe("shared IPC contract", () => {
  it("exposes the canonical channel list and typed channel map", () => {
    expect(IPC_CHANNELS).toContain("server:getConfig");
    expect(IPC_CHANNELS).toContain("menu:exportPdf");
    expect(IPC_CHANNELS).toContain("updates:check");

    const channel: IpcChannel = "window:minimize";
    const payload: IpcInvokeMap[typeof channel] = undefined;
    expect(channel).toBe("window:minimize");
    expect(payload).toBeUndefined();
  });
});
