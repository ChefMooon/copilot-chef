import { describe, expect, it } from "vitest";

import { chatRequestSchema } from "./chat";

describe("chatRequestSchema", () => {
  it("accepts recipes page context payloads", () => {
    const parsed = chatRequestSchema.parse({
      message: "Tell me about this recipe",
      pageContextData: {
        page: "recipes",
        search: "taco",
        origin: "imported",
        totalRecipes: 12,
        filteredRecipes: 2,
        visibleRecipes: [
          {
            id: "recipe-1",
            title: "Easy Taco Salad",
            origin: "imported",
          },
        ],
      },
    });

    expect(parsed.responseMode).toBe("auto");
    expect(parsed.pageContextData).toEqual({
      page: "recipes",
      search: "taco",
      origin: "imported",
      totalRecipes: 12,
      filteredRecipes: 2,
      visibleRecipes: [
        {
          id: "recipe-1",
          title: "Easy Taco Salad",
          origin: "imported",
        },
      ],
    });
  });

  it("accepts recipe detail page context payloads", () => {
    const parsed = chatRequestSchema.parse({
      message: "Tell me about this recipe",
      pageContextData: {
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
      },
    });

    expect(parsed.pageContextData).toEqual({
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
  });

  it("accepts shopping page context payloads", () => {
    const parsed = chatRequestSchema.parse({
      message: "How far through this list am I?",
      pageContextData: {
        page: "shopping",
        listId: "list-1",
        listName: "Weekly Groceries",
        itemCount: 4,
        checkedCount: 1,
        completionPercentage: 25,
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
      },
    });

    expect(parsed.pageContextData).toEqual({
      page: "shopping",
      listId: "list-1",
      listName: "Weekly Groceries",
      itemCount: 4,
      checkedCount: 1,
      completionPercentage: 25,
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
  });

  it("rejects recipe detail payloads missing recipeId", () => {
    const result = chatRequestSchema.safeParse({
      message: "hello",
      pageContextData: {
        page: "recipe-detail",
        title: "Missing id",
        description: null,
        difficulty: null,
        servings: 1,
        prepTime: null,
        cookTime: null,
        rating: null,
        origin: "manual",
        tags: [],
        ingredients: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported page context discriminators", () => {
    const result = chatRequestSchema.safeParse({
      message: "hello",
      pageContextData: {
        page: "calendar",
      },
    });

    expect(result.success).toBe(false);
  });
});