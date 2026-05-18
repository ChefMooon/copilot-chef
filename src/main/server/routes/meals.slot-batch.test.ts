import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mealsRoutes } from "./meals";
import { mealService } from "../services.js";

vi.mock("../services.js", () => ({
  mealService: {
    applySlotBatchAction: vi.fn(),
  },
}));

function createTestApp() {
  const app = new Hono();
  app.route("/api", mealsRoutes);
  return app;
}

describe("mealsRoutes slot-batch", () => {
  beforeEach(() => {
    vi.mocked(mealService.applySlotBatchAction).mockReset();
    vi.mocked(mealService.applySlotBatchAction).mockResolvedValue({
      action: "move",
      sourceMeals: [],
      targetMeals: [{ id: "meal-1" }],
      movedCount: 2,
    } as never);
  });

  it("applies a transactional slot move", async () => {
    const app = createTestApp();
    const response = await app.request("/api/meals/slot-batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move",
        source: {
          date: "2026-04-03T12:00:00.000Z",
          mealType: "DINNER",
          mealTypeDefinitionId: "source-def",
        },
        target: {
          date: "2026-04-04T12:00:00.000Z",
          mealType: "LUNCH",
          mealTypeDefinitionId: "target-def",
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(mealService.applySlotBatchAction).toHaveBeenCalledWith({
      action: "move",
      sourceDate: "2026-04-03T12:00:00.000Z",
      sourceMealType: "DINNER",
      sourceMealTypeDefinitionId: "source-def",
      targetDate: "2026-04-04T12:00:00.000Z",
      targetMealType: "LUNCH",
      targetMealTypeDefinitionId: "target-def",
    });

    await expect(response.json()).resolves.toEqual({
      data: {
        action: "move",
        sourceCount: 0,
        targetCount: 1,
        movedCount: 2,
      },
    });
  });

  it("rejects invalid slot-batch payloads", async () => {
    const app = createTestApp();
    const response = await app.request("/api/meals/slot-batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move",
        source: { date: "2026-04-03T12:00:00.000Z" },
      }),
    });

    expect(response.status).toBe(400);
    expect(mealService.applySlotBatchAction).not.toHaveBeenCalled();
  });

  it("returns 400 when slot-batch service throws", async () => {
    vi.mocked(mealService.applySlotBatchAction).mockRejectedValueOnce(
      new Error("Source slot has no meals to move.")
    );

    const app = createTestApp();
    const response = await app.request("/api/meals/slot-batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "swap",
        source: {
          date: "2026-04-03T12:00:00.000Z",
          mealType: "DINNER",
        },
        target: {
          date: "2026-04-04T12:00:00.000Z",
          mealType: "LUNCH",
        },
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Source slot has no meals to move.",
    });
  });
});
