import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { groceryListsRoutes } from "./grocery-lists";
import { groceryService } from "../services.js";

vi.mock("../services.js", () => ({
  groceryService: {
    createGroceryList: vi.fn(),
  },
}));

function createTestApp() {
  const app = new Hono();
  app.route("/api", groceryListsRoutes);
  return app;
}

describe("groceryListsRoutes create", () => {
  beforeEach(() => {
    vi.mocked(groceryService.createGroceryList).mockReset();
    vi.mocked(groceryService.createGroceryList).mockResolvedValue({
      id: "list-1",
      name: "Weekly",
      date: null,
      favourite: false,
      createdAt: "2026-05-25T00:00:00.000Z",
      updatedAt: "2026-05-25T00:00:00.000Z",
      checkedCount: 0,
      totalItems: 0,
      completionPercentage: 0,
      items: [],
    } as never);
  });

  it("accepts an ongoing list payload with null date", async () => {
    const app = createTestApp();
    const response = await app.request("/api/grocery-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "  Weekly  ",
        date: null,
      }),
    });

    expect(response.status).toBe(201);
    expect(groceryService.createGroceryList).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Weekly",
        date: null,
      })
    );
  });

  it("rejects blank names", async () => {
    const app = createTestApp();
    const response = await app.request("/api/grocery-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "   ",
        date: null,
      }),
    });

    expect(response.status).toBe(400);
    expect(groceryService.createGroceryList).not.toHaveBeenCalled();
  });

  it("rejects invalid date strings", async () => {
    const app = createTestApp();
    const response = await app.request("/api/grocery-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Weekly",
        date: "not-a-date",
      }),
    });

    expect(response.status).toBe(400);
    expect(groceryService.createGroceryList).not.toHaveBeenCalled();
  });
});
