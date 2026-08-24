import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { changeEventBus, readPersistedRevision } from "../services/change-event-bus.js";

const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_CONNECTIONS_PER_TOKEN = 4;

type ConnectionTracking = {
  counts: Map<string, number>;
  shutdowns: Set<() => void>;
};

const globalForConnections = globalThis as typeof globalThis & {
  __localRecipeBookSyncConnections?: ConnectionTracking;
};

const connections: ConnectionTracking =
  globalForConnections.__localRecipeBookSyncConnections ??
  ({ counts: new Map(), shutdowns: new Set() } as ConnectionTracking);
globalForConnections.__localRecipeBookSyncConnections = connections;

export function shutdownSyncConnections(): void {
  for (const shutdown of [...connections.shutdowns]) {
    shutdown();
  }
}

function acquireConnectionSlot(tokenKey: string): boolean {
  const current = connections.counts.get(tokenKey) ?? 0;
  if (current >= MAX_CONNECTIONS_PER_TOKEN) {
    return false;
  }
  connections.counts.set(tokenKey, current + 1);
  return true;
}

function releaseConnectionSlot(tokenKey: string): void {
  const current = connections.counts.get(tokenKey) ?? 0;
  if (current <= 1) {
    connections.counts.delete(tokenKey);
  } else {
    connections.counts.set(tokenKey, current - 1);
  }
}

export const syncRoutes = new Hono();

syncRoutes.get("/sync/revision", async (c) => {
  const revision = await readPersistedRevision();
  return c.json({ revision });
});

syncRoutes.get("/events", async (c) => {
  // The auth middleware has already validated the bearer token by this point.
  const authorization = c.req.header("authorization") ?? "";
  const tokenKey = authorization.slice(-24) || "anonymous";

  if (!acquireConnectionSlot(tokenKey)) {
    c.header("Retry-After", "5");
    return c.json({ error: "Too many event streams", code: "SYNC_CONNECTION_LIMIT" }, 429);
  }

  let unsubscribe: (() => void) | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let resolveStream: (() => void) | undefined;

  return streamSSE(c, async (stream) => {
    let writeQueue = Promise.resolve();
    let handshakeComplete = false;
    const pendingEvents: Parameters<typeof changeEventBus.emit>[0][] = [];
    const enqueue = (write: () => Promise<void>) => {
      const next = writeQueue.then(write);
      writeQueue = next.catch(() => undefined);
      return next;
    };

    try {
      resolveStream = () => {
        resolveStream = undefined;
        void stream.close().catch(() => {});
      };
      connections.shutdowns.add(resolveStream);

      // Subscribe before taking the handshake snapshot. Events arriving during
      // the snapshot are held until hello is queued, so no committed change is lost.
      unsubscribe = changeEventBus.subscribe((event) => {
        if (!handshakeComplete) {
          pendingEvents.push(event);
          return;
        }
        void enqueue(() =>
          stream.writeSSE({
            event: "change",
            data: JSON.stringify(event),
          })
        ).catch(() => resolveStream?.());
      });

      await enqueue(async () =>
        stream.writeSSE({
          event: "hello",
          data: JSON.stringify({ revision: await readPersistedRevision() }),
        })
      );
      handshakeComplete = true;
      for (const event of pendingEvents.splice(0)) {
        await enqueue(() =>
          stream.writeSSE({
            event: "change",
            data: JSON.stringify(event),
          })
        );
      }

      heartbeatTimer = setInterval(() => {
        void enqueue(() => stream.writeSSE({ event: "heartbeat", data: "" }))
          .catch(() => resolveStream?.());
      }, HEARTBEAT_INTERVAL_MS);

      await new Promise<void>((resolve) => {
        stream.onAbort(() => resolve());
      });
    } finally {
      if (unsubscribe) unsubscribe();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (resolveStream) connections.shutdowns.delete(resolveStream);
      releaseConnectionSlot(tokenKey);
    }
  });
});
