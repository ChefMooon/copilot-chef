import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prepListsRoutes } from "./prep-lists";
import { prepListService } from "../services.js";

vi.mock("../services.js", () => ({
  prepListService: {
    listPrepLists: vi.fn(),
    getCurrentPrepList: vi.fn(),
    getPrepList: vi.fn(),
    createPrepList: vi.fn(),
    generatePrepList: vi.fn(),
    updatePrepList: vi.fn(),
    regeneratePrepList: vi.fn(),
    deletePrepList: vi.fn(),
    createPrepItem: vi.fn(),
    updatePrepItem: vi.fn(),
    deletePrepItem: vi.fn(),
    reorderPrepItems: vi.fn(),
  },
}));

function createTestApp() {
  const app = new Hono();
  app.route("/api", prepListsRoutes);
  return app;
}

const mockList = {
  id: "prep-1",
  name: "Sunday Prep",
  notes: "Prep proteins first",
  date: "2026-05-26T12:00:00.000Z",
  fromDate: "2026-05-26T00:00:00.000Z",
  toDate: "2026-05-26T23:59:59.999Z",
  sourceMode: "day",
  sourceLabel: "2026-05-26 to 2026-05-26",
  sourceMealIds: ["meal-1"],
  sourceRecipeIds: ["recipe-1"],
  favourite: false,
  sortMode: "manual",
  groupBy: "dish",
  includeIngredients: true,
  includeTasks: true,
  includeQuantities: true,
  includeIngredientTypes: true,
  includeSourceLabels: true,
  excludePantryStaples: false,
  createdAt: "2026-05-26T00:00:00.000Z",
  updatedAt: "2026-05-26T00:00:00.000Z",
  checkedCount: 0,
  totalItems: 1,
  completionPercentage: 0,
  items: [
    {
      id: "item-1",
      kind: "ingredient",
      name: "onion",
      qty: "2",
      unit: "pcs",
      ingredientType: "Produce",
      prepGroup: null,
      dish: "Soup",
      notes: null,
      checked: false,
      sortOrder: 0,
      sourceMealIds: ["meal-1"],
      sourceRecipeIds: ["recipe-1"],
      sourceLabels: ["Soup"],
    },
  ],
};

describe("prepListsRoutes", () => {
  beforeEach(() => {
    vi.mocked(prepListService.listPrepLists).mockReset();
    vi.mocked(prepListService.getCurrentPrepList).mockReset();
    vi.mocked(prepListService.getPrepList).mockReset();
    vi.mocked(prepListService.createPrepList).mockReset();
    vi.mocked(prepListService.generatePrepList).mockReset();
    vi.mocked(prepListService.updatePrepList).mockReset();
    vi.mocked(prepListService.regeneratePrepList).mockReset();
    vi.mocked(prepListService.deletePrepList).mockReset();
    vi.mocked(prepListService.createPrepItem).mockReset();
    vi.mocked(prepListService.updatePrepItem).mockReset();
    vi.mocked(prepListService.deletePrepItem).mockReset();
    vi.mocked(prepListService.reorderPrepItems).mockReset();

    vi.mocked(prepListService.listPrepLists).mockResolvedValue([mockList] as never);
    vi.mocked(prepListService.getCurrentPrepList).mockResolvedValue(mockList as never);
    vi.mocked(prepListService.getPrepList).mockResolvedValue(mockList as never);
    vi.mocked(prepListService.createPrepList).mockResolvedValue(mockList as never);
    vi.mocked(prepListService.generatePrepList).mockResolvedValue(mockList as never);
    vi.mocked(prepListService.updatePrepList).mockResolvedValue(mockList as never);
    vi.mocked(prepListService.regeneratePrepList).mockResolvedValue(mockList as never);
    vi.mocked(prepListService.deletePrepList).mockResolvedValue({ id: mockList.id } as never);
    vi.mocked(prepListService.createPrepItem).mockResolvedValue(mockList as never);
    vi.mocked(prepListService.updatePrepItem).mockResolvedValue(mockList as never);
    vi.mocked(prepListService.deletePrepItem).mockResolvedValue(mockList as never);
    vi.mocked(prepListService.reorderPrepItems).mockResolvedValue(mockList as never);
  });

  it("creates a prep list with a null date", async () => {
    const app = createTestApp();
    const response = await app.request("/api/prep-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "  Sunday Prep  ",
        date: null,
      }),
    });

    expect(response.status).toBe(201);
    expect(prepListService.createPrepList).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Sunday Prep",
        date: null,
      })
    );
  });

  it("lists prep lists", async () => {
    const app = createTestApp();
    const response = await app.request("/api/prep-lists");

    expect(response.status).toBe(200);
    expect(prepListService.listPrepLists).toHaveBeenCalledOnce();
  });

  it("gets a prep list by id", async () => {
    const app = createTestApp();
    const response = await app.request("/api/prep-lists/prep-1");

    expect(response.status).toBe(200);
    expect(prepListService.getPrepList).toHaveBeenCalledWith("prep-1");
  });

  it("updates a prep list", async () => {
    const app = createTestApp();
    const response = await app.request("/api/prep-lists/prep-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favourite: true, groupBy: "type" }),
    });

    expect(response.status).toBe(200);
    expect(prepListService.updatePrepList).toHaveBeenCalledWith(
      "prep-1",
      expect.objectContaining({ favourite: true, groupBy: "type" })
    );
  });

  it("updates prep list notes", async () => {
    const app = createTestApp();
    const response = await app.request("/api/prep-lists/prep-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Keep sauce on side" }),
    });

    expect(response.status).toBe(200);
    expect(prepListService.updatePrepList).toHaveBeenCalledWith(
      "prep-1",
      expect.objectContaining({ notes: "Keep sauce on side" })
    );
  });

  it("generates a prep list from a day range", async () => {
    const app = createTestApp();
    const response = await app.request("/api/prep-lists/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceMode: "day",
        fromDate: "2026-05-26T00:00:00.000Z",
        toDate: "2026-05-26T23:59:59.999Z",
        date: "2026-05-26T12:00:00.000Z",
        includeIngredients: true,
      }),
    });

    expect(response.status).toBe(201);
    expect(prepListService.generatePrepList).toHaveBeenCalledWith(
      expect.objectContaining({ sourceMode: "day" })
    );
  });

  it("regenerates an existing prep list", async () => {
    const app = createTestApp();
    const response = await app.request("/api/prep-lists/prep-1/regenerate", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(prepListService.regeneratePrepList).toHaveBeenCalledWith("prep-1");
  });

  it("reorders prep items", async () => {
    const app = createTestApp();
    const response = await app.request("/api/prep-lists/prep-1/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: ["item-1"] }),
    });

    expect(response.status).toBe(200);
    expect(prepListService.reorderPrepItems).toHaveBeenCalledWith("prep-1", ["item-1"]);
  });

  it("rejects invalid reorder payloads", async () => {
    const app = createTestApp();
    const response = await app.request("/api/prep-lists/prep-1/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: "item-1" }),
    });

    expect(response.status).toBe(400);
    expect(prepListService.reorderPrepItems).not.toHaveBeenCalled();
  });

  it("deletes a prep list", async () => {
    const app = createTestApp();
    const response = await app.request("/api/prep-lists/prep-1", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(prepListService.deletePrepList).toHaveBeenCalledWith("prep-1");
  });
});