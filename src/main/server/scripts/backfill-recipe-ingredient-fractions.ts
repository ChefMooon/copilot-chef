import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ensureDatabaseSchema } from "../lib/schema";
import { prisma } from "../lib/prisma";

const DB_URL_KEY = "LOCAL_RECIPE_BOOK_DATABASE_URL";

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

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }

  return a || 1;
}

function decimalToFraction(value: number): { numerator: number; denominator: number } {
  const rounded = Math.round(value * 1000) / 1000;
  const sign = rounded < 0 ? -1 : 1;
  const absValue = Math.abs(rounded);
  const denominator = 1000;
  const numerator = Math.round(absValue * denominator);
  const divisor = greatestCommonDivisor(numerator, denominator);

  return {
    numerator: sign * (numerator / divisor),
    denominator: denominator / divisor,
  };
}

type RecipeIngredientBackfillRow = {
  id: string;
  quantity: number | null;
};

async function main() {
  loadDbUrlFromEnvFile();
  await ensureDatabaseSchema();

  const ingredients = await prisma.$queryRawUnsafe<RecipeIngredientBackfillRow[]>(`
    SELECT "id", "quantity"
    FROM "RecipeIngredient"
    WHERE "quantity" IS NOT NULL
      AND (
        "quantityNumerator" IS NULL
        OR "quantityDenominator" IS NULL
      )
  `);

  let updated = 0;
  for (const ingredient of ingredients) {
    if (ingredient.quantity == null) {
      continue;
    }

    const fraction = decimalToFraction(ingredient.quantity);
    await prisma.$executeRawUnsafe(
      `
        UPDATE "RecipeIngredient"
        SET "quantityNumerator" = ?, "quantityDenominator" = ?
        WHERE "id" = ?
      `,
      fraction.numerator,
      fraction.denominator,
      ingredient.id
    );
    updated += 1;
  }

  console.info(`[local-recipe-book] fraction backfill complete: ${updated}/${ingredients.length} updated`);
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error("[local-recipe-book] fraction backfill failed:", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});