import {
  GroceryService,
  PrepListService,
  MealService,
  MealSubTypeService,
  MealTypeService,
  PreferenceService,
  RecipeService,
} from "./core-index";
import { DataManagementService } from "./services/data-management-service";

export type ApplicationServices = {
  preferenceService: PreferenceService;
  groceryService: GroceryService;
  prepListService: PrepListService;
  mealService: MealService;
  mealSubTypeService: MealSubTypeService;
  mealTypeService: MealTypeService;
  recipeService: RecipeService;
  dataManagementService: DataManagementService;
};

export function createApplicationServices(): ApplicationServices {
  const mealService = new MealService();
  const prepListService = new PrepListService({ mealService });
  const preferenceService = new PreferenceService();
  const groceryService = new GroceryService();
  const mealSubTypeService = new MealSubTypeService();
  const mealTypeService = new MealTypeService();
  const recipeService = new RecipeService();

  return {
    preferenceService,
    groceryService,
    prepListService,
    mealService,
    mealSubTypeService,
    mealTypeService,
    recipeService,
    dataManagementService: new DataManagementService({
      preferenceService,
      groceryService,
      prepListService,
      mealService,
      mealSubTypeService,
      mealTypeService,
      recipeService,
    }),
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
export const dataManagementService = defaultServices.dataManagementService;
