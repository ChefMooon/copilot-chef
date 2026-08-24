import type { Context, Next } from "hono";

const WINDOW_MS = 60_000;
// Sized for households sharing one NAT IP: one mutation triggers an
// invalidation burst of several refetches per connected client, so the
// budget must absorb multi-client event bursts, not just one client's traffic.
const MAX_REQUESTS = 180;

const store = new Map<string, { count: number; resetAt: number }>();

function getClientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function createRateLimitMiddleware() {
  return async (c: Context, next: Next) => {
    // Exempt the sync revision freshness probe entirely: it is polled as a
    // fallback when SSE streams are unavailable and must not lock devices out.
    if (c.req.path === "/api/sync/revision") {
      await next();
      return;
    }

    // Exempt CORS preflights: browsers send an OPTIONS request before every
    // cross-origin call, so counting them halves the effective budget and
    // lets a single drag-and-drop burst lock every LAN client out.
    if (c.req.method === "OPTIONS") {
      await next();
      return;
    }

    // Exempt the established event-stream handshake path from the bucket:
    // reconnects after server restarts or PWA resumes must not be throttled
    // into a lockout loop (the stream itself is long-lived, not per-request).
    if (c.req.path === "/api/events") {
      await next();
      return;
    }

    const ip = getClientIp(c);
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      entry.count++;
      if (entry.count > MAX_REQUESTS) {
        return c.json({ error: "Too many requests" }, 429);
      }
    }

    await next();
  };
}
