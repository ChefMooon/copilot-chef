import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DB_URL_KEY = "COPILOT_CHEF_DATABASE_URL";

function loadDbUrlFromEnvFile(): void {
  if (process.env[DB_URL_KEY]) return;

  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    if (key !== DB_URL_KEY) continue;

    const rawValue = trimmed.slice(separator + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    if (value) {
      process.env[DB_URL_KEY] = value;
    }
    break;
  }
}

async function main(): Promise<void> {
  loadDbUrlFromEnvFile();

  const [{ seedDatabase }, { prisma }] = await Promise.all([
    import("../lib/seed"),
    import("../lib/prisma"),
  ]);

  try {
    await seedDatabase();
    console.info("[copilot-chef] seed complete");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[copilot-chef] seed failed:", error);
  process.exitCode = 1;
});
