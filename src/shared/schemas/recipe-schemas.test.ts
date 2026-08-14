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

    expect(parsed.version).toBe("2");
    expect(parsed.recipes[0].title).toBe("Legacy Soup");
    expect(parsed.recipes[0].cuisine).toBeUndefined();
  });

  it("derives rational quantity fields for v1 exports with decimal quantities", () => {
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
          ingredients: [
            {
              name: "Flour",
              quantity: 1.5,
              unit: "cups",
              order: 0,
            },
          ],
        },
      ],
    });

    const ingredient = parsed.recipes[0]?.ingredients[0];
    expect(parsed.version).toBe("2");
    expect(ingredient?.unit).toBe("cup");
    expect(ingredient?.quantity).toBe(1.5);
    expect(ingredient?.quantityNumerator).toBe(3);
    expect(ingredient?.quantityDenominator).toBe(2);
  });

  it("preserves explicit rational quantities for v2 exports", () => {
    const parsed = RecipeExportJsonSchema.parse({
      version: "2",
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
          ingredients: [
            {
              name: "Flour",
              quantity: 1.5,
              quantityNumerator: 3,
              quantityDenominator: 2,
              unit: "cup",
              order: 0,
            },
          ],
        },
      ],
    });

    const ingredient = parsed.recipes[0]?.ingredients[0];
    expect(parsed.version).toBe("2");
    expect(ingredient?.quantityNumerator).toBe(3);
    expect(ingredient?.quantityDenominator).toBe(2);
  });

  it("normalizes unit aliases to canonical values", () => {
    const parsed = CreateRecipeInputSchema.parse({
      ...baseRecipe,
      ingredients: [
        {
          name: "Flour",
          quantity: 1,
          unit: "cups",
        },
      ],
    });

    expect(parsed.ingredients[0]?.unit).toBe("cup");
  });

  it("rejects unknown ingredient units", () => {
    const result = CreateRecipeInputSchema.safeParse({
      ...baseRecipe,
      ingredients: [
        {
          name: "Flour",
          quantity: 1,
          unit: "scoop",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires rational quantity fields to be paired", () => {
    const result = CreateRecipeInputSchema.safeParse({
      ...baseRecipe,
      ingredients: [
        {
          name: "Milk",
          quantityNumerator: 1,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts matching decimal and rational quantities", () => {
    const parsed = CreateRecipeInputSchema.parse({
      ...baseRecipe,
      ingredients: [
        {
          name: "Sugar",
          quantity: 0.5,
          quantityNumerator: 1,
          quantityDenominator: 2,
          unit: "cups",
        },
      ],
    });

    expect(parsed.ingredients[0]?.quantityNumerator).toBe(1);
    expect(parsed.ingredients[0]?.quantityDenominator).toBe(2);
    expect(parsed.ingredients[0]?.unit).toBe("cup");
  });

  it("normalizes blank source URL to null", () => {
    const parsed = CreateRecipeInputSchema.parse({
      ...baseRecipe,
      sourceUrl: "   ",
    });

    expect(parsed.sourceUrl).toBeNull();
  });

  it.each(["http://example.com/recipe", "https://example.com/recipe"]) (
    "accepts %s source URLs",
    (sourceUrl) => {
      const parsed = CreateRecipeInputSchema.parse({
        ...baseRecipe,
        sourceUrl,
      });

      expect(parsed.sourceUrl).toBe(sourceUrl);
    }
  );

  it.each(["ftp://example.com/recipe", "example.com/recipe"]) (
    "rejects %s source URLs",
    (sourceUrl) => {
      const result = CreateRecipeInputSchema.safeParse({
        ...baseRecipe,
        sourceUrl,
      });

      expect(result.success).toBe(false);
    }
  );

  it("accepts sourceRecipeId for iteration lineage", () => {
    const parsed = CreateRecipeInputSchema.parse({
      ...baseRecipe,
      sourceRecipeId: "recipe-123",
    });

    expect(parsed.sourceRecipeId).toBe("recipe-123");
  });
});
