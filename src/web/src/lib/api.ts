import {
  type CustomPersonaPayload,
  type CreatePersonaInput,
  type PreferenceUpdateInput,
  type PreferencesPayload,
} from "@copilot-chef/core";

export type SettingsPreferences = PreferencesPayload;
export type { CustomPersonaPayload };

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
