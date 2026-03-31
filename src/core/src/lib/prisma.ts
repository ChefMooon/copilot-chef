import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Set it to a SQLite file path, e.g. file:./data/copilot-chef.db"
  );
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (!globalForPrisma.prisma) {
  // Configure SQLite for concurrent access safety.
  // These PRAGMAs persist for the lifetime of the connection.
  // Use $queryRawUnsafe because some SQLite PRAGMAs (e.g. journal_mode) return rows.
  prisma
    .$queryRawUnsafe("PRAGMA journal_mode = WAL")
    .then(() => prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000"))
    .then(() => prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL"))
    .then(() => prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON"))
    .catch((err: unknown) => {
      console.error("Failed to set SQLite PRAGMAs:", err);
    });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
