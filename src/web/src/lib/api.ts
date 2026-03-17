import {
  type CreateRecipeInput,
  type CustomPersonaPayload,
  type RecipeExportJson,
  type CreatePersonaInput,
  type PreferenceUpdateInput,
  type PreferencesPayload,
} from "@copilot-chef/core";

export type SettingsPreferences = PreferencesPayload;
export type { CustomPersonaPayload };

export type RecipePayload = {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  difficulty: string | null;
  instructions: string[];
  sourceUrl: string | null;
  sourceLabel: string | null;
  origin: string;
  rating: number | null;
  cookNotes: string | null;
  lastMadeAt: string | null;
  ingredients: Array<{
    id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
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

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
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
  const response = await fetch("/api/preferences/export", {
    method: "GET",
    cache: "no-store",
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
    {
      method: "DELETE",
    }
  );
  return response.data;
}

export async function listRecipes(query?: string) {
  const endpoint = query
    ? `/api/recipes?query=${encodeURIComponent(query)}`
    : "/api/recipes";
  const response = await fetchJson<{ data: RecipePayload[] }>(endpoint);
  return response.data;
}

export async function getRecipe(id: string) {
  const response = await fetchJson<{ data: RecipePayload }>(`/api/recipes/${id}`);
  return response.data;
}

export async function createRecipe(input: CreateRecipeInput) {
  const response = await fetchJson<{ data: RecipePayload }>("/api/recipes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateRecipe(id: string, input: Partial<CreateRecipeInput>) {
  const response = await fetchJson<{ data: RecipePayload }>(`/api/recipes/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
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

export async function ingestRecipe(url: string) {
  const response = await fetchJson<{ data: unknown }>("/api/recipes/ingest", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
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
