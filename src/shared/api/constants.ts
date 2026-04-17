export const MEAL_TYPES = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "SNACK",
] as const;

export const DEFAULT_MEAL_TYPE_TEMPLATES = [
  {
    slug: "BREAKFAST",
    name: "Breakfast",
    color: "#E8885A",
    enabled: true,
    sortOrder: 0,
    aliases: ["breakfast"],
  },
  {
    slug: "MORNING_SNACK",
    name: "Morning Snack",
    color: "#C5A84B",
    enabled: true,
    sortOrder: 1,
    aliases: ["morning snack"],
  },
  {
    slug: "LUNCH",
    name: "Lunch",
    color: "#5A7D63",
    enabled: true,
    sortOrder: 2,
    aliases: ["lunch"],
  },
  {
    slug: "AFTERNOON_SNACK",
    name: "Afternoon Snack",
    color: "#8A7DB8",
    enabled: true,
    sortOrder: 3,
    aliases: ["afternoon snack"],
  },
  {
    slug: "DINNER",
    name: "Dinner",
    color: "#8FB7D4",
    enabled: true,
    sortOrder: 4,
    aliases: ["dinner"],
  },
  {
    slug: "SNACK",
    name: "Snack",
    color: "#6A7C91",
    enabled: false,
    sortOrder: 5,
    aliases: ["snack"],
  },
] as const;

export const MEAL_TYPE_API_PATHS = {
  active: "/api/meal-types/active",
  profiles: "/api/meal-types/profiles",
} as const;

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
