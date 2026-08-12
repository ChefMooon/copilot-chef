import { describe, expect, it, vi } from "vitest";

import { createShutdownGate } from "./shutdown";

describe("createShutdownGate", () => {
  it("runs runtime cleanup once and quits after cleanup completes", async () => {
    let resolveCleanup!: () => void;
    const requestRuntimeQuit = vi.fn(
      () => new Promise<void>((resolve) => (resolveCleanup = resolve))
    );
    const quit = vi.fn();
    const gate = createShutdownGate({
      requestRuntimeQuit,
      quit,
      onError: vi.fn(),
    });

    gate.request();
    gate.request();

    expect(requestRuntimeQuit).toHaveBeenCalledTimes(1);
    expect(quit).not.toHaveBeenCalled();
    expect(gate.isQuitting()).toBe(true);

    resolveCleanup();
    await vi.waitFor(() => expect(quit).toHaveBeenCalledTimes(1));
    expect(gate.isFinalQuitRequested()).toBe(true);
  });

  it("resets its active state when cleanup fails", async () => {
    const error = new Error("cleanup failed");
    const onError = vi.fn();
    const gate = createShutdownGate({
      requestRuntimeQuit: vi.fn().mockRejectedValue(error),
      quit: vi.fn(),
      onError,
    });

    gate.request();

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    expect(gate.isQuitting()).toBe(false);
    expect(gate.isFinalQuitRequested()).toBe(false);
  });
});