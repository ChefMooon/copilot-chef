import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mealsRoutes } from "./meals";
import { mealService } from "../services.js";

vi.mock("../services.js", () => ({
  mealService: {
    listUnscheduledMeals: vi.fn(),
    reorderUnscheduledMeals: vi.fn(),
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
    vi.mocked(mealService.listUnscheduledMeals).mockReset();
    vi.mocked(mealService.listUnscheduledMeals).mockResolvedValue([
      {
        id: "meal-bank-1",
        name: "Tacos",
        date: null,
        mealType: "bank",
        sortOrder: 10,
      },
    ] as never);
    vi.mocked(mealService.reorderUnscheduledMeals).mockReset();
    vi.mocked(mealService.reorderUnscheduledMeals).mockResolvedValue([
      {
        id: "meal-bank-2",
        name: "Soup",
        date: null,
        mealType: "bank",
        sortOrder: 10,
      },
      {
        id: "meal-bank-1",
        name: "Tacos",
        date: null,
        mealType: "bank",
        sortOrder: 20,
      },
    ] as never);
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

  it("lists unscheduled meal bank entries", async () => {
    const app = createTestApp();
    const response = await app.request("/api/meals/unscheduled");

    expect(response.status).toBe(200);
    expect(mealService.listUnscheduledMeals).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      data: [expect.objectContaining({ id: "meal-bank-1", date: null })],
    });
  });

  it("reorders unscheduled meal bank entries", async () => {
    const app = createTestApp();
    const response = await app.request("/api/meals/unscheduled/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ["meal-bank-2", "meal-bank-1"] }),
    });

    expect(response.status).toBe(200);
    expect(mealService.reorderUnscheduledMeals).toHaveBeenCalledWith([
      "meal-bank-2",
      "meal-bank-1",
    ]);
    await expect(response.json()).resolves.toEqual({
      data: {
        updated: 2,
        meals: expect.arrayContaining([
          expect.objectContaining({ id: "meal-bank-2", sortOrder: 10 }),
          expect.objectContaining({ id: "meal-bank-1", sortOrder: 20 }),
        ]),
      },
    });
  });

  it("rejects invalid meal bank reorder payloads", async () => {
    const app = createTestApp();
    const response = await app.request("/api/meals/unscheduled/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: "meal-bank-1" }),
    });

    expect(response.status).toBe(400);
    expect(mealService.reorderUnscheduledMeals).not.toHaveBeenCalled();
  });
});