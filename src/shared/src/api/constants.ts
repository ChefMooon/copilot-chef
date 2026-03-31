export const MEAL_TYPES = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "SNACK",
] as const;

export const GROCERY_CATEGORIES = [
  "Produce",
  "Meat & Fish",
  "Dairy & Eggs",
  "Bakery",
  "Pantry",
  "Frozen",
  "Drinks",
  "Other",
] as const;

export const GROCERY_UNITS = [
  "",
  "pcs",
  "g",
  "kg",
  "ml",
  "L",
  "cups",
  "tbsp",
  "tsp",
  "oz",
  "lb",
  "bunches",
  "cans",
  "bags",
  "boxes",
] as const;

export const SENTINEL_PREFIX = "\x00COPILOT_CHEF_EVENT\x00";
