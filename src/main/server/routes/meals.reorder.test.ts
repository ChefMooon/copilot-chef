import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mealsRoutes } from "./meals";
import { mealService } from "../services.js";

vi.mock("../services.js", () => ({
  mealService: {
    reorderSlotMeals: vi.fn(),
  },
}));

function createTestApp() {
  const app = new Hono();
  app.route("/api", mealsRoutes);
  return app;
}

describe("mealsRoutes reorder", () => {
  beforeEach(() => {
    vi.mocked(mealService.reorderSlotMeals).mockReset();
    vi.mocked(mealService.reorderSlotMeals).mockResolvedValue([
      {
        id: "meal-2",
        name: "Dessert",
        date: "2026-04-03T00:00:00.000Z",
        mealType: "DINNER",
        sortOrder: 10,
      },
      {
        id: "meal-1",
        name: "Main",
        date: "2026-04-03T00:00:00.000Z",
        mealType: "DINNER",
        sortOrder: 20,
      },
    ] as never);
  });

  it("reorders all meals in a slot", async () => {
    const app = createTestApp();
    const response = await app.request("/api/meals/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-04-03T00:00:00.000Z",
        mealType: "DINNER",
        orderedIds: ["meal-2", "meal-1"],
      }),
    });

    expect(response.status).toBe(200);
    expect(mealService.reorderSlotMeals).toHaveBeenCalledWith(
      "2026-04-03T00:00:00.000Z",
      "DINNER",
      ["meal-2", "meal-1"]
    );
    await expect(response.json()).resolves.toEqual({
      data: {
        updated: 2,
        meals: expect.arrayContaining([
          expect.objectContaining({ id: "meal-2", sortOrder: 10 }),
          expect.objectContaining({ id: "meal-1", sortOrder: 20 }),
        ]),
      },
    });
  });

  it("rejects invalid reorder payloads", async () => {
    const app = createTestApp();
    const response = await app.request("/api/meals/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealType: "DINNER", orderedIds: [] }),
    });

    expect(response.status).toBe(400);
    expect(mealService.reorderSlotMeals).not.toHaveBeenCalled();
  });
});