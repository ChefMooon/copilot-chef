import {
  RECIPE_MANUAL_ENTRY_UNITS,
  type RecipeManualEntryUnit,
  isRecipeManualEntryUnit,
} from "@shared/recipe-units";

const UNIT_LABELS: Record<RecipeManualEntryUnit, string> = {
  g: "Grams (g)",
  ml: "Milliliters (ml)",
  cup: "Cups",
  tbsp: "Tablespoons (tbsp)",
  tsp: "Teaspoons (tsp)",
  oz: "Ounces (oz)",
  lb: "Pounds (lb)",
  count: "Count (items)",
};

export const RECIPE_INGREDIENT_UNITS = RECIPE_MANUAL_ENTRY_UNITS.map((value) => ({
  value,
  label: UNIT_LABELS[value],
}));

export type RecipeIngredientUnit = RecipeManualEntryUnit;

export function isRecipeIngredientUnit(value: string | null | undefined): value is RecipeIngredientUnit {
  return isRecipeManualEntryUnit(value);
}