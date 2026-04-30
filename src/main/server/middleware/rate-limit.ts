import type { Context, Next } from "hono";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const store = new Map<string, { count: number; resetAt: number }>();

function getClientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function createRateLimitMiddleware() {
  return async (c: Context, next: Next) => {
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
