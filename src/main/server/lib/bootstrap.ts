import { prisma } from "./prisma";
import { ensureDatabaseSchema } from "./schema";
import { seedDatabase } from "./seed";
import { MealTypeService } from "../services/meal-type-service";
import { MealSubTypeService } from "../services/meal-sub-type-service";

async function backfillMealSortOrder() {
  const groupedMeals = await prisma.meal.groupBy({
    by: ["date", "mealType"],
    where: { date: { not: null } },
    _count: { id: true },
  });

  const slotsToBackfill = groupedMeals.filter((group) => group._count.id > 1);

  for (const slot of slotsToBackfill) {
    if (!slot.date) {
      continue;
    }

    const meals = await prisma.meal.findMany({
      where: {
        date: slot.date,
        mealType: slot.mealType,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, sortOrder: true },
    });

    const alreadyNormalized = meals.every(
      (meal, index) => meal.sortOrder === (index + 1) * 10
    );

    if (alreadyNormalized) {
      continue;
    }

    await prisma.$transaction(
      meals.map((meal, index) =>
        prisma.meal.update({
          where: { id: meal.id },
          data: { sortOrder: (index + 1) * 10 },
        })
      )
    );
  }
}

let bootstrapPromise: Promise<void> | undefined;
const mealTypeBootstrapService = new MealTypeService();
const mealSubTypeBootstrapService = new MealSubTypeService();

function parseBooleanEnv(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

export function shouldSeedDatabase(): boolean {
  const seedEnv = process.env["LOCAL_RECIPE_BOOK_SEED_DATABASE"];
  if (seedEnv !== undefined) {
    const parsed = parseBooleanEnv(seedEnv);
    if (parsed === undefined) {
      console.warn(
        `[local-recipe-book] invalid LOCAL_RECIPE_BOOK_SEED_DATABASE value "${seedEnv}"; expected true/false or 1/0. Defaulting to no seeding.`
      );
      return false;
    }
    return parsed;
  }

  // Safe default: do not seed in production builds unless explicitly enabled.
  return process.env.NODE_ENV !== "production";
}

export interface DatabaseBootstrapOptions {
  seedEnabled?: boolean;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export async function ensureDatabaseCompatibility(): Promise<void> {
  await ensureDatabaseSchema();
}

export async function applyDatabaseDefaults(): Promise<void> {
  await mealTypeBootstrapService.bootstrapDefaults();
  await mealSubTypeBootstrapService.bootstrapDefaults();
}

export async function applyDatabaseSeedPolicy(
  options: Pick<DatabaseBootstrapOptions, "seedEnabled"> = {}
): Promise<void> {
  const shouldRunSeed = options.seedEnabled ?? shouldSeedDatabase();
  if (!shouldRunSeed) {
    return;
  }

  await seedDatabase();
}

export async function finalizeDatabaseRuntime(): Promise<void> {
  await mealTypeBootstrapService.migrateExistingMeals();
  await backfillMealSortOrder();
}

export async function initializeDatabaseRuntime(
  options: DatabaseBootstrapOptions = {}
): Promise<void> {
  await connectDatabase();
  await ensureDatabaseCompatibility();
  await applyDatabaseDefaults();
  await applyDatabaseSeedPolicy(options);
  await finalizeDatabaseRuntime();
}

export async function bootstrapDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = initializeDatabaseRuntime().catch((error) => {
      bootstrapPromise = undefined;
      throw error;
    });
  }

  await bootstrapPromise;
}
