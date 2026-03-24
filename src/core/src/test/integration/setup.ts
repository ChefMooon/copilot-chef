/**
 * Per-worker setup for integration tests.
 *
 * Sets DATABASE_URL from the value provided by the global setup before any
 * module is imported by the test file, so the Prisma client singleton is
 * created with the temp test DB rather than the default SQLite path.
 */
import { inject } from "vitest";

const testDbUrl = inject<string>("TEST_DB_URL");

if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;

  // Clear any cached Prisma client set by a previous test file in the same
  // worker so prisma.ts re-initialises with the updated DATABASE_URL.
  (globalThis as Record<string, unknown>).prisma = undefined;
}
