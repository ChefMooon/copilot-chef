import {
  type CreateMealTypeDefinitionInput,
  type CreateMealTypeProfileInput,
  type CreateRecipeInput,
  type CustomPersonaPayload,
  type IngestResult,
  type MealTypeDefinitionPayload,
  type MealTypeProfilePayload,
  type MenuExportFormat,
  type MenuLayout,
  type RecipeConflict,
  type RecipeExportJson,
  type CreatePersonaInput,
  type PreferenceUpdateInput,
  type PreferencesPayload,
  type UpdateMealTypeDefinitionInput,
  type UpdateMealTypeProfileInput,
} from "@shared/types";
import { MEAL_TYPE_API_PATHS } from "@shared/api/constants";

import { getCachedConfig } from "./config";

export type SettingsPreferences = PreferencesPayload;
export type { CustomPersonaPayload };
export type { MealTypeDefinitionPayload, MealTypeProfilePayload };

export type RecipeListFilters = {
  query?: string;
  origin?: string;
  cuisine?: string;
  favourite?: boolean;
};

export type RecipePayload = {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  difficulty: string | null;
  cuisine: string | null;
  instructions: string[];
  sourceUrl: string | null;
  sourceLabel: string | null;
  origin: string;
  favourite: boolean;
  rating: number | null;
  cookNotes: string | null;
  lastMadeAt: string | null;
  ingredients: Array<{
    id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    group?: string | null;
    notes: string | null;
    order: number;
  }>;
  tags: string[];
  linkedSubRecipes: Array<{ id: string; title: string }>;
};

export type DetectedRegionPayload = {
  region: string | null;
  label?: string;
  error?: string;
};

type ApiErrorBody = {
  error?: string;
  code?: string;
  reason?: string;
  existing?: unknown;
};

export class ApiError<T = unknown> extends Error {
  status: number;
  code?: string;
  data?: T;

  constructor(message: string, status: number, code?: string, data?: T) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function isApiError<T = unknown>(error: unknown): error is ApiError<T> {
  return error instanceof ApiError;
}

export function isRecipeConflictError(
  error: unknown
): error is ApiError<RecipeConflict> {
  return (
    error instanceof ApiError &&
    (error.code === "RECIPE_DUPLICATE_TITLE" ||
      error.code === "RECIPE_DUPLICATE_SOURCE_URL")
  );
}

function getApiBase(): string {
  const config = getCachedConfig();
  return config?.url ?? "http://127.0.0.1:3001";
}

function getAuthHeaders(): Record<string, string> {
  const config = getCachedConfig();
  const token = config?.token ?? "";
  if (!token) return {};
  return { "Authorization": `Bearer ${token}` };
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let payload: ApiErrorBody | undefined;

    try {
      payload = (await response.json()) as ApiErrorBody;
    } catch {
      payload = undefined;
    }

    throw new ApiError(
      payload?.error ?? `Request failed with status ${response.status}`,
      response.status,
      payload?.code,
      payload as T
    );
  }

  return response.json() as Promise<T>;
}

export async function getPreferences() {
  const response = await fetchJson<{ data: SettingsPreferences }>(
    "/api/preferences"
  );
  return response.data;
}

export async function patchPreferences(patch: PreferenceUpdateInput) {
  const response = await fetchJson<{ data: SettingsPreferences }>(
    "/api/preferences",
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    }
  );
  return response.data;
}

export async function detectRegion() {
  return fetchJson<DetectedRegionPayload>("/api/preferences/detect-region");
}

export async function resetPreferences() {
  const response = await fetchJson<{ data: SettingsPreferences }>(
    "/api/preferences/reset",
    {
      method: "POST",
    }
  );
  return response.data;
}

export async function clearChatHistory() {
  const response = await fetchJson<{ data: { count: number } }>(
    "/api/chat/history",
    {
      method: "DELETE",
    }
  );
  return response.data;
}

export async function exportUserData() {
  const url = `${getApiBase()}/api/preferences/export`;
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i);

  return {
    blob,
    fileName: fileNameMatch?.[1] ?? "copilot-chef-export.json",
  };
}

export type MenuExportOptions = {
  from: string;
  to: string;
  layout: MenuLayout;
  format: MenuExportFormat;
  includeEmptyDays?: boolean;
  title?: string;
};

export async function exportMenu(options: MenuExportOptions) {
  const params = new URLSearchParams({
    from: options.from,
    to: options.to,
    layout: options.layout,
    format: options.format,
  });

  if (options.includeEmptyDays === false) {
    params.set("includeEmptyDays", "false");
  }

  if (options.title?.trim()) {
    params.set("title", options.title.trim());
  }

  const response = await fetch(`${getApiBase()}/api/menu-export?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i);

  return {
    blob,
    fileName:
      fileNameMatch?.[1] ??
      `meal-plan-menu.${options.format === "markdown" ? "md" : options.format}`,
  };
}

export async function getPersonas(): Promise<CustomPersonaPayload[]> {
  const response = await fetchJson<{ data: CustomPersonaPayload[] }>(
    "/api/personas"
  );
  return response.data;
}

export async function createPersona(
  input: CreatePersonaInput
): Promise<CustomPersonaPayload> {
  const response = await fetchJson<{ data: CustomPersonaPayload }>(
    "/api/personas",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function updatePersona(
  id: string,
  input: Partial<CreatePersonaInput>
): Promise<CustomPersonaPayload> {
  const response = await fetchJson<{ data: CustomPersonaPayload }>(
    `/api/personas/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function deletePersona(id: string): Promise<{ id: string }> {
  const response = await fetchJson<{ data: { id: string } }>(
    `/api/personas/${id}`,
    { method: "DELETE" }
  );
  return response.data;
}

export async function listRecipes(filters?: string | RecipeListFilters) {
  const params = new URLSearchParams();
  if (typeof filters === "string") {
    if (filters.trim()) {
      params.set("query", filters.trim());
    }
  } else if (filters) {
    if (filters.query?.trim()) {
      params.set("query", filters.query.trim());
    }
    if (filters.origin?.trim()) {
      params.set("origin", filters.origin.trim());
    }
    if (filters.cuisine?.trim()) {
      params.set("cuisine", filters.cuisine.trim());
    }
    if (filters.favourite !== undefined) {
      params.set("favourite", String(filters.favourite));
    }
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/api/recipes?${queryString}` : "/api/recipes";
  const response = await fetchJson<{ data: RecipePayload[] }>(endpoint);
  return response.data;
}

export async function getRecipe(id: string) {
  const response = await fetchJson<{ data: RecipePayload }>(
    `/api/recipes/${id}`
  );
  return response.data;
}

export async function createRecipe(input: CreateRecipeInput) {
  const response = await fetchJson<{ data: RecipePayload }>("/api/recipes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateRecipe(
  id: string,
  input: Partial<CreateRecipeInput>
) {
  const response = await fetchJson<{ data: RecipePayload }>(
    `/api/recipes/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function deleteRecipe(id: string) {
  return fetchJson<{ data: { id: string } }>(`/api/recipes/${id}`, {
    method: "DELETE",
  });
}

export async function duplicateRecipe(id: string) {
  const response = await fetchJson<{ data: RecipePayload }>(
    `/api/recipes/${id}/duplicate`,
    { method: "POST", body: JSON.stringify({}) }
  );
  return response.data;
}

export async function ingestRecipe(url: string): Promise<IngestResult> {
  const response = await fetchJson<{ data: IngestResult }>(
    "/api/recipes/ingest",
    {
      method: "POST",
      body: JSON.stringify({ url }),
    }
  );
  return response.data;
}

export async function confirmIngestRecipe(
  draft: CreateRecipeInput
): Promise<RecipePayload> {
  const response = await fetchJson<{ data: RecipePayload }>(
    "/api/recipes/ingest/confirm",
    {
      method: "POST",
      body: JSON.stringify(draft),
    }
  );
  return response.data;
}

export async function exportRecipes(ids?: string[]) {
  const endpoint =
    ids && ids.length > 0
      ? `/api/recipes/export?ids=${encodeURIComponent(ids.join(","))}`
      : "/api/recipes/export";
  const response = await fetchJson<{ data: RecipeExportJson }>(endpoint);
  return response.data;
}

export async function importRecipes(payload: RecipeExportJson) {
  const response = await fetchJson<{ data: unknown }>("/api/recipes/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function getActiveMealTypeProfile(date: string) {
  const response = await fetchJson<{ data: MealTypeProfilePayload | null }>(
    `${MEAL_TYPE_API_PATHS.active}?date=${encodeURIComponent(date)}`
  );
  return response.data;
}

export async function listMealTypeProfiles() {
  const response = await fetchJson<{ data: MealTypeProfilePayload[] }>(
    MEAL_TYPE_API_PATHS.profiles
  );
  return response.data;
}

export async function createMealTypeProfile(input: CreateMealTypeProfileInput) {
  const response = await fetchJson<{ data: MealTypeProfilePayload }>(
    MEAL_TYPE_API_PATHS.profiles,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function updateMealTypeProfile(
  id: string,
  input: UpdateMealTypeProfileInput
) {
  const response = await fetchJson<{ data: MealTypeProfilePayload }>(
    `${MEAL_TYPE_API_PATHS.profiles}/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function deleteMealTypeProfile(id: string) {
  const response = await fetchJson<{ data: { id: string } }>(
    `${MEAL_TYPE_API_PATHS.profiles}/${id}`,
    {
      method: "DELETE",
    }
  );
  return response.data;
}

export async function duplicateMealTypeProfile(id: string) {
  const response = await fetchJson<{ data: MealTypeProfilePayload }>(
    `${MEAL_TYPE_API_PATHS.profiles}/${id}/duplicate`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
  return response.data;
}

export async function createMealTypeDefinition(
  profileId: string,
  input: CreateMealTypeDefinitionInput
) {
  const response = await fetchJson<{ data: MealTypeDefinitionPayload }>(
    `${MEAL_TYPE_API_PATHS.profiles}/${profileId}/definitions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function updateMealTypeDefinition(
  profileId: string,
  definitionId: string,
  input: UpdateMealTypeDefinitionInput
) {
  const response = await fetchJson<{ data: MealTypeDefinitionPayload }>(
    `${MEAL_TYPE_API_PATHS.profiles}/${profileId}/definitions/${definitionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function deleteMealTypeDefinition(
  profileId: string,
  definitionId: string
) {
  const response = await fetchJson<{ data: { id: string } }>(
    `${MEAL_TYPE_API_PATHS.profiles}/${profileId}/definitions/${definitionId}`,
    {
      method: "DELETE",
    }
  );
  return response.data;
}

export async function reorderMealTypeDefinitions(
  profileId: string,
  orderedIds: string[]
) {
  const response = await fetchJson<{ data: MealTypeDefinitionPayload[] }>(
    `${MEAL_TYPE_API_PATHS.profiles}/${profileId}/definitions/order`,
    {
      method: "PUT",
      body: JSON.stringify({ orderedIds }),
    }
  );
  return response.data;
}
