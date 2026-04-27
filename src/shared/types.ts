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

export type MealTypeDefinitionPayload = {
  id: string;
  profileId: string;
  name: string;
  slug: string;
  color: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MealTypeProfilePayload = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  isDefault: boolean;
  priority: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  mealTypes: MealTypeDefinitionPayload[];
};

export type CreateMealTypeProfileInput = {
  name: string;
  color: string;
  description?: string | null;
  priority?: number;
  startDate?: string | null;
  endDate?: string | null;
};

export type UpdateMealTypeProfileInput = Partial<CreateMealTypeProfileInput>;

export type CreateMealTypeDefinitionInput = {
  name: string;
  color: string;
  enabled?: boolean;
};

export type UpdateMealTypeDefinitionInput = Partial<CreateMealTypeDefinitionInput>;

export type MealIngredient = {
  name: string;
  quantity: string | null;
  unit: string | null;
  group: string | null;
  notes: string | null;
  order: number;
};

export type MealPayload = {
  id: string;
  name: string;
  date: string | null;
  mealType: string;
  mealTypeDefinitionId: string | null;
  mealTypeDefinition: MealTypeDefinitionPayload | null;
  notes: string | null;
  ingredients: MealIngredient[];
  description: string | null;
  cuisine: string | null;
  instructions: string[];
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  servingsOverride: number | null;
  recipeId: string | null;
  linkedRecipe: {
    id: string;
    title: string;
    description: string | null;
    servings: number;
    prepTime: number | null;
    cookTime: number | null;
    cuisine: string | null;
    instructions: string[];
    cookNotes: string | null;
    ingredients: MealIngredient[];
  } | null;
};

// ── Recipes ──────────────────────────────────────────────────
export type {
  CreateRecipeInput,
  IngestResult,
  RecipeConflict,
  RecipeExportJson,
} from "./schemas/recipe-schemas";
