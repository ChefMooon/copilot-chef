import { describe, expect, it } from "vitest";

import {
  CreateRecipeInputSchema,
  RecipeExportJsonSchema,
} from "./recipe-schemas";

describe("recipe schemas", () => {
  const baseRecipe = {
    title: "Weeknight Tacos",
    instructions: ["Warm tortillas."],
  };

  it("accepts a cuisine from the controlled list", () => {
    const parsed = CreateRecipeInputSchema.parse({
      ...baseRecipe,
      cuisine: "mexican",
    });

    expect(parsed.cuisine).toBe("mexican");
  });

  it("rejects an unknown cuisine", () => {
    const result = CreateRecipeInputSchema.safeParse({
      ...baseRecipe,
      cuisine: "made-up-cuisine",
    });

    expect(result.success).toBe(false);
  });

  it("imports older recipe exports without cuisine", () => {
    const parsed = RecipeExportJsonSchema.parse({
      version: "1",
      exportedAt: "2026-04-27T00:00:00.000Z",
      recipes: [
        {
          title: "Legacy Soup",
          description: null,
          servings: 2,
          prepTime: null,
          cookTime: null,
          difficulty: null,
          instructions: ["Simmer."],
          sourceUrl: null,
          sourceLabel: null,
          origin: "manual",
          favourite: false,
          rating: null,
          cookNotes: null,
          lastMadeAt: null,
          tags: [],
          ingredients: [],
        },
      ],
    });

    expect(parsed.recipes[0].title).toBe("Legacy Soup");
    expect(parsed.recipes[0].cuisine).toBeUndefined();
  });
});
