import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { bootstrapDatabaseMock, prismaMock } = vi.hoisted(() => ({
  bootstrapDatabaseMock: vi.fn().mockResolvedValue(undefined),
  prismaMock: {
    meal: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../lib/bootstrap", () => ({
  bootstrapDatabase: bootstrapDatabaseMock,
}));

vi.mock("../lib/prisma", () => ({
  prisma: prismaMock,
}));

import { MealService } from "./meal-service";

describe("MealService analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 10, 12, 0, 0, 0));
    bootstrapDatabaseMock.mockClear();
    prismaMock.meal.groupBy.mockReset();
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
});