export const RECIPE_INGREDIENT_UNITS = [
  { value: "g", label: "Grams (g)" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "cups", label: "Cups" },
  { value: "tbsp", label: "Tablespoons (tbsp)" },
  { value: "tsp", label: "Teaspoons (tsp)" },
  { value: "oz", label: "Ounces (oz)" },
  { value: "lb", label: "Pounds (lb)" },
  { value: "count", label: "Count (items)" },
] as const;

export type RecipeIngredientUnit =
  (typeof RECIPE_INGREDIENT_UNITS)[number]["value"];

export function isRecipeIngredientUnit(
  value: string | null | undefined
): value is RecipeIngredientUnit {
  return RECIPE_INGREDIENT_UNITS.some((unit) => unit.value === value);
}