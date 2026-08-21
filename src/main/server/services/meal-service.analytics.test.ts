import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { bootstrapDatabaseMock, prismaMock } = vi.hoisted(() => ({
  bootstrapDatabaseMock: vi.fn().mockResolvedValue(undefined),
  prismaMock: {
    meal: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    mealTypeProfile: {
      findMany: vi.fn(),
    },
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

describe("MealService analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 10, 12, 0, 0, 0));
    bootstrapDatabaseMock.mockClear();
    prismaMock.meal.groupBy.mockReset();
    prismaMock.meal.findMany.mockReset();
    prismaMock.mealTypeProfile.findMany.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts slots separately from dishes in planning window stats", async () => {
    const service = new MealService();
    prismaMock.meal.groupBy.mockResolvedValue([
      {
        date: new Date(2026, 3, 8, 12, 0, 0, 0),
        mealType: "BREAKFAST",
        _count: { id: 1 },
      },
      {
        date: new Date(2026, 3, 8, 12, 0, 0, 0),
        mealType: "DINNER",
        _count: { id: 2 },
      },
      {
        date: new Date(2026, 3, 9, 12, 0, 0, 0),
        mealType: "LUNCH",
        _count: { id: 1 },
      },
    ]);

    await expect(service.getPlanningWindowStats(30)).resolves.toEqual({
      totalSlots: 3,
      totalDishes: 4,
      activeDays: 2,
      avgSlotsPerActiveDay: 1.5,
      avgDishesPerSlot: 1.3,
      multiCourseRate: 0.33,
    });
  });

  it("reports slot totals and dish totals independently in the heatmap", async () => {
    const service = new MealService();
    prismaMock.meal.groupBy.mockResolvedValue([
      {
        date: new Date(2026, 3, 9, 12, 0, 0, 0),
        mealType: "LUNCH",
        _count: { id: 1 },
      },
      {
        date: new Date(2026, 3, 10, 12, 0, 0, 0),
        mealType: "DINNER",
        _count: { id: 2 },
      },
    ]);

    const result = await service.getHeatmap(1);

    expect(result.totalSlots).toBe(2);
    expect(result.totalDishes).toBe(3);
    expect(result.activeDays).toBe(2);
    expect(result.streak).toBe(2);
  });

  it("counts live week slots through the exact cutoff and deduplicates dishes", async () => {
    const service = new MealService();
    prismaMock.meal.findMany.mockResolvedValue([
      { date: new Date(Date.UTC(2026, 3, 9, 12)), mealType: "DINNER", mealTypeDefinition: null },
      {
        date: new Date(Date.UTC(2026, 3, 10, 12)),
        mealType: "DINNER",
        mealTypeDefinition: { cutoffTime: "14:00" },
      },
      {
        date: new Date(Date.UTC(2026, 3, 10, 12)),
        mealType: "DINNER",
        mealTypeDefinition: { cutoffTime: "14:00" },
      },
      { date: new Date(Date.UTC(2026, 3, 11, 12)), mealType: "DINNER", mealTypeDefinition: { cutoffTime: null } },
      { date: null, mealType: "LUNCH", mealTypeDefinition: null },
    ]);

    await expect(
      service.getLiveMealCountInRange(
        "2026-04-06T00:00:00.000Z",
        "2026-04-12T23:59:59.999Z"
      )
    ).resolves.toBe(2);

    vi.setSystemTime(new Date(2026, 3, 10, 14, 0, 0, 0));
    await expect(
      service.getLiveMealCountInRange(
        "2026-04-06T00:00:00.000Z",
        "2026-04-12T23:59:59.999Z"
      )
    ).resolves.toBe(2);

    vi.setSystemTime(new Date(2026, 3, 10, 14, 1, 0, 0));
    await expect(
      service.getLiveMealCountInRange(
        "2026-04-06T00:00:00.000Z",
        "2026-04-12T23:59:59.999Z"
      )
    ).resolves.toBe(1);
  });

  it("marks passed current-day meals while retaining a mixed current-day group", async () => {
    const service = new MealService();
    prismaMock.meal.findMany.mockResolvedValue([
      {
        id: "breakfast",
        name: "Toast",
        date: new Date(Date.UTC(2026, 3, 10, 12)),
        mealType: "BREAKFAST",
        sortOrder: 0,
        mealTypeDefinitionId: null,
        mealTypeDefinition: {
          id: "breakfast-definition",
          profileId: "default",
          name: "Breakfast",
          slug: "BREAKFAST",
          color: "#000000",
          enabled: true,
          sortOrder: 0,
          cutoffTime: "10:00",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        mealSubTypeDefinitionId: null,
        mealSubTypeDefinition: null,
        notes: null,
        ingredientsJson: "[]",
        recipe: null,
      },
      {
        id: "dinner",
        name: "Pasta",
        date: new Date(Date.UTC(2026, 3, 10, 12)),
        mealType: "DINNER",
        sortOrder: 0,
        mealTypeDefinitionId: null,
        mealTypeDefinition: {
          id: "dinner-definition",
          profileId: "default",
          name: "Dinner",
          slug: "DINNER",
          color: "#000000",
          enabled: true,
          sortOrder: 1,
          cutoffTime: "14:00",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        mealSubTypeDefinitionId: null,
        mealSubTypeDefinition: null,
        notes: null,
        ingredientsJson: "[]",
        recipe: null,
      },
    ] as never);

    const meals = await service.listUpcomingMeals(
      "2026-04-10T00:00:00.000Z",
      "2026-04-10T23:59:59.999Z"
    );

    expect(meals).toHaveLength(2);
    expect(meals.map((meal) => meal.passedCutoff)).toEqual([true, false]);
  });

  it("omits a current-day group when every meal has passed its cutoff", async () => {
    const service = new MealService();
    prismaMock.meal.findMany.mockResolvedValue([
      {
        id: "breakfast",
        name: "Toast",
        date: new Date(Date.UTC(2026, 3, 10, 12)),
        mealType: "BREAKFAST",
        sortOrder: 0,
        mealTypeDefinitionId: null,
        mealTypeDefinition: {
          id: "breakfast-definition",
          profileId: "default",
          name: "Breakfast",
          slug: "BREAKFAST",
          color: "#000000",
          enabled: true,
          sortOrder: 0,
          cutoffTime: "10:00",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        mealSubTypeDefinitionId: null,
        mealSubTypeDefinition: null,
        notes: null,
        ingredientsJson: "[]",
        recipe: null,
      },
    ] as never);

    await expect(
      service.listUpcomingMeals(
        "2026-04-10T00:00:00.000Z",
        "2026-04-10T23:59:59.999Z"
      )
    ).resolves.toEqual([]);
  });

  it("resolves the cutoff for lowercase legacy meal types", async () => {
    const service = new MealService();
    prismaMock.mealTypeProfile.findMany.mockResolvedValue([
      {
        id: "default-profile",
        name: "Default",
        color: "#000000",
        description: null,
        isDefault: true,
        priority: 0,
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        mealTypes: [
          {
            id: "lunch-definition",
            profileId: "default-profile",
            name: "Lunch",
            slug: "lunch",
            color: "#000000",
            enabled: true,
            sortOrder: 0,
            cutoffTime: "10:00",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ]);
    prismaMock.meal.findMany.mockResolvedValue([
      {
        id: "legacy-lunch",
        name: "Legacy lunch",
        date: new Date(Date.UTC(2026, 3, 10, 12)),
        mealType: "lunch",
        sortOrder: 0,
        mealTypeDefinitionId: null,
        mealTypeDefinition: null,
        mealSubTypeDefinitionId: null,
        mealSubTypeDefinition: null,
        notes: null,
        ingredientsJson: "[]",
        recipe: null,
      },
    ] as never);

    await expect(
      service.listUpcomingMeals(
        "2026-04-10T00:00:00.000Z",
        "2026-04-10T23:59:59.999Z"
      )
    ).resolves.toEqual([]);
  });
});