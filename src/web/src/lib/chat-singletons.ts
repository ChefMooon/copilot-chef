import {
  ChatHistoryService,
  CopilotChef,
  GroceryService,
  MealService,
  PreferenceService,
} from "@copilot-chef/core";

/**
 * Shared module-level singletons for API routes.
 * In Next.js, module-level singletons persist for the lifetime of the process
 * but reset on full module reload during dev hot-reload.
 */
export const chef = new CopilotChef();
export const historyService = new ChatHistoryService();
export const preferenceService = new PreferenceService();
export const groceryService = new GroceryService();
export const mealService = new MealService();
