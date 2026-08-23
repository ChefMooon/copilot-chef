import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mealsRoutes } from "./meals";
import { mealService } from "../services.js";

vi.mock("../services.js", () => ({
  mealService: {
    listUpcomingMeals: vi.fn(),
  },
}));

function createTestApp() {
  const app = new Hono();
  app.route("/api", mealsRoutes);
  return app;
}

describe("mealsRoutes upcoming meals", () => {
  beforeEach(() => {
    vi.mocked(mealService.listUpcomingMeals).mockResolvedValue([] as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the requested local date range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T15:30:00.000Z"));
    const app = createTestApp();

    const response = await app.request("/api/meals/upcoming?days=14");
    const expectedFrom = new Date();
    expectedFrom.setHours(0, 0, 0, 0);
    const expectedTo = new Date(expectedFrom);
    expectedTo.setDate(expectedTo.getDate() + 13);
    expectedTo.setHours(23, 59, 59, 999);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        days: 14,
        from: expectedFrom.toISOString(),
        to: expectedTo.toISOString(),
        meals: [],
      },
    });
    expect(mealService.listUpcomingMeals).toHaveBeenCalledWith(
      expectedFrom.toISOString(),
      expectedTo.toISOString()
    );
  });
});
