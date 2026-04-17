import { prisma } from "./prisma";
import { ensureDatabaseSchema } from "./schema";
import { seedDatabase } from "./seed";
import { MealTypeService } from "../services/meal-type-service";

let bootstrapPromise: Promise<void> | undefined;
const mealTypeBootstrapService = new MealTypeService();

function parseBooleanEnv(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function shouldSeedDatabase(): boolean {
  const seedEnv = process.env["COPILOT_CHEF_SEED_DATABASE"];
  if (seedEnv !== undefined) {
    const parsed = parseBooleanEnv(seedEnv);
    if (parsed === undefined) {
      console.warn(
        `[copilot-chef] invalid COPILOT_CHEF_SEED_DATABASE value "${seedEnv}"; expected true/false or 1/0. Defaulting to no seeding.`
      );
      return false;
    }
    return parsed;
  }

  // Safe default: do not seed in production builds unless explicitly enabled.
  return process.env.NODE_ENV !== "production";
}

export async function bootstrapDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await prisma.$connect();
      await ensureDatabaseSchema();
      await mealTypeBootstrapService.bootstrapDefaults();
      if (shouldSeedDatabase()) {
        await seedDatabase();
      }
      await mealTypeBootstrapService.migrateExistingMeals();
    })().catch((error) => {
      bootstrapPromise = undefined;
      throw error;
    });
  }

  await bootstrapPromise;
}
