import { timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import type { ServerConfig } from "@shared/config/server-config";

export type CallerIdentity = {
  callerId: string;
  source?: string;
};

export class MachineAuthError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "MachineAuthError";
  }
}

const DEFAULT_WEB_CALLER_ID = "web-default";
const DEFAULT_WEB_SOURCE = "web";

type TokenIdentity = {
  token: string;
  callerId: string;
  source?: string;
};

function tokenMatches(input: string, configured: string) {
  if (input.length !== configured.length) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(configured));
}

function parseBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function parseTokenMappingsFromEnv(): TokenIdentity[] {
  const mapped = process.env["PA_MACHINE_AUTH_TOKENS"]?.trim();
  if (mapped) {
    return mapped
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => {
        const equalsIndex = entry.indexOf("=");
        if (equalsIndex <= 0 || equalsIndex === entry.length - 1) {
          throw new MachineAuthError(
            500,
            "PA_MACHINE_AUTH_TOKENS entries must use token=callerId[:source] format"
          );
        }
        const token = entry.slice(0, equalsIndex).trim();
        const identityPart = entry.slice(equalsIndex + 1).trim();
        const [rawCallerId, rawSource] = identityPart.split(":", 2);
        const callerId = rawCallerId?.trim();
        const source = rawSource?.trim();
        if (!token || !callerId) {
          throw new MachineAuthError(
            500,
            "PA_MACHINE_AUTH_TOKENS contains an invalid token mapping"
          );
        }
        return { token, callerId, source: source || undefined } satisfies TokenIdentity;
      });
  }

  const token = process.env["PA_MACHINE_AUTH_TOKEN"]?.trim();
  if (!token) return [];

  return [
    {
      token,
      callerId: process.env["PA_MACHINE_CALLER_ID"]?.trim() || "max-pa",
      source: process.env["PA_MACHINE_SOURCE"]?.trim() || "machine",
    },
  ];
}

function resolveIdentityFromToken(token: string | null): CallerIdentity | null {
  if (!token) return null;
  const configuredTokens = parseTokenMappingsFromEnv();
  const identity = configuredTokens.find((entry) => tokenMatches(token, entry.token));
  if (!identity) return null;
  return { callerId: identity.callerId, source: identity.source };
}

export function resolveCallerIdentity(
  authHeader: string | null,
  configTokens?: string[]
): CallerIdentity {
  const bearerToken = parseBearerToken(authHeader);

  // Check config-based tokens first (from loaded ServerConfig)
  if (bearerToken && configTokens && configTokens.length > 0) {
    const matched = configTokens.find((t) => {
      if (bearerToken.length !== t.length) return false;
      return timingSafeEqual(Buffer.from(bearerToken), Buffer.from(t));
    });
    if (matched) {
      return { callerId: "api-client", source: "api-key" };
    }
  }

  // Fallback: env-based machine token mappings
  const envIdentity = resolveIdentityFromToken(bearerToken);
  if (envIdentity) return envIdentity;

  const authEnabled =
    process.env["PA_MACHINE_AUTH_ENABLED"] === "1" ||
    process.env["PA_MACHINE_AUTH_ENABLED"] === "true";

  if (authEnabled) {
    const hasAnyTokenConfig = parseTokenMappingsFromEnv().length > 0;
    if (!hasAnyTokenConfig) {
      throw new MachineAuthError(500, "Auth is enabled but no token is configured");
    }
    throw new MachineAuthError(401, "Unauthorized");
  }

  return { callerId: DEFAULT_WEB_CALLER_ID, source: DEFAULT_WEB_SOURCE };
}

/**
 * Hono middleware factory. When tokens are configured in server config,
 * all /api/* requests (except /api/health) require a valid Bearer token.
 * Falls back to env-based machine auth tokens for backward compat.
 */
export function createAuthMiddleware(config: ServerConfig) {
  return async (c: Context, next: Next) => {
    const path = c.req.path;
    if (path === "/api/health") {
      return next();
    }

    const authHeader = c.req.header("authorization") ?? null;

    try {
      const identity = resolveCallerIdentity(authHeader, config.auth.tokens);
      c.set("callerId", identity.callerId);
      c.set("source", identity.source ?? "unknown");
      return next();
    } catch (err) {
      if (err instanceof MachineAuthError) {
        return c.json({ error: err.message }, err.status as 401 | 500);
      }
      return c.json({ error: "Auth error" }, 500);
    }
  };
}

export function getCallerId(c: Context): string {
  return (c.get("callerId") as string | undefined) ?? DEFAULT_WEB_CALLER_ID;
}
