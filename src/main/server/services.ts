import {
  CopilotChef,
  ChatHistoryService,
  GroceryService,
  MealService,
  PreferenceService,
  RecipeService,
  PersonaService,
  MealLogService,
} from "./core-index";

export const chef = new CopilotChef();
export const historyService = new ChatHistoryService();
export const preferenceService = new PreferenceService();
export const groceryService = new GroceryService();
export const mealService = new MealService();
export const recipeService = new RecipeService();
export const personaService = new PersonaService();
export const mealLogService = new MealLogService();
