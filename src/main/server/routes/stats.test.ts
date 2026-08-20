import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { statsRoutes } from "./stats";
import { mealService } from "../services.js";

vi.mock("../services.js", () => ({
  mealService: {
    getHeatmap: vi.fn(),
    getMealTypeBreakdown: vi.fn(),
    getCuisineBreakdown: vi.fn(),
    getWeeklyTrend: vi.fn(),
    getDayOfWeekBreakdown: vi.fn(),
    getPlanningWindowStats: vi.fn(),
    getTopMeals: vi.fn(),
    getTopIngredients: vi.fn(),
    getLiveMealCountInRange: vi.fn(),
  },
}));

function createTestApp() {
  const app = new Hono();
  app.route("/api", statsRoutes);
  return app;
}

describe("statsRoutes", () => {
  beforeEach(() => {
    vi.mocked(mealService.getHeatmap).mockResolvedValue({
      weeks: [],
      monthStarts: {},
      totalSlots: 3,
      totalDishes: 4,
      activeDays: 2,
      streak: 2,
    } as never);
    vi.mocked(mealService.getMealTypeBreakdown).mockResolvedValue([
      { mealType: "dinner", slotCount: 2 },
    ] as never);
    vi.mocked(mealService.getCuisineBreakdown).mockResolvedValue([] as never);
    vi.mocked(mealService.getWeeklyTrend).mockResolvedValue([] as never);
    vi.mocked(mealService.getDayOfWeekBreakdown).mockResolvedValue([] as never);
    vi.mocked(mealService.getPlanningWindowStats).mockResolvedValue({
      totalSlots: 3,
      totalDishes: 4,
      activeDays: 2,
      avgSlotsPerActiveDay: 1.5,
      avgDishesPerSlot: 1.3,
      multiCourseRate: 0.33,
    } as never);
    vi.mocked(mealService.getTopMeals).mockResolvedValue([] as never);
    vi.mocked(mealService.getTopIngredients).mockResolvedValue([] as never);
    vi.mocked(mealService.getLiveMealCountInRange).mockResolvedValue(5);
  });

  it("returns slot-based analytics fields for the stats dashboard", async () => {
    const app = createTestApp();
    const response = await app.request("/api/stats");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: expect.objectContaining({
        heatmap: expect.objectContaining({ totalSlots: 3, totalDishes: 4 }),
        mealTypeBreakdown: [{ mealType: "dinner", slotCount: 2 }],
        planningWindow: expect.objectContaining({
          totalSlots: 3,
          totalDishes: 4,
          avgDishesPerSlot: 1.3,
          multiCourseRate: 0.33,
        }),
      }),
    });
  });

  it("returns totalSlots in the current meal summary", async () => {
    const app = createTestApp();
    const response = await app.request("/api/stats/meal-summary");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.totalSlots).toBe(5);
    expect(mealService.getLiveMealCountInRange).toHaveBeenCalledTimes(1);
  });
});