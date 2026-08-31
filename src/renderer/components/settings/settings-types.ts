import type { AppSettingTheme } from "@shared/config/settings";
import { RECIPE_DEFAULT_SORT_OPTIONS } from "@shared/api/constants";

export type HomeUpcomingDetail = "standard" | "detailed";
export type MealBankPlacement = "left" | "right" | "bottom";
export type RecipeDefaultSortValue =
  (typeof RECIPE_DEFAULT_SORT_OPTIONS)[number]["value"];
export type ArrayPreferenceField =
  | "dietaryTags"
  | "favoriteCuisines"
  | "avoidCuisines"
  | "avoidIngredients"
  | "pantryStaples"
  | "nutritionTags";

export type HomeDashboardSettings = {
  upcomingDays: number;
  upcomingDetail: HomeUpcomingDetail;
  upcomingCompact: boolean;
  showUpcomingMeals: boolean;
  showMealActivity: boolean;
  showGroceryList: boolean;
  showGreetingSubtitle: boolean;
};

export const HOME_DASHBOARD_DEFAULTS: HomeDashboardSettings = {
  upcomingDays: 7,
  upcomingDetail: "standard",
  upcomingCompact: false,
  showUpcomingMeals: true,
  showMealActivity: true,
  showGroceryList: true,
  showGreetingSubtitle: true,
};

export const DEFAULT_RECIPE_DEFAULT_SORT: RecipeDefaultSortValue = "updated_desc";

export const dietaryOptions = [
  { label: "Pescatarian", value: "pescatarian" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Vegan", value: "vegan" },
  { label: "Omnivore", value: "omnivore" },
  { label: "Keto", value: "keto" },
  { label: "Paleo", value: "paleo" },
  { label: "Gluten-free", value: "gluten-free" },
  { label: "Dairy-free", value: "dairy-free" },
  { label: "Halal", value: "halal" },
  { label: "Kosher", value: "kosher" },
];

export const nutritionOptions = [
  { label: "Balanced", value: "balanced" },
  { label: "High protein", value: "high-protein" },
  { label: "Low carb", value: "low-carb" },
  { label: "Low sodium", value: "low-sodium" },
  { label: "Low calorie", value: "low-calorie" },
  { label: "Anti-inflammatory", value: "anti-inflammatory" },
  { label: "Gut health", value: "gut-health" },
  { label: "Heart-healthy", value: "heart-healthy" },
];

export const cookingLengthOptions = [
  { label: "Quick (< 20 min)", value: "quick" },
  { label: "Weeknight-friendly (~30 min)", value: "weeknight" },
  { label: "Relaxed (45-60 min)", value: "relaxed" },
  { label: "Weekend projects (1 hr+)", value: "weekend" },
];

export const skillOptions = [
  { label: "Beginner", value: "beginner" },
  { label: "Home cook", value: "home-cook" },
  { label: "Confident cook", value: "confident" },
  { label: "Advanced", value: "advanced" },
];

export const budgetOptions = [
  { label: "Budget-friendly", value: "budget" },
  { label: "Moderate", value: "moderate" },
  { label: "Premium ok", value: "premium" },
];

export const recipeViewOptions = [
  { label: "Basic", value: "basic" },
  { label: "Annotated", value: "detailed" },
  { label: "Cooking", value: "cooking" },
];

export const recipeUnitOptions = [
  { label: "Cup", value: "cup" },
  { label: "Grams", value: "grams" },
];

export const homeUpcomingDetailOptions = [
  { label: "Standard", value: "standard" },
  { label: "Detailed", value: "detailed" },
];

export const mealBankPlacementOptions = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Bottom", value: "bottom" },
];

export function normalizeMealBankPlacement(input: unknown): MealBankPlacement {
  return input === "left" || input === "bottom" ? input : "right";
}

export function normalizeRecipeDefaultSort(
  input: unknown
): RecipeDefaultSortValue {
  const value = typeof input === "string" ? input : "";
  return RECIPE_DEFAULT_SORT_OPTIONS.some((option) => option.value === value)
    ? (value as RecipeDefaultSortValue)
    : DEFAULT_RECIPE_DEFAULT_SORT;
}

export function clampHomeUpcomingDays(input: unknown) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return HOME_DASHBOARD_DEFAULTS.upcomingDays;
  }

  return Math.min(30, Math.max(1, Math.floor(input)));
}

export function normalizeHomeDetail(input: unknown): HomeUpcomingDetail {
  return input === "detailed" ? "detailed" : "standard";
}

export function normalizeHomeBool(input: unknown, fallback: boolean) {
  return typeof input === "boolean" ? input : fallback;
}

export type ThemePreference = AppSettingTheme;
