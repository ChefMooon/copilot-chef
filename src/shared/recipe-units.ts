export const RECIPE_CANONICAL_UNITS = [
  "ml",
  "l",
  "tsp",
  "tbsp",
  "fl oz",
  "cup",
  "pt",
  "qt",
  "g",
  "kg",
  "oz",
  "lb",
  "clove",
  "slice",
  "piece",
  "pinch",
  "dash",
  "count",
] as const;

export type RecipeCanonicalUnit = (typeof RECIPE_CANONICAL_UNITS)[number];

export const RECIPE_MANUAL_ENTRY_UNITS = [
  "g",
  "ml",
  "cup",
  "tbsp",
  "tsp",
  "oz",
  "lb",
  "count",
] as const;

export type RecipeManualEntryUnit = (typeof RECIPE_MANUAL_ENTRY_UNITS)[number];

export const RECIPE_UNIT_ALIASES: Record<string, RecipeCanonicalUnit> = {
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  t: "tbsp",
  "fl oz": "fl oz",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  cup: "cup",
  cups: "cup",
  pt: "pt",
  pint: "pt",
  pints: "pt",
  qt: "qt",
  quart: "qt",
  quarts: "qt",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  clove: "clove",
  cloves: "clove",
  slice: "slice",
  slices: "slice",
  piece: "piece",
  pieces: "piece",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
  count: "count",
  counts: "count",
  item: "count",
  items: "count",
  each: "count",
  ea: "count",
};

export function normalizeRecipeUnit(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return RECIPE_UNIT_ALIASES[normalized] ?? null;
}

export function isRecipeCanonicalUnit(value: string | null | undefined): value is RecipeCanonicalUnit {
  return normalizeRecipeUnit(value) !== null;
}

export function isRecipeManualEntryUnit(
  value: string | null | undefined
): value is RecipeManualEntryUnit {
  if (!value) {
    return false;
  }

  return RECIPE_MANUAL_ENTRY_UNITS.includes(value as RecipeManualEntryUnit);
}