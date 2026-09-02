type MealPlanRouteModule = typeof import("../pages/meal-plan");

let mealPlanRoutePromise: Promise<MealPlanRouteModule> | undefined;

export function importMealPlanRoute() {
  if (!mealPlanRoutePromise) {
    mealPlanRoutePromise = import("../pages/meal-plan");
  }

  return mealPlanRoutePromise;
}

export function preloadMealPlanRoute() {
  return importMealPlanRoute();
}
