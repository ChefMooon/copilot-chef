import {
  GroceryService,
  PrepListService,
  MealService,
  MealSubTypeService,
  MealTypeService,
  PreferenceService,
  RecipeService,
} from "./core-index";

export type ApplicationServices = {
  preferenceService: PreferenceService;
  groceryService: GroceryService;
  prepListService: PrepListService;
  mealService: MealService;
  mealSubTypeService: MealSubTypeService;
  mealTypeService: MealTypeService;
  recipeService: RecipeService;
};

export function createApplicationServices(): ApplicationServices {
  const mealService = new MealService();
  const prepListService = new PrepListService({ mealService });

  return {
    preferenceService: new PreferenceService(),
    groceryService: new GroceryService(),
    prepListService,
    mealService,
    mealSubTypeService: new MealSubTypeService(),
    mealTypeService: new MealTypeService(),
    recipeService: new RecipeService(),
  };
}

const defaultServices = createApplicationServices();

// Temporary compatibility exports for legacy direct imports across routes/tests.
// Prefer createApplicationServices() for all new runtime ownership boundaries.
export const preferenceService = defaultServices.preferenceService;
export const groceryService = defaultServices.groceryService;
export const prepListService = defaultServices.prepListService;
export const mealService = defaultServices.mealService;
export const mealSubTypeService = defaultServices.mealSubTypeService;
export const mealTypeService = defaultServices.mealTypeService;
export const recipeService = defaultServices.recipeService;
