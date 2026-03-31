/** Canonical API path constants for all route groups. */
export const ApiPaths = {
  health: "/api/health",

  // Meals
  meals: "/api/meals",
  meal: (id: string) => `/api/meals/${id}`,

  // Grocery lists
  groceryLists: "/api/grocery-lists",
  groceryList: (id: string) => `/api/grocery-lists/${id}`,
  groceryListItems: (listId: string) => `/api/grocery-lists/${listId}/items`,
  groceryListItem: (listId: string, itemId: string) =>
    `/api/grocery-lists/${listId}/items/${itemId}`,
  groceryListReorder: (listId: string) =>
    `/api/grocery-lists/${listId}/reorder`,

  // Recipes
  recipes: "/api/recipes",
  recipe: (id: string) => `/api/recipes/${id}`,
  recipeDuplicate: (id: string) => `/api/recipes/${id}/duplicate`,
  recipeRating: (id: string) => `/api/recipes/${id}/rating`,
  recipeIngest: "/api/recipes/ingest",
  recipeIngestConfirm: "/api/recipes/ingest/confirm",
  recipeExport: "/api/recipes/export",
  recipeImport: "/api/recipes/import",

  // Preferences
  preferences: "/api/preferences",
  preferencesReset: "/api/preferences/reset",
  preferencesDetectRegion: "/api/preferences/detect-region",
  preferencesExport: "/api/preferences/export",

  // Chat
  chat: "/api/chat",
  chatRespondToInput: "/api/chat/respond-to-input",
  chatEndSession: "/api/chat/end-session",
  chatHistory: "/api/chat/history",

  // Chat sessions
  chatSessions: "/api/chat-sessions",
  chatSession: (id: string) => `/api/chat-sessions/${id}`,

  // Personas
  personas: "/api/personas",
  persona: (id: string) => `/api/personas/${id}`,

  // Meal logs
  mealLogs: "/api/meal-logs",

  // Stats
  stats: "/api/stats",
  statsMealSummary: "/api/stats/meal-summary",

  // Session probe
  sessionProbe: "/api/session-probe",
} as const;
