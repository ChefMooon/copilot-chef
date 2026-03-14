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
export { ChatHistoryService } from "./services/chat-history-service";
export { GroceryService } from "./services/grocery-service";
export { MealLogService } from "./services/meal-log-service";
export { MealService } from "./services/meal-service";
export { MealPlanService } from "./services/meal-plan-service";
export {
  PreferenceService,
  type PreferenceListField,
  type PreferencesPayload,
  type PreferenceUpdateInput,
} from "./services/preference-service";
export {
  PersonaService,
  type CustomPersonaPayload,
  type CreatePersonaInput,
  type UpdatePersonaInput,
} from "./services/persona-service";
