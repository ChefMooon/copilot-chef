import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensureDatabaseSchemaMock,
  seedDatabaseMock,
  connectMock,
  mealTypeBootstrapMock,
  mealSubTypeBootstrapMock,
} = vi.hoisted(() => ({
  ensureDatabaseSchemaMock: vi.fn(),
  seedDatabaseMock: vi.fn(),
  connectMock: vi.fn(),
  mealTypeBootstrapMock: {
    bootstrapDefaults: vi.fn(),
    migrateExistingMeals: vi.fn(),
  },
  mealSubTypeBootstrapMock: {
    bootstrapDefaults: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  meal: { groupBy: vi.fn().mockResolvedValue([]) },
}));

vi.mock("./prisma", () => ({
  prisma: {
    $connect: connectMock,
    meal: prismaMock.meal,
  },
}));

vi.mock("./schema", () => ({
  ensureDatabaseSchema: ensureDatabaseSchemaMock,
}));

vi.mock("./seed", () => ({
  seedDatabase: seedDatabaseMock,
}));

vi.mock("../services/meal-type-service", () => ({
  MealTypeService: class {
    bootstrapDefaults = mealTypeBootstrapMock.bootstrapDefaults;
    migrateExistingMeals = mealTypeBootstrapMock.migrateExistingMeals;
  },
}));

vi.mock("../services/meal-sub-type-service", () => ({
  MealSubTypeService: class {
    bootstrapDefaults = mealSubTypeBootstrapMock.bootstrapDefaults;
  },
}));

import { bootstrapDatabase, initializeDatabaseRuntime, shouldSeedDatabase } from "./bootstrap";

describe("database bootstrap ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LOCAL_RECIPE_BOOK_SEED_DATABASE;
  });

  it("initializes the database once across concurrent callers", async () => {
    const first = bootstrapDatabase();
    const second = bootstrapDatabase();

    await Promise.all([first, second]);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(ensureDatabaseSchemaMock).toHaveBeenCalledTimes(1);
  });

  it("respects seed defaults and allows an explicit runtime override", async () => {
    process.env.LOCAL_RECIPE_BOOK_SEED_DATABASE = "false";
    expect(shouldSeedDatabase()).toBe(false);

    await initializeDatabaseRuntime({ seedEnabled: true });
    expect(seedDatabaseMock).toHaveBeenCalledTimes(1);
  });
});
