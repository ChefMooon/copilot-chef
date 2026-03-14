import { beforeEach, describe, expect, it, vi } from "vitest";

type PreferencesState = {
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
  saveChatHistory: boolean;
};

function buildPreferences(): PreferencesState {
  return {
    id: "default",
    createdAt: "2026-03-14T00:00:00.000Z",
    updatedAt: "2026-03-14T00:00:00.000Z",
    householdSize: 3,
    cookingLength: "weeknight",
    dietaryTags: ["pescatarian"],
    favoriteCuisines: ["mediterranean"],
    avoidCuisines: ["indian"],
    avoidIngredients: ["Peanuts"],
    pantryStaples: ["Olive oil"],
    planningNotes: "Keep weeknights easy.",
    nutritionTags: ["high-protein"],
    skillLevel: "home-cook",
    budgetRange: "moderate",
    chefPersona: "coach",
    replyLength: "balanced",
    emojiUsage: "occasional",
    autoImproveChef: true,
    contextAwareness: true,
    seasonalAwareness: true,
    seasonalRegion: "eastern-us",
    proactiveTips: false,
    autoGenerateGrocery: true,
    consolidateIngredients: true,
    defaultPlanLength: "7",
    groceryGrouping: "category",
    saveChatHistory: true
  };
}

vi.mock("@copilot-chef/core", () => {
  const state = {
    preferences: buildPreferences(),
    mealLogs: [{ id: "log-1", date: "2026-03-10T00:00:00.000Z", mealType: "dinner", mealName: "Salmon", cooked: true }],
    clearCount: 2,
    updateCalls: [] as Array<Record<string, unknown>>
  };

  class PreferenceService {
    async getPreferences() {
      return state.preferences;
    }

    async updatePreferences(patch: Record<string, unknown>) {
      state.updateCalls.push(patch);
      state.preferences = {
        ...state.preferences,
        ...patch,
        updatedAt: "2026-03-14T12:00:00.000Z"
      };
      return state.preferences;
    }

    async resetPreferences() {
      state.preferences = buildPreferences();
      return state.preferences;
    }
  }

  class MealLogService {
    async listAll() {
      return state.mealLogs;
    }
  }

  class ChatHistoryService {
    async clearHistory() {
      return { count: state.clearCount };
    }
  }

  return {
    PreferenceService,
    MealLogService,
    ChatHistoryService
  };
});

import { DELETE as deleteChatHistory } from "../chat/history/route";
import { GET as detectRegionGet } from "./detect-region/route";
import { GET as exportGet } from "./export/route";
import { GET, PATCH } from "./route";
import { POST as resetPost } from "./reset/route";

describe("preferences routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the expanded preferences payload", async () => {
    const response = await GET();
    const payload = (await response.json()) as { data: PreferencesState };

    expect(payload.data.householdSize).toBe(3);
    expect(payload.data.favoriteCuisines).toEqual(["mediterranean"]);
    expect(payload.data.saveChatHistory).toBe(true);
  });

  it("accepts partial patch payloads", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ favoriteCuisines: ["japanese"], avoidCuisines: [] }),
        headers: { "Content-Type": "application/json" }
      })
    );

    const payload = (await response.json()) as { data: PreferencesState };

    expect(payload.data.favoriteCuisines).toEqual(["japanese"]);
    expect(payload.data.avoidCuisines).toEqual([]);
  });

  it("detects a mapped region from geo lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ country_code: "US", region_code: "NY" })
      })
    );

    const response = await detectRegionGet(
      new Request("http://localhost/api/preferences/detect-region", {
        headers: { "x-forwarded-for": "198.51.100.10" }
      }) as never
    );
    const payload = (await response.json()) as { region: string; label: string };

    expect(payload).toEqual({ region: "eastern-us", label: "Eastern US" });
  });

  it("returns the spec error object when detection fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

    const response = await detectRegionGet(new Request("http://localhost/api/preferences/detect-region") as never);
    const payload = (await response.json()) as { region: null; error: string };

    expect(payload).toEqual({ region: null, error: "Could not detect region" });
  });

  it("exports preferences and meal logs as a json download", async () => {
    const response = await exportGet();
    const text = await response.text();
    const payload = JSON.parse(text) as { preferences: PreferencesState; mealLogs: Array<{ id: string }> };

    expect(response.headers.get("content-disposition")).toContain("copilot-chef-export-");
    expect(payload.preferences.id).toBe("default");
    expect(payload.mealLogs).toHaveLength(1);
  });

  it("resets preferences back to defaults", async () => {
    await PATCH(
      new Request("http://localhost/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ householdSize: 5 }),
        headers: { "Content-Type": "application/json" }
      })
    );

    const response = await resetPost();
    const payload = (await response.json()) as { data: PreferencesState };

    expect(payload.data.householdSize).toBe(3);
  });

  it("clears chat history through the dedicated route", async () => {
    const response = await deleteChatHistory();
    const payload = (await response.json()) as { data: { count: number } };

    expect(payload.data.count).toBe(2);
  });
});