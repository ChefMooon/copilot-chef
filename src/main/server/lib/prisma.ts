import { PrismaClient } from "@prisma/client";

const DEFAULT_DATABASE_URL = "file:./data/copilot-chef.db";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

let _client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (_client) return _client;

  const databaseUrl =
    process.env.COPILOT_CHEF_DATABASE_URL ?? DEFAULT_DATABASE_URL;

  _client = new PrismaClient({
    datasourceUrl: databaseUrl,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

  // Configure SQLite for concurrent access safety.
  // These PRAGMAs persist for the lifetime of the connection.
  // Use $queryRawUnsafe because some SQLite PRAGMAs (e.g. journal_mode) return rows.
  _client
    .$queryRawUnsafe("PRAGMA journal_mode = WAL")
    .then(() => _client!.$queryRawUnsafe("PRAGMA busy_timeout = 5000"))
    .then(() => _client!.$queryRawUnsafe("PRAGMA synchronous = NORMAL"))
    .then(() => _client!.$queryRawUnsafe("PRAGMA foreign_keys = ON"))
    .catch((err: unknown) => {
      console.error("Failed to set SQLite PRAGMAs:", err);
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = _client;
  }

  return _client;
}

// Lazy proxy — the PrismaClient is created on first access.
// If COPILOT_CHEF_DATABASE_URL is not set, it falls back to file:./data/copilot-chef.db.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getClient();
    const value = (client as unknown as Record<PropertyKey, unknown>)[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
