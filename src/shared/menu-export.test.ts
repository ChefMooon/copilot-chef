import { describe, expect, it } from "vitest";

import {
  buildMenuDocument,
  formatMenuAsCsv,
  formatMenuAsHtml,
  formatMenuAsMarkdown,
} from "./menu-export";
import type { MealPayload } from "./types";

const meal: MealPayload = {
  id: "meal-1",
  name: "Tomato Soup",
  date: "2026-04-01T12:00:00.000Z",
  mealType: "DINNER",
  mealTypeDefinitionId: "dinner",
  mealTypeDefinition: {
    id: "dinner",
    profileId: "default",
    name: "Dinner",
    slug: "DINNER",
    color: "#3b5e45",
    enabled: true,
    sortOrder: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  notes: "Serve with bread",
  ingredients: [
    { name: "tomatoes", quantity: "2", unit: "cups", group: null, notes: null, order: 0 },
  ],
  description: "A bright, simple soup.",
  cuisine: "italian",
  instructions: [],
  servings: 2,
  prepTime: null,
  cookTime: null,
  servingsOverride: null,
  recipeId: null,
  linkedRecipe: null,
};

describe("menu export formatters", () => {
  it("builds a document with empty days included", () => {
    const document = buildMenuDocument({
      meals: [meal],
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-02T23:59:59.000Z",
      layout: "classic-grid",
      title: "Test Menu",
      generatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(document.days).toHaveLength(2);
    expect(document.days[0].meals[0].name).toBe("Tomato Soup");
    expect(document.days[1].meals).toHaveLength(0);
  });

  it("can exclude days that do not contain meals", () => {
    const document = buildMenuDocument({
      meals: [meal],
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-02T23:59:59.000Z",
      layout: "classic-grid",
      includeEmptyDays: false,
      title: "Test Menu",
    });

    expect(document.days).toHaveLength(1);
    expect(document.days[0].key).toBe("2026-04-01");
  });

  it("escapes markdown content", () => {
    const document = buildMenuDocument({
      meals: [{ ...meal, name: "Soup *Special*" }],
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-01T23:59:59.000Z",
      layout: "compact-list",
      title: "Test Menu",
    });

    expect(formatMenuAsMarkdown(document)).toContain("Soup \\*Special\\*");
  });

  it("escapes CSV fields", () => {
    const document = buildMenuDocument({
      meals: [{ ...meal, name: "Soup, Tomato" }],
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-01T23:59:59.000Z",
      layout: "compact-list",
      title: "Test Menu",
    });

    expect(formatMenuAsCsv(document)).toContain('"Soup, Tomato"');
  });

  it("escapes HTML content", () => {
    const document = buildMenuDocument({
      meals: [{ ...meal, name: "Soup <Tomato>" }],
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-01T23:59:59.000Z",
      layout: "card",
      title: "Test Menu",
    });

    expect(formatMenuAsHtml(document)).toContain("Soup &lt;Tomato&gt;");
  });
});
