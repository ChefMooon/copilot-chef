export {
  CopilotChef,
  buildSystemPrompt,
  type SystemPromptContext,
  COPILOT_DEFAULT_MODEL,
} from "./copilot/copilot-chef";
export { bootstrapDatabase } from "./lib/bootstrap";
export { getGreeting } from "./lib/date";
export {
  chatRequestSchema,
  chatResponseSchema,
  quickPromptSchema,
  chatChoiceSchema,
  chatActionResultSchema,
  chatJsonResponseSchema,
  type ChatChoice,
  type ChatActionResult,
  type ChatJsonResponse,
} from "./schemas/chat";
export { getClient, resetClient, stopClient } from "./lib/copilot-client";
export {
  convertIngredient,
  toBaseUnit,
  fromMl,
  fromGrams,
  getUnitCategory,
  type ConvertedQuantity,
  type UnitCategory,
  type UnitMode,
} from "./lib/unit-converter";
export {
  normalizeIngredient,
  normalizeIngredients,
  type NormalizedIngredient,
} from "./lib/ingredient-normalizer";
export {
  normalizeText,
  escapeRegex,
  findMatchingItems,
  buildItemChoices,
  resolveRelativeDate,
  normalizeMealType,
  formatMealType,
  toWeekdayName,
  toDateLabel,
  nextNights,
  snapshotFromList,
  serializeMealOps,
  parseMealOps,
  serializeSnapshot,
  parseSnapshot,
  type MealTypeValue,
  type MealShape,
  type MealForwardOp,
  type GroceryListSnapshot,
  type GrocerySnapshotItem,
} from "./lib/chat-command-utils";
export { ChatHistoryService } from "./services/chat-history-service";
export { GroceryService } from "./services/grocery-service";
export { MealService } from "./services/meal-service";
export { RecipeService, type RecipeFilters } from "./services/recipe-service";
export {
  PreferenceService,
  type PreferenceListField,
  type PreferencesPayload,
  type PreferenceUpdateInput,
} from "./services/preference-service";
export {
  CreateRecipeInputSchema,
  UpdateRecipeInputSchema,
  IngestResultSchema,
  RecipeExportJsonSchema,
  AIRecipeSaveSchema,
  type CreateRecipeInput,
  type UpdateRecipeInput,
  type RecipeExportJson,
  type IngestResult,
  type AIRecipeSave,
} from "./schemas/recipe-schemas";
export {
  PersonaService,
  type CustomPersonaPayload,
  type CreatePersonaInput,
  type UpdatePersonaInput,
} from "./services/persona-service";
