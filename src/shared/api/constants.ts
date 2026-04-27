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

export const CUISINE_VALUES = [
  "mediterranean",
  "japanese",
  "comfort-food",
  "mexican",
  "thai",
  "indian",
  "italian",
  "korean",
  "middle-eastern",
  "french",
  "chinese",
  "american-bbq",
] as const;

export type CuisineValue = (typeof CUISINE_VALUES)[number];

export const CUISINE_OPTIONS: Array<{ label: string; value: CuisineValue }> = [
  { label: "Mediterranean", value: "mediterranean" },
  { label: "Japanese", value: "japanese" },
  { label: "Comfort food", value: "comfort-food" },
  { label: "Mexican", value: "mexican" },
  { label: "Thai", value: "thai" },
  { label: "Indian", value: "indian" },
  { label: "Italian", value: "italian" },
  { label: "Korean", value: "korean" },
  { label: "Middle Eastern", value: "middle-eastern" },
  { label: "French", value: "french" },
  { label: "Chinese", value: "chinese" },
  { label: "American BBQ", value: "american-bbq" },
];

export function getCuisineLabel(value: string | null | undefined) {
  return CUISINE_OPTIONS.find((option) => option.value === value)?.label ?? null;
}

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
