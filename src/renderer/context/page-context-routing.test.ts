import { describe, expect, it } from "vitest";

import { serializePageContext } from "./page-context-types";
import {
  getActivePageContext,
  getMinimalContextForPath,
} from "./page-context-routing";

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
      activeView: "detailed",
      activeUnitMode: "grams",
      cookingStepNumber: null,
    });

    expect(result).toContain("Sourdough Avocado Toast");
    expect(result).toContain("Ingredients");
    expect(result).toContain("2 slice sourdough");
    expect(result).toContain("Viewing mode: detailed");
    expect(result).toContain("Unit mode: grams");
  });

  it("serializes recipes editor draft context", () => {
    const result = serializePageContext({
      page: "recipes",
      search: "taco",
      origin: "all",
      cuisine: "all",
      totalRecipes: 10,
      favouriteCount: 2,
      filteredRecipes: 3,
      showingFavouritesOnly: false,
      visibleRecipes: [],
      recipeEditor: {
        isOpen: true,
        mode: "add",
        draft: {
          title: "Taco Bowl",
          description: null,
          servings: 4,
          ingredientCount: 6,
          instructionCount: 4,
          cuisine: "mexican",
          difficulty: "Easy",
          tagsCount: 2,
        },
      },
    });

    expect(result).toContain("Recipe editor is open");
    expect(result).toContain("title=\"Taco Bowl\"");
    expect(result).toContain("ingredients=6");
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

  it("returns active page context only when stored path matches", () => {
    const context = {
      page: "settings" as const,
    };

    expect(getActivePageContext("/settings", context, "/settings")).toEqual(
      context
    );
    expect(getActivePageContext("/recipes", context, "/settings")).toBeNull();
  });
});