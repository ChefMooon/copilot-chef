import { beforeEach, describe, expect, it, vi } from "vitest";

const { bootstrapDatabaseMock, prismaMock } = vi.hoisted(() => ({
  bootstrapDatabaseMock: vi.fn().mockResolvedValue(undefined),
  prismaMock: {
    meal: {
      groupBy: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    mealTypeDefinition: {
      findUnique: vi.fn(),
    },
    recipe: {
      findUnique: vi.fn(),
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

function createMealRow(id: string, sortOrder: number) {
  return {
    id,
    name: `Meal ${id}`,
    date: new Date("2026-04-03T00:00:00.000Z"),
    mealType: "DINNER",
    sortOrder,
    mealTypeDefinitionId: null,
    mealTypeDefinition: null,
    notes: null,
    ingredientsJson: "[]",
    description: null,
    cuisine: null,
    instructionsJson: "[]",
    servings: 2,
    prepTime: null,
    cookTime: null,
    servingsOverride: null,
    recipeId: null,
    recipe: null,
  };
}

function createBankMealRow(id: string, sortOrder: number) {
  return {
    ...createMealRow(id, sortOrder),
    date: null,
    mealType: "bank",
    mealTypeDefinitionId: null,
    mealTypeDefinition: null,
    mealSubTypeDefinitionId: null,
    mealSubTypeDefinition: null,
  };
}

function createSlotMealRow(
  id: string,
  sortOrder: number,
  slot: { date: string; type: string }
) {
  return {
    ...createMealRow(id, sortOrder),
    date: new Date(slot.date),
    mealType: slot.type,
  };
}

describe("MealService.reorderSlotMeals", () => {
  beforeEach(() => {
    bootstrapDatabaseMock.mockClear();
    prismaMock.$transaction.mockReset();
  });

  it("reorders meals in a slot and rewrites sortOrder in steps of 10", async () => {
    const service = new MealService();
    const initialMeals = [createMealRow("meal-1", 10), createMealRow("meal-2", 20)];
    const updatedMeals = [createMealRow("meal-2", 10), createMealRow("meal-1", 20)];
    const tx = {
      meal: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(initialMeals)
          .mockResolvedValueOnce(updatedMeals),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx)
    );

    const result = await service.reorderSlotMeals("2026-04-03T00:00:00.000Z", "DINNER", [
      "meal-2",
      "meal-1",
    ]);

    expect(bootstrapDatabaseMock).toHaveBeenCalled();
    expect(tx.meal.update).toHaveBeenNthCalledWith(1, {
      where: { id: "meal-2" },
      data: { sortOrder: 10 },
    });
    expect(tx.meal.update).toHaveBeenNthCalledWith(2, {
      where: { id: "meal-1" },
      data: { sortOrder: 20 },
    });
    expect(result.map((meal) => [meal.id, meal.sortOrder])).toEqual([
      ["meal-2", 10],
      ["meal-1", 20],
    ]);
  });

  it("rejects reorder payloads that contain duplicate ids", async () => {
    const service = new MealService();
    const initialMeals = [createMealRow("meal-1", 10), createMealRow("meal-2", 20)];
    const tx = {
      meal: {
        findMany: vi.fn().mockResolvedValue(initialMeals),
        update: vi.fn(),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx)
    );

    await expect(
      service.reorderSlotMeals("2026-04-03T00:00:00.000Z", "DINNER", ["meal-1", "meal-1"])
    ).rejects.toThrow("Reorder payload contains duplicate meal ids.");
    expect(tx.meal.update).not.toHaveBeenCalled();
  });
});

describe("MealService meal bank operations", () => {
  beforeEach(() => {
    bootstrapDatabaseMock.mockClear();
    prismaMock.meal.findMany.mockReset();
    prismaMock.$transaction.mockReset();
  });

  it("lists unscheduled meals ordered by sortOrder", async () => {
    const service = new MealService();
    prismaMock.meal.findMany.mockResolvedValue([
      createBankMealRow("meal-2", 10),
      createBankMealRow("meal-1", 20),
    ]);

    const result = await service.listUnscheduledMeals();

    expect(prismaMock.meal.findMany).toHaveBeenCalledWith({
      where: { date: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: expect.any(Object),
    });
    expect(result.map((meal) => [meal.id, meal.date, meal.mealType])).toEqual([
      ["meal-2", null, "bank"],
      ["meal-1", null, "bank"],
    ]);
  });

  it("reorders meal bank entries and rejects meals outside the bank", async () => {
    const service = new MealService();
    const tx = {
      meal: {
        findMany: vi.fn().mockResolvedValue([createBankMealRow("meal-1", 10)]),
        update: vi.fn(),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx)
    );

    await expect(
      service.reorderUnscheduledMeals(["meal-1", "scheduled-meal"])
    ).rejects.toThrow("Reorder payload must include every meal in the meal bank exactly once.");
    expect(tx.meal.update).not.toHaveBeenCalled();
  });

  it("reorders all unscheduled meals in manual order", async () => {
    const service = new MealService();
    const initialMeals = [createBankMealRow("meal-1", 10), createBankMealRow("meal-2", 20)];
    const updatedMeals = [createBankMealRow("meal-2", 10), createBankMealRow("meal-1", 20)];
    const tx = {
      meal: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(initialMeals)
          .mockResolvedValueOnce(updatedMeals),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx)
    );

    const result = await service.reorderUnscheduledMeals(["meal-2", "meal-1"]);

    expect(tx.meal.update).toHaveBeenNthCalledWith(1, {
      where: { id: "meal-2" },
      data: { sortOrder: 10 },
    });
    expect(tx.meal.update).toHaveBeenNthCalledWith(2, {
      where: { id: "meal-1" },
      data: { sortOrder: 20 },
    });
    expect(result.map((meal) => [meal.id, meal.sortOrder])).toEqual([
      ["meal-2", 10],
      ["meal-1", 20],
    ]);
  });
});

describe("MealService.applySlotBatchAction", () => {
  beforeEach(() => {
    bootstrapDatabaseMock.mockClear();
    prismaMock.$transaction.mockReset();
  });

  it("moves a whole slot into another slot atomically", async () => {
    const service = new MealService();
    const sourceSlot = { date: "2026-04-03T12:00:00.000Z", type: "DINNER" };
    const targetSlot = { date: "2026-04-04T12:00:00.000Z", type: "LUNCH" };
    const sourceMeals = [
      createSlotMealRow("source-1", 10, sourceSlot),
      createSlotMealRow("source-2", 20, sourceSlot),
    ];
    const targetMeals = [createSlotMealRow("target-1", 10, targetSlot)];

    const tx = {
      meal: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(sourceMeals)
          .mockResolvedValueOnce(targetMeals)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            createSlotMealRow("target-1", 10, targetSlot),
            createSlotMealRow("source-1", 20, targetSlot),
            createSlotMealRow("source-2", 30, targetSlot),
          ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx)
    );

    const result = await service.applySlotBatchAction({
      action: "move",
      sourceDate: sourceSlot.date,
      sourceMealType: sourceSlot.type,
      targetDate: targetSlot.date,
      targetMealType: targetSlot.type,
    });

    expect(result.movedCount).toBe(2);
    expect(tx.meal.update).toHaveBeenNthCalledWith(1, {
      where: { id: "source-1" },
      data: {
        date: new Date(targetSlot.date),
        mealType: targetSlot.type,
        mealTypeDefinitionId: null,
        sortOrder: 20,
      },
    });
    expect(tx.meal.update).toHaveBeenNthCalledWith(2, {
      where: { id: "source-2" },
      data: {
        date: new Date(targetSlot.date),
        mealType: targetSlot.type,
        mealTypeDefinitionId: null,
        sortOrder: 30,
      },
    });
  });

  it("swaps two slots atomically", async () => {
    const service = new MealService();
    const sourceSlot = { date: "2026-04-03T12:00:00.000Z", type: "DINNER" };
    const targetSlot = { date: "2026-04-04T12:00:00.000Z", type: "LUNCH" };
    const sourceMeals = [createSlotMealRow("source-1", 10, sourceSlot)];
    const targetMeals = [createSlotMealRow("target-1", 10, targetSlot)];

    const tx = {
      meal: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(sourceMeals)
          .mockResolvedValueOnce(targetMeals)
          .mockResolvedValueOnce([createSlotMealRow("target-1", 10, sourceSlot)])
          .mockResolvedValueOnce([createSlotMealRow("source-1", 10, targetSlot)]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx)
    );

    const result = await service.applySlotBatchAction({
      action: "swap",
      sourceDate: sourceSlot.date,
      sourceMealType: sourceSlot.type,
      sourceMealTypeDefinitionId: "source-def",
      targetDate: targetSlot.date,
      targetMealType: targetSlot.type,
      targetMealTypeDefinitionId: "target-def",
    });

    expect(result.movedCount).toBe(1);
    expect(tx.meal.update).toHaveBeenNthCalledWith(1, {
      where: { id: "source-1" },
      data: {
        date: new Date(targetSlot.date),
        mealType: targetSlot.type,
        mealTypeDefinitionId: "target-def",
        sortOrder: 10,
      },
    });
    expect(tx.meal.update).toHaveBeenNthCalledWith(2, {
      where: { id: "target-1" },
      data: {
        date: new Date(sourceSlot.date),
        mealType: sourceSlot.type,
        mealTypeDefinitionId: "source-def",
        sortOrder: 10,
      },
    });
  });
});