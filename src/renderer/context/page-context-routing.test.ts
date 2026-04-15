import { describe, expect, it } from "vitest";

import { serializePageContext } from "./page-context-types";
import { getMinimalContextForPath } from "./page-context-routing";

describe("page context routing", () => {
  it("serializes recipe detail context", () => {
    const result = serializePageContext({
      page: "recipe-detail",
      recipeId: "recipe-1",
      title: "Sourdough Avocado Toast",
      description: "Quick breakfast with citrus and chili flakes.",
      difficulty: "easy",
      servings: 2,
      prepTime: 8,
      cookTime: 5,
      rating: 4,
      origin: "manual",
      tags: ["breakfast", "quick"],
      ingredients: [
        {
          name: "sourdough",
          quantity: 2,
          unit: "slice",
        },
      ],
    });

    expect(result).toContain("Sourdough Avocado Toast");
    expect(result).toContain("Ingredients");
    expect(result).toContain("2 slice sourdough");
  });

  it("serializes shopping context", () => {
    const result = serializePageContext({
      page: "shopping",
      listId: "list-1",
      listName: "Weekly Groceries",
      itemCount: 3,
      checkedCount: 1,
      completionPercentage: 33,
      items: [
        {
          id: "item-1",
          name: "avocado",
          qty: "1",
          unit: "piece",
          category: "Produce",
          checked: false,
        },
      ],
    });

    expect(result).toContain("Weekly Groceries");
    expect(result).toContain("33% complete");
    expect(result).toContain("avocado");
  });

  it("uses a recipe detail fallback for nested recipe routes", () => {
    expect(getMinimalContextForPath("/recipes/abc123")).toBe(
      "The user is on the Recipe Detail page, viewing a specific recipe."
    );
  });

  it("uses a shopping fallback for nested shopping routes", () => {
    expect(getMinimalContextForPath("/grocery-list/shop/abc123")).toBe(
      "The user is on the Shopping Mode page, working through a grocery list."
    );
  });
});