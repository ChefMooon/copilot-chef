import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const DB_PATH = join(process.cwd(), "prisma", "test-integration.db");
const DB_URL = `file:${DB_PATH}`;

const staleFiles = ["", "-journal", "-wal", "-shm"];

function removeDb() {
  for (const suffix of staleFiles) {
    const p = DB_PATH + suffix;
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        // best-effort
      }
    }
  }
}

export async function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  removeDb();

  const result = spawnSync(
    "npx",
    ["prisma", "db", "push", "--skip-generate", "--schema=prisma/schema.prisma"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: DB_URL },
      encoding: "utf8",
      timeout: 60_000,
      shell: true,
    }
  );

  if (result.status !== 0) {
    throw new Error(
      `prisma db push failed (exit ${result.status ?? "null"}):\n${result.stderr}`
    );
  }

  provide("TEST_DB_URL", DB_URL);
}

export async function teardown() {
  removeDb();
}
