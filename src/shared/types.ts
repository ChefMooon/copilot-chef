/**
 * Shared API payload types used by both the server and the renderer.
 * These are the shapes returned by / sent to the HTTP API.
 */

// ── Preferences ──────────────────────────────────────────────
export type PreferencesPayload = {
  id: string;
  createdAt: string;
  updatedAt: string;
  householdSize: number;
  cookingLength: string;
  dietaryTags: string[];
  favoriteCuisines: string[];
  avoidCuisines: string[];
  avoidIngredients: string[];
  pantryStaples: string[];
  planningNotes: string;
  nutritionTags: string[];
  skillLevel: string;
  budgetRange: string;
  chefPersona: string;
  replyLength: string;
  emojiUsage: string;
  autoImproveChef: boolean;
  contextAwareness: boolean;
  seasonalAwareness: boolean;
  seasonalRegion: string;
  proactiveTips: boolean;
  autoGenerateGrocery: boolean;
  consolidateIngredients: boolean;
  defaultPlanLength: string;
  groceryGrouping: string;
  defaultRecipeView: string;
  defaultUnitMode: string;
  saveChatHistory: boolean;
  reasoningEffort: string;
};

export type PreferenceUpdateInput = Partial<
  Omit<PreferencesPayload, "id" | "createdAt" | "updatedAt">
>;

// ── Personas ─────────────────────────────────────────────────
export type CustomPersonaPayload = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatePersonaInput = {
  emoji: string;
  title: string;
  description: string;
  prompt: string;
};

// ── Recipes ──────────────────────────────────────────────────
export type { CreateRecipeInput, IngestResult, RecipeExportJson } from "./schemas/recipe-schemas";
