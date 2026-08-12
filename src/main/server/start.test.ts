import { describe, expect, it, vi } from "vitest";

import { closeHttpServer } from "./start";

describe("closeHttpServer", () => {
  it("waits for the server close callback", async () => {
    let closeCallback!: (error?: Error) => void;
    const server = {
      close: vi.fn((callback: (error?: Error) => void) => {
        closeCallback = callback;
      }),
    };

    let settled = false;
    const closing = closeHttpServer(server).then(() => {
      settled = true;
    });

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    closeCallback();
    await closing;

    expect(settled).toBe(true);
  });

  it("rejects when the server reports a close error", async () => {
    const server = {
      close: (callback: (error?: Error) => void) => {
        callback(new Error("close failed"));
      },
    };

    await expect(closeHttpServer(server)).rejects.toThrow("close failed");
  });
});