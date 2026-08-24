import { beforeEach, describe, expect, it, vi } from "vitest";

const { bootstrapDatabaseMock, prismaMock } = vi.hoisted(() => ({
  bootstrapDatabaseMock: vi.fn().mockResolvedValue(undefined),
  prismaMock: {
    meal: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    mealTypeDefinition: {
      findUnique: vi.fn(),
    },
    mealSubTypeDefinition: {
      findUnique: vi.fn(),
    },
    recipe: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    syncState: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async ({ update }: { update: { value: string } }) => update),
    },
    $transaction: vi.fn(),
  },
}));

const {
  deleteMealPhotoFileMock,
  readMealPhotoFileMock,
  saveMealPhotoDataUrlMock,
} = vi.hoisted(() => ({
  deleteMealPhotoFileMock: vi.fn().mockResolvedValue(undefined),
  readMealPhotoFileMock: vi.fn(),
  saveMealPhotoDataUrlMock: vi.fn(),
}));

vi.mock("../lib/bootstrap", () => ({
  bootstrapDatabase: bootstrapDatabaseMock,
}));

vi.mock("../lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../lib/meal-photo-storage", () => ({
  deleteMealPhotoFile: deleteMealPhotoFileMock,
  readMealPhotoFile: readMealPhotoFileMock,
  saveMealPhotoDataUrl: saveMealPhotoDataUrlMock,
}));

import { MealService } from "./meal-service";

function createMealRow(input: {
  id: string;
  recipeId: string | null;
  date: Date | null;
}) {
  return {
    id: input.id,
    name: "Test Meal",
    date: input.date,
    mealType: "DINNER",
    sortOrder: 10,
    mealTypeDefinitionId: null,
    mealTypeDefinition: null,
    mealSubTypeDefinitionId: null,
    mealSubTypeDefinition: null,
    notes: null,
    ingredientsJson: "[]",
    description: null,
    cuisine: null,
    instructionsJson: "[]",
    servings: 2,
    prepTime: null,
    cookTime: null,
    servingsOverride: null,
    recipeId: input.recipeId,
    recipe: null,
    photoDataUrl: null,
    photoPath: null,
    photoMimeType: null,
    photoFileName: null,
    createdAt: new Date("2026-05-20T12:00:00.000Z"),
  };
}

describe("MealService recipe last-made sync", () => {
  beforeEach(() => {
    bootstrapDatabaseMock.mockClear();
    prismaMock.$transaction.mockReset();
    prismaMock.meal.findUnique.mockReset();
    prismaMock.meal.create.mockReset();
    prismaMock.meal.update.mockReset();
    prismaMock.meal.aggregate.mockReset();
    prismaMock.recipe.findUnique.mockReset();
    prismaMock.recipe.update.mockReset();
    prismaMock.mealTypeDefinition.findUnique.mockReset();
    prismaMock.mealSubTypeDefinition.findUnique.mockReset();
  });

  it("syncs recipe lastMadeAt after creating a linked meal", async () => {
    const service = new MealService();
    const createdMeal = createMealRow({
      id: "meal-1",
      recipeId: "recipe-1",
      date: new Date("2026-05-22T12:00:00.000Z"),
    });

    const tx = {
      meal: {
        aggregate: vi.fn().mockResolvedValue({ _max: { date: createdMeal.date } }),
        create: vi.fn().mockResolvedValue(createdMeal),
      },
      recipe: {
        update: vi.fn().mockResolvedValue(undefined),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx)
    );

    await service.createMeal({
      name: "Test Meal",
      date: "2026-05-22T00:00:00.000Z",
      mealType: "dinner",
      sortOrder: 10,
      recipeId: "recipe-1",
      cuisine: null,
    });

    expect(tx.meal.aggregate).toHaveBeenCalledWith({
      where: {
        recipeId: "recipe-1",
        date: { not: null },
      },
      _max: { date: true },
    });
    expect(tx.recipe.update).toHaveBeenCalledWith({
      where: { id: "recipe-1" },
      data: { lastMadeAt: createdMeal.date },
    });
  });

  it("re-syncs both recipes when a meal is relinked", async () => {
    const service = new MealService();
    const existingMeal = {
      id: "meal-1",
      photoPath: null,
      photoDataUrl: null,
      recipeId: "recipe-old",
    };
    const updatedMeal = createMealRow({
      id: "meal-1",
      recipeId: "recipe-new",
      date: new Date("2026-05-24T12:00:00.000Z"),
    });

    prismaMock.meal.findUnique.mockResolvedValue(existingMeal);
    prismaMock.meal.update.mockResolvedValue(updatedMeal);
    prismaMock.meal.aggregate
      .mockResolvedValueOnce({ _max: { date: new Date("2026-05-18T12:00:00.000Z") } })
      .mockResolvedValueOnce({ _max: { date: new Date("2026-05-24T12:00:00.000Z") } });

    await service.updateMeal("meal-1", {
      recipeId: "recipe-new",
      cuisine: null,
    });

    expect(prismaMock.meal.aggregate).toHaveBeenCalledTimes(2);
    expect(prismaMock.recipe.update).toHaveBeenCalledWith({
      where: { id: "recipe-old" },
      data: { lastMadeAt: new Date("2026-05-18T12:00:00.000Z") },
    });
    expect(prismaMock.recipe.update).toHaveBeenCalledWith({
      where: { id: "recipe-new" },
      data: { lastMadeAt: new Date("2026-05-24T12:00:00.000Z") },
    });
  });
});
