import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const syncStateMock = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("./lib/prisma", () => ({ prisma: { syncState: syncStateMock } }));
vi.mock("./lib/bootstrap", () => ({ bootstrapDatabase: vi.fn() }));

import { createApp } from "./app";
import { changeEventBus } from "./services/change-event-bus";

const baseConfig = {
  server: { port: 3001, host: "127.0.0.1", logLevel: "info" },
  database: { url: "file:./data/local-recipe-book.db" },
  auth: { tokens: ["test-token"] },
  updates: { feedUrl: "", checkOnStartup: true },
  cors: { origins: ["http://localhost:5173"] },
} as const;

describe("sync routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(baseConfig);
    syncStateMock.findUnique.mockReset();
    syncStateMock.upsert.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects /api/sync/revision without a bearer token", async () => {
    const response = await app.request("/api/sync/revision");
    expect(response.status).toBe(401);
  });

  it("returns the persisted revision with auth", async () => {
    syncStateMock.findUnique.mockResolvedValue({ value: "7" });

    const response = await app.request("/api/sync/revision", {
      headers: { Authorization: "Bearer test-token" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revision: 7 });
  });

  it("treats a missing persisted row as revision 0", async () => {
    syncStateMock.findUnique.mockResolvedValue(null);

    const response = await app.request("/api/sync/revision", {
      headers: { Authorization: "Bearer test-token" },
    });

    expect(await response.json()).toEqual({ revision: 0 });
  });

  it("opens an event stream for an authenticated client", async () => {
    syncStateMock.findUnique.mockResolvedValue({ value: "3" });

    const response = await app.request("/api/events", {
      headers: { Authorization: "Bearer test-token" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    // The stream stays open; abort it by cancelling the body.
    const reader = response.body?.getReader();
    const firstChunk = await Promise.race([
      reader?.read(),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 500)),
    ]);
    if (firstChunk && firstChunk !== "timeout" && !firstChunk.done) {
      expect(new TextDecoder().decode(firstChunk.value)).toContain("event: hello");
    }
    await reader?.cancel().catch(() => {});
  }, 10_000);

  it("rejects the event stream without a bearer token", async () => {
    const response = await app.request("/api/events");
    expect(response.status).toBe(401);
  });

  it("distinguishes the per-token stream cap from request rate limiting", async () => {
    syncStateMock.findUnique.mockResolvedValue({ value: "3" });
    const streams = await Promise.all(
      Array.from({ length: 4 }, () =>
        app.request("/api/events", {
          headers: { Authorization: "Bearer test-token" },
        })
      )
    );

    try {
      const response = await app.request("/api/events", {
        headers: { Authorization: "Bearer test-token" },
      });

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("5");
      expect(await response.json()).toEqual({
        error: "Too many event streams",
        code: "SYNC_CONNECTION_LIMIT",
      });
    } finally {
      await Promise.all(
        streams.map(async (stream) => {
          await stream.body?.cancel().catch(() => {});
        })
      );
    }
  });

  it("fans out bus events to multiple subscribers", () => {
    const received: Array<{ client: number; entity: string; revision: number }> = [];
    const unsubs = [0, 1].map((client) =>
      changeEventBus.subscribe((event) =>
        received.push({ client, entity: event.entity, revision: event.revision })
      )
    );

    changeEventBus.emit({ entity: "meal", action: "update", id: "m1", revision: 9 });

    unsubs.forEach((fn) => fn());

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({ entity: "meal", revision: 9 });
    expect(received[1]).toMatchObject({ entity: "meal", revision: 9 });
  });
});
