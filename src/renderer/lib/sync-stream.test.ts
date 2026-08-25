import { describe, expect, it, vi } from "vitest";
import { ENTITY_TO_QUERY_KEYS, invalidateQueriesForEntity } from "./query-invalidation";
import { handleRevisionObservation } from "./sync-stream";

vi.mock("./platform", () => ({
  getPlatform: () => ({ runtime: "browser" }),
}));

function createQueryClientStub() {
  return {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  };
}

describe("entity-to-query-key invalidation", () => {
  it("maps every server entity onto at least one query prefix", () => {
    for (const entity of [
      "meal",
      "mealType",
      "mealSubType",
      "recipe",
      "groceryList",
      "prepList",
      "preference",
    ]) {
      expect(ENTITY_TO_QUERY_KEYS[entity]?.length).toBeGreaterThan(0);
    }
  });

  it("invalidates all prefixes for the entity", async () => {
    const queryClient = createQueryClientStub();
    await invalidateQueriesForEntity(queryClient as never, "recipe");

    const invalidatedKeys = queryClient.invalidateQueries.mock.calls.map(
      (call) => call[0].queryKey
    );
    expect(invalidatedKeys).toEqual([["recipes"], ["recipe"], ["stats"]]);
  });

  it("is a no-op for unknown entities", async () => {
    const queryClient = createQueryClientStub();
    await invalidateQueriesForEntity(queryClient as never, "unknown-entity");
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});

describe("revision observation rules", () => {
  it("sweeps when the served revision is higher than last seen", () => {
    const frames: string[] = [];
    handleRevisionObservation(5, 4, (entity) => frames.push(entity));
    expect(frames).toContain("__sweep__");
  });

  it("sweeps when the served revision is LOWER (treated as unknown)", () => {
    const frames: string[] = [];
    handleRevisionObservation(3, 9, (entity) => frames.push(entity));
    expect(frames).toContain("__sweep__");
  });

  it("does not sweep when the revision is unchanged", () => {
    const frames: string[] = [];
    handleRevisionObservation(7, 7, (entity) => frames.push(entity));
    expect(frames).toHaveLength(0);
  });

  it("polling fallback: rapid stream failures cross the threshold and poller takes over", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn();
      // Stream handshake fails repeatedly.
      fetchMock.mockRejectedValue(new Error("stream blocked"));
      vi.stubGlobal("fetch", fetchMock);

      const statuses: string[] = [];
      const { startSyncStream, stopSyncStream } = await import("./sync-stream");
      startSyncStream({
        onStatus: (status) => statuses.push(status),
        onFrame: () => {},
      });

      // Advance through several backoff cycles to exceed MAX_RAPID_FAILURES.
      await vi.advanceTimersByTimeAsync(120_000);

      // After threshold, the revision probe endpoint is polled.
      const revisionProbeCalls = fetchMock.mock.calls.filter(
        ([url]) => String(url).includes("/api/sync/revision")
      );
      expect(revisionProbeCalls.length).toBeGreaterThan(0);
      expect(statuses).toContain("polling");
      stopSyncStream();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("does not reconnect after the stream is stopped", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn().mockRejectedValue(new Error("stream blocked"));
      vi.stubGlobal("fetch", fetchMock);

      const { startSyncStream, stopSyncStream } = await import("./sync-stream");
      startSyncStream({
        onStatus: () => {},
        onFrame: () => {},
      });
      await vi.advanceTimersByTimeAsync(0);

      stopSyncStream();
      await vi.advanceTimersByTimeAsync(120_000);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
