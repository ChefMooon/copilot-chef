import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { menuExportRoutes } from "./menu-export";
import { mealService } from "../services.js";
import type { MealPayload } from "@shared/types";

vi.mock("../services.js", () => ({
  mealService: {
    listMealsInRange: vi.fn(),
  },
}));

const meal: MealPayload = {
  id: "meal-1",
  name: "Pasta Night",
  date: "2026-04-01T12:00:00.000Z",
  mealType: "DINNER",
  mealTypeDefinitionId: null,
  mealTypeDefinition: null,
  notes: null,
  ingredients: [],
  description: null,
  cuisine: null,
  instructions: [],
  servings: 2,
  prepTime: null,
  cookTime: null,
  servingsOverride: null,
  recipeId: null,
  linkedRecipe: null,
};

function createTestApp() {
  const app = new Hono();
  app.route("/api", menuExportRoutes);
  return app;
}

describe("menuExportRoutes", () => {
  beforeEach(() => {
    vi.mocked(mealService.listMealsInRange).mockReset();
    vi.mocked(mealService.listMealsInRange).mockResolvedValue([meal]);
  });

  it("returns downloadable CSV content", async () => {
    const app = createTestApp();
    const response = await app.request(
      "/api/menu-export?from=2026-04-01T00%3A00%3A00.000Z&to=2026-04-01T23%3A59%3A59.000Z&layout=compact-list&format=csv&title=Weeknight%20Menu"
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("weeknight-menu");
    expect(await response.text()).toContain("Pasta Night");
    expect(mealService.listMealsInRange).toHaveBeenCalledWith(
      "2026-04-01T00:00:00.000Z",
      "2026-04-01T23:59:59.000Z"
    );
  });

  it("omits empty day rows when includeEmptyDays is false", async () => {
    const app = createTestApp();
    const response = await app.request(
      "/api/menu-export?from=2026-04-01T00%3A00%3A00.000Z&to=2026-04-02T23%3A59%3A59.000Z&layout=compact-list&format=csv&includeEmptyDays=false"
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("2026-04-01");
    expect(body).not.toContain("2026-04-02,Thursday");
  });

  it("returns a 400 for invalid export ranges", async () => {
    const app = createTestApp();
    const response = await app.request(
      "/api/menu-export?from=2026-05-01T00%3A00%3A00.000Z&to=2026-04-01T23%3A59%3A59.000Z&layout=compact-list&format=csv"
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "MENU_EXPORT_FAILED" })
    );
  });
});
