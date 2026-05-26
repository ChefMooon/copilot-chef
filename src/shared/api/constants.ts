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

export const DEFAULT_MEAL_SUB_TYPE_TEMPLATES = [
  {
    slug: "APPETIZER",
    name: "Appetizer",
    color: "#D99B5E",
    enabled: true,
    sortOrder: 0,
  },
  {
    slug: "MAIN",
    name: "Main",
    color: "#5A7D63",
    enabled: true,
    sortOrder: 1,
  },
  {
    slug: "SIDE",
    name: "Side",
    color: "#6E8A5E",
    enabled: true,
    sortOrder: 2,
  },
  {
    slug: "DESSERT",
    name: "Dessert",
    color: "#A85774",
    enabled: true,
    sortOrder: 3,
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

export const RECIPE_SORT_BY_VALUES = [
  "updated",
  "created",
  "title",
  "cookTime",
  "rating",
  "lastMade",
  "favourite",
] as const;

export type RecipeSortByValue = (typeof RECIPE_SORT_BY_VALUES)[number];

export const RECIPE_SORT_ORDER_VALUES = ["asc", "desc"] as const;
export type RecipeSortOrderValue = (typeof RECIPE_SORT_ORDER_VALUES)[number];

export const RECIPE_SEARCH_SORT_MODE_VALUES = [
  "relevance",
  "selected",
] as const;

export type RecipeSearchSortModeValue =
  (typeof RECIPE_SEARCH_SORT_MODE_VALUES)[number];

export const RECIPE_SORT_BY_OPTIONS: Array<{
  label: string;
  value: RecipeSortByValue;
}> = [
  { label: "Recently updated", value: "updated" },
  { label: "Recently added", value: "created" },
  { label: "Title", value: "title" },
  { label: "Cook time", value: "cookTime" },
  { label: "Rating", value: "rating" },
  { label: "Last cooked", value: "lastMade" },
  { label: "Favorites", value: "favourite" },
];

export const RECIPE_DEFAULT_SORT_OPTIONS: Array<{
  label: string;
  value: string;
}> = [
  { label: "Recently updated", value: "updated_desc" },
  { label: "Recently added", value: "created_desc" },
  { label: "Title (A-Z)", value: "title_asc" },
  { label: "Cook time (shortest)", value: "cookTime_asc" },
  { label: "Rating (highest)", value: "rating_desc" },
  { label: "Last cooked", value: "lastMade_desc" },
  { label: "Favorites first", value: "favourite_desc" },
];

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

export const MEAL_SUB_TYPE_API_PATHS = {
  list: "/api/meal-sub-types",
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
