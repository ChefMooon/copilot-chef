import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock calls are hoisted — declare shared mock functions first via vi.hoisted
const { createSessionMock, resumeSessionMock } = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  resumeSessionMock: vi.fn(),
}));

// Mock the Copilot SDK (defineTool is used at class-build time)
vi.mock("@github/copilot-sdk", () => ({
  defineTool: (name: string, config: Record<string, unknown>) => ({
    name,
    ...config,
  }),
}));

// Mock the copilot client so no real SDK process is launched
vi.mock("../lib/copilot-client", () => ({
  getClient: vi.fn().mockResolvedValue({
    getState: vi.fn().mockReturnValue("connected"),
    createSession: createSessionMock,
    resumeSession: resumeSessionMock,
  }),
}));

import { CopilotChef } from "./copilot-chef";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeMockSession(id: string) {
  const handlers = new Map<string, (event: unknown) => void>();
  return {
    sessionId: id,
    on: vi.fn().mockImplementation((event: string, handler: (e: unknown) => void) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    }),
    send: vi.fn().mockImplementation(async () => {
      // Immediately fire turn_end so the TransformStream writer is closed
      handlers.get("assistant.turn_end")?.({});
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendAndWait: vi.fn().mockResolvedValue({ data: { content: "" } }),
  };
}

function createMinimalServices() {
  const preferences = {
    id: "default",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    householdSize: 2,
    cookingLength: "weeknight",
    dietaryTags: [],
    favoriteCuisines: [],
    avoidCuisines: [],
    avoidIngredients: [],
    pantryStaples: [],
    planningNotes: "",
    nutritionTags: [],
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
    defaultRecipeView: "basic",
    defaultUnitMode: "cup",
    saveChatHistory: false,
    reasoningEffort: "medium",
  };

  return {
    mealService: {
      listMealsInRange: vi.fn().mockResolvedValue([]),
      createMeal: vi.fn(),
      getMeal: vi.fn(),
      updateMeal: vi.fn(),
      deleteMeal: vi.fn(),
    },
    groceryService: {
      getCurrentGroceryList: vi.fn().mockResolvedValue(null),
      listGroceryLists: vi.fn().mockResolvedValue([]),
      getGroceryList: vi.fn(),
      createGroceryList: vi.fn(),
      updateGroceryList: vi.fn(),
      deleteGroceryList: vi.fn(),
      createGroceryItem: vi.fn(),
      updateGroceryItem: vi.fn(),
      deleteGroceryItem: vi.fn(),
      reorderGroceryItems: vi.fn(),
      restoreGroceryListSnapshot: vi.fn(),
    },
    historyService: {
      getSessionOwnerId: vi.fn().mockResolvedValue("web-default"),
      recordAction: vi.fn(),
      getLatestUndoAction: vi.fn(),
      getLatestRedoAction: vi.fn(),
      markActionUndone: vi.fn(),
      markActionRedone: vi.fn(),
      addPendingSuggestion: vi.fn(),
      listPendingSuggestions: vi.fn().mockResolvedValue([]),
    },
    preferenceService: {
      getPreferences: vi.fn().mockResolvedValue(preferences),
      updatePreferences: vi.fn(),
    },
    personaService: {
      findById: vi.fn().mockResolvedValue(null),
    },
    recipeService: {
      listRecipes: vi.fn().mockResolvedValue([]),
      getRecipe: vi.fn(),
      createRecipe: vi.fn(),
      deleteRecipe: vi.fn(),
    },
    mealTypeService: {
      getActiveMealTypeSummary: vi.fn().mockResolvedValue({
        profile: {
          id: "default-profile",
          name: "Default",
          startDate: null,
          endDate: null,
        },
        activeMealTypes: [
          {
            id: "default-dinner",
            name: "Dinner",
            slug: "DINNER",
            color: "#C65D3B",
          },
        ],
      }),
      resolveMealTypeForDate: vi.fn().mockImplementation(
        async (_date: string, mealType: string) => ({
          mealType,
          mealTypeDefinitionId: null,
          definition: null,
          profile: null,
        })
      ),
      getSuggestedPlanningMealType: vi.fn().mockResolvedValue({
        id: "default-dinner",
        name: "Dinner",
        slug: "DINNER",
        color: "#C65D3B",
      }),
    },
  };
}

function makeChef(services = createMinimalServices()) {
  return new CopilotChef(
    services.mealService as never,
    services.groceryService as never,
    services.historyService as never,
    services.preferenceService as never,
    services.personaService as never,
    services.recipeService as never,
    services.mealTypeService as never
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CopilotChef session lifecycle — cold-start and resume", () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    resumeSessionMock.mockReset();
  });

  it("creates a new SDK session when no sessionId is provided", async () => {
    const mockSession = makeMockSession("sdk-new-1");
    createSessionMock.mockResolvedValue(mockSession);

    const chef = makeChef();
    const result = await chef.chat("plan my week");

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(resumeSessionMock).not.toHaveBeenCalled();

    expect("stream" in result).toBe(true);
    if ("stream" in result) {
      expect(result.sessionId).toBe("sdk-new-1");
    }
  });

  it("calls resumeSession when sessionId is provided and sessions Map is empty (cold start)", async () => {
    const mockSession = makeMockSession("sdk-to-resume");
    resumeSessionMock.mockResolvedValue(mockSession);

    // Fresh CopilotChef — sessions Map is empty, simulating a process restart
    const chef = makeChef();
    const result = await chef.chat("continue my plan", "sdk-to-resume");

    expect(resumeSessionMock).toHaveBeenCalledTimes(1);
    expect(resumeSessionMock).toHaveBeenCalledWith(
      "sdk-to-resume",
      expect.objectContaining({ model: expect.any(String) })
    );
    expect(createSessionMock).not.toHaveBeenCalled();

    expect("stream" in result).toBe(true);
    if ("stream" in result) {
      expect(result.sessionId).toBe("sdk-to-resume");
    }
  });

  it("falls back to createSession and warns when resumeSession throws", async () => {
    resumeSessionMock.mockRejectedValue(new Error("Session no longer exists"));
    const fallbackSession = makeMockSession("sdk-fallback-new");
    createSessionMock.mockResolvedValue(fallbackSession);

    const chef = makeChef();
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await chef.chat("start fresh", "stale-sdk-id");

    expect(resumeSessionMock).toHaveBeenCalledWith(
      "stale-sdk-id",
      expect.any(Object)
    );
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not resume session")
    );

    expect("stream" in result).toBe(true);
    if ("stream" in result) {
      expect(result.sessionId).toBe("sdk-fallback-new");
    }

    consoleSpy.mockRestore();
  });
});
