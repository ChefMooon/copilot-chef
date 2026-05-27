import {
  GroceryService,
  PrepListService,
  MealService,
  MealSubTypeService,
  MealTypeService,
  PreferenceService,
  RecipeService,
} from "./core-index";

export const preferenceService = new PreferenceService();
export const groceryService = new GroceryService();
export const prepListService = new PrepListService();
export const mealService = new MealService();
export const mealSubTypeService = new MealSubTypeService();
export const mealTypeService = new MealTypeService();
export const recipeService = new RecipeService();
