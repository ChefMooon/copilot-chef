import path from "node:path";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function resolveFallbackDatabaseUrl() {
  const normalizedCwd = process.cwd().replace(/\\/g, "/");

  if (normalizedCwd.endsWith("/src/web")) {
    return `file:${path.resolve(process.cwd(), "../core/prisma/copilot-chef.db")}`;
  }

  if (normalizedCwd.endsWith("/src/core")) {
    return `file:${path.resolve(process.cwd(), "prisma/copilot-chef.db")}`;
  }

  return `file:${path.resolve(process.cwd(), "src/core/prisma/copilot-chef.db")}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL ?? resolveFallbackDatabaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
