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

function parseEnabled(value: string | undefined) {
  return value === "1" || value === "true";
}

function parseBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

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

        return {
          token,
          callerId,
          source: source || undefined,
        } satisfies TokenIdentity;
      });
  }

  const token = process.env["PA_MACHINE_AUTH_TOKEN"]?.trim();
  if (!token) {
    return [];
  }

  return [
    {
      token,
      callerId: process.env["PA_MACHINE_CALLER_ID"]?.trim() || "max-pa",
      source: process.env["PA_MACHINE_SOURCE"]?.trim() || "machine",
    },
  ];
}

function resolveIdentityFromToken(token: string | null) {
  if (!token) {
    return null;
  }

  const configuredTokens = parseTokenMappingsFromEnv();
  const identity = configuredTokens.find((entry) => entry.token === token);
  if (!identity) {
    return null;
  }

  return {
    callerId: identity.callerId,
    source: identity.source,
  } satisfies CallerIdentity;
}

export function requireCallerIdentity(request: Request): CallerIdentity {
  const authEnabled = parseEnabled(process.env["PA_MACHINE_AUTH_ENABLED"]);
  const token = parseBearerToken(request.headers.get("authorization"));
  const identityFromToken = resolveIdentityFromToken(token);

  if (identityFromToken) {
    return identityFromToken;
  }

  if (authEnabled) {
    const hasAnyTokenConfig = parseTokenMappingsFromEnv().length > 0;
    if (!hasAnyTokenConfig) {
      throw new MachineAuthError(
        500,
        "Machine auth is enabled but no machine token is configured"
      );
    }

    throw new MachineAuthError(401, "Unauthorized machine request");
  }

  return {
    callerId: DEFAULT_WEB_CALLER_ID,
    source: DEFAULT_WEB_SOURCE,
  };
}
