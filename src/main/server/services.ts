import {
  CopilotChef,
  ChatHistoryService,
  GroceryService,
  MealService,
  MealTypeService,
  PreferenceService,
  RecipeService,
  PersonaService,
} from "./core-index";

export const chef = new CopilotChef();
export const historyService = new ChatHistoryService();
export const preferenceService = new PreferenceService();
export const groceryService = new GroceryService();
export const mealService = new MealService();
export const mealTypeService = new MealTypeService();
export const recipeService = new RecipeService();
export const personaService = new PersonaService();
