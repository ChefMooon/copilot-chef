import { describe, expect, it } from "vitest";

import {
  buildRecipeDocument,
  DEFAULT_RECIPE_EXPORT_SELECTION,
  formatRecipeAsCsv,
  formatRecipeAsHtml,
  formatRecipeAsMarkdown,
  RECIPE_EXPORT_CSV_COLUMNS,
} from "./recipe-export";
import type { RecipePayload } from "./types";

const recipe: RecipePayload = {
  id: "recipe-1",
  title: "<Roast> Chicken",
  description: "A " + '"simple"' + " roast",
  servings: 4,
  prepTime: 15,
  cookTime: 45,
  difficulty: "Easy",
  cuisine: "French",
  instructions: ["Mix <carefully>", "Roast for 45 minutes"],
  sourceUrl: "javascript:alert(1)",
  sourceLabel: "Grandma's notes",
  origin: "manual",
  favourite: true,
  rating: 5,
  cookNotes: "Rest before serving",
  lastMadeAt: "2026-09-01T00:00:00.000Z",
  sourceRecipe: { id: "source-1", title: "Base recipe" },
  ingredients: [
    {
      id: "ingredient-1",
      name: "Flour",
      quantity: 1,
      quantityNumerator: 1,
      quantityDenominator: 1,
      unit: "cup",
      group: "Dry",
      notes: "sifted, 1/2 cup extra",
      parseConfidence: null,
      parseRaw: null,
      order: 1,
    },
    {
      id: "ingredient-2",
      name: "Salt",
      quantity: null,
      quantityNumerator: null,
      quantityDenominator: null,
      unit: null,
      group: null,
      notes: null,
      parseConfidence: null,
      parseRaw: null,
      order: 2,
    },
  ],
  tags: ["weeknight", "comfort"],
  linkedSubRecipes: [],
};

const allSelection = {
  ...DEFAULT_RECIPE_EXPORT_SELECTION,
  personalStatus: true,
  lineage: true,
};

describe("recipe export document", () => {
  it("builds a basic document from live servings and converted quantities", () => {
    const document = buildRecipeDocument({
      recipe,
      servings: 8,
      unitMode: "grams",
      selection: allSelection,
      iterations: [{ id: "derived-1", title: "Spicy Roast", parentId: "recipe-1", depth: 1 }],
      generatedAt: "2026-09-04T00:00:00.000Z",
      convertQuantity: (quantity, unit) => ({
        quantity: quantity == null ? null : quantity * 2,
        unit: unit === "cup" ? "g" : unit,
        approximate: unit === "cup",
      }),
      formatQuantity: (quantity) => String(quantity),
    });

    expect(document.layout).toBe("basic-recipe");
    expect(document.basicMetadata?.servings).toBe(8);
    expect(document.ingredients?.[0]?.ingredients[0]).toMatchObject({
      quantity: "4",
      unit: "g",
      approximate: true,
    });
    expect(document.instructions).toEqual(recipe.instructions);
    expect(document.personalStatus?.lastMadeAt).toBe(recipe.lastMadeAt);
    expect(document.lineage?.derivedRecipes).toEqual([{ id: "derived-1", title: "Spicy Roast" }]);
  });

  it("omits unselected and empty optional sections", () => {
    const document = buildRecipeDocument({
      recipe: { ...recipe, description: "", instructions: [], cookNotes: null, ingredients: [] },
      servings: 4,
      unitMode: "cup",
      selection: {
        ...DEFAULT_RECIPE_EXPORT_SELECTION,
        ingredients: true,
        instructions: false,
        description: true,
        cookNotes: true,
        basicMetadata: false,
        sourceTags: false,
      },
    });

    expect(document.description).toBeUndefined();
    expect(document.ingredients).toBeUndefined();
    expect(document.instructions).toBeUndefined();
    expect(document.cookNotes).toBeUndefined();
    expect(document.basicMetadata).toBeUndefined();
    expect(document.sourceTags).toBeUndefined();
  });

  it("escapes HTML and renders unsafe source URLs as plain text", () => {
    const document = buildRecipeDocument({ recipe, servings: 4, unitMode: "cup", selection: allSelection });
    const html = formatRecipeAsHtml(document);

    expect(html).toContain("&lt;Roast&gt; Chicken");
    expect(html).toContain("javascript:alert(1)");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("Mix &lt;carefully&gt;");

    const markdown = formatRecipeAsMarkdown({
      ...document,
      sourceTags: { ...document.sourceTags!, url: "https://example.com/recipe" },
    });
    expect(markdown).toContain("[https://example.com/recipe](https://example.com/recipe)");
  });

  it("formats raw ordered instructions and fixed-schema CSV rows", () => {
    const document = buildRecipeDocument({ recipe, servings: 4, unitMode: "cup", selection: allSelection });
    const markdown = formatRecipeAsMarkdown(document);
    const csv = formatRecipeAsCsv(document);

    expect(markdown).toContain("1. Mix <carefully>");
    expect(markdown).toContain("2. Roast for 45 minutes");
    expect(csv.split("\n")[0]).toBe(RECIPE_EXPORT_CSV_COLUMNS.join(","));
    expect(csv).toContain('"sifted, 1/2 cup extra"');
    expect(csv).toContain("ingredients,ingredient");
    expect(csv).toContain("instructions,instruction");
    expect(csv).toContain("metadata,field");
  });
});
