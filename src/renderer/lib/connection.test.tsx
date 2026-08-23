// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useServerConnection } from "./connection";

function ConnectionProbe() {
  const { status } = useServerConnection("http://127.0.0.1:3001");
  return <output data-testid="status">{status}</output>;
}

describe("useServerConnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stays connected after a successful health response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true }) as Response));

    render(<ConnectionProbe />);
    await act(async () => {});

    expect(screen.getByTestId("status").textContent).toBe("connected");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not retry an aborted health request", async () => {
    let rejectFetch!: (error: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            rejectFetch = reject;
          })
      )
    );

    const view = render(<ConnectionProbe />);
    view.unmount();
    rejectFetch(new DOMException("The operation was aborted.", "AbortError"));
    await act(async () => {});

    expect(vi.getTimerCount()).toBe(0);
  });
});