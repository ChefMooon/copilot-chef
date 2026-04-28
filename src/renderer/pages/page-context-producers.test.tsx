// @vitest-environment jsdom

import { useEffect } from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/pages/home";
import MealPlanPage from "@/pages/meal-plan";
import GroceryListPage from "@/pages/grocery-list";
import GroceryShopPage from "@/pages/grocery-list/shop";
import RecipesPage from "@/pages/recipes";
import RecipeDetailPage from "@/pages/recipes/detail";
import SettingsPage from "@/pages/settings";
import { StatsDashboard, type StatsPayload } from "@/components/stats/StatsDashboard";

const chatMocks = vi.hoisted(() => ({
  useChatPageContext: vi.fn(),
  clearSession: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  listRecipes: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  exportRecipes: vi.fn(),
  importRecipes: vi.fn(),
  confirmIngestRecipe: vi.fn(),
  getPreferences: vi.fn(),
  patchPreferences: vi.fn(),
  resetPreferences: vi.fn(),
  getPersonas: vi.fn(),
  createPersona: vi.fn(),
  updatePersona: vi.fn(),
  deletePersona: vi.fn(),
  clearChatHistory: vi.fn(),
  detectRegion: vi.fn(),
  exportUserData: vi.fn(),
}));

const configMocks = vi.hoisted(() => ({
  loadServerConfig: vi.fn(),
  getCachedConfig: vi.fn(),
  resetConfigCache: vi.fn(),
}));

vi.mock("@/context/chat-context", () => ({
  useChatPageContext: chatMocks.useChatPageContext,
  useChatContext: () => ({
    clearSession: chatMocks.clearSession,
  }),
}));

vi.mock("@/lib/api", () => ({
  fetchJson: apiMocks.fetchJson,
  listRecipes: apiMocks.listRecipes,
  createRecipe: apiMocks.createRecipe,
  updateRecipe: apiMocks.updateRecipe,
  deleteRecipe: apiMocks.deleteRecipe,
  exportRecipes: apiMocks.exportRecipes,
  importRecipes: apiMocks.importRecipes,
  confirmIngestRecipe: apiMocks.confirmIngestRecipe,
  getPreferences: apiMocks.getPreferences,
  patchPreferences: apiMocks.patchPreferences,
  resetPreferences: apiMocks.resetPreferences,
  getPersonas: apiMocks.getPersonas,
  createPersona: apiMocks.createPersona,
  updatePersona: apiMocks.updatePersona,
  deletePersona: apiMocks.deletePersona,
  clearChatHistory: apiMocks.clearChatHistory,
  detectRegion: apiMocks.detectRegion,
  exportUserData: apiMocks.exportUserData,
}));

vi.mock("@/lib/config", () => ({
  loadServerConfig: configMocks.loadServerConfig,
  getCachedConfig: configMocks.getCachedConfig,
  resetConfigCache: configMocks.resetConfigCache,
}));

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({
    toast: vi.fn(),
    dismissAll: vi.fn(),
    setDragging: vi.fn(),
  }),
}));

vi.mock("@/lib/use-meal-types", () => ({
  useMealTypeProfiles: () => ({
    data: [
      {
        id: "profile-1",
        name: "Default",
        color: "#3B5E45",
        description: null,
        isDefault: true,
        priority: 0,
        startDate: null,
        endDate: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        mealTypes: [
          {
            id: "def-breakfast",
            profileId: "profile-1",
            name: "Breakfast",
            slug: "breakfast",
            color: "#F59E0B",
            enabled: true,
            sortOrder: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/components/meal-plan/DayView", () => ({ DayView: () => null }));
vi.mock("@/components/meal-plan/WeekView", () => ({ WeekView: () => null }));
vi.mock("@/components/meal-plan/MonthView", () => ({ MonthView: () => null }));
vi.mock("@/components/meal-plan/EditModal", () => ({ EditModal: () => null }));
vi.mock("@/components/meal-plan/DeleteConfirmationModal", () => ({
  DeleteConfirmationModal: () => null,
}));
vi.mock("@/components/meal-plan/TrashDropZone", () => ({
  TrashDropZone: () => null,
}));

vi.mock("@/components/grocery-list/ListEditor", () => ({
  ListEditor: () => null,
}));
vi.mock("@/components/grocery-list/ListsSidebar", () => ({
  ListsSidebar: () => null,
}));
vi.mock("@/components/grocery-list/NewListModal", () => ({
  NewListModal: () => null,
}));
vi.mock("@/components/grocery-list/QuickReference", () => ({
  QuickReference: () => null,
}));

vi.mock("@/components/recipes/RecipeFilterSidebar", () => ({
  RecipeFilterSidebar: () => null,
}));
vi.mock("@/components/recipes/RecipeGrid", () => ({
  RecipeGrid: () => null,
}));
vi.mock("@/components/recipes/IngestModal", () => ({ IngestModal: () => null }));
vi.mock("@/components/recipes/RecipeExportModal", () => ({
  RecipeExportModal: () => null,
}));
vi.mock("@/components/recipes/RecipeDetail", () => ({
  RecipeDetail: ({ onContextStateChange }: { onContextStateChange?: (state: {
    activeView: "basic" | "detailed" | "cooking";
    activeUnitMode: "cup" | "grams";
    cookingStepNumber: number | null;
  }) => void }) => {
    useEffect(() => {
      onContextStateChange?.({
        activeView: "cooking",
        activeUnitMode: "grams",
        cookingStepNumber: 2,
      });
    }, [onContextStateChange]);

    return null;
  },
}));
vi.mock("@/components/recipes/AddRecipeModal", () => ({
  AddRecipeModal: ({
    open,
    onDraftContextChange,
  }: {
    open: boolean;
    onDraftContextChange?: (draft: {
      title: string;
      description: string | null;
      servings: number | null;
      ingredientCount: number;
      instructionCount: number;
      cuisine: string | null;
      difficulty: string | null;
      tagsCount: number;
    } | null) => void;
  }) => {
    useEffect(() => {
      if (!onDraftContextChange) {
        return;
      }

      if (!open) {
        onDraftContextChange(null);
        return;
      }

      onDraftContextChange({
        title: "Draft Recipe",
        description: null,
        servings: 3,
        ingredientCount: 5,
        instructionCount: 4,
        cuisine: "mexican",
        difficulty: "Easy",
        tagsCount: 2,
      });
    }, [onDraftContextChange, open]);

    return null;
  },
}));

vi.mock("@/components/settings/PersonaModal", () => ({ PersonaModal: () => null }));
vi.mock("@/components/settings/MealTypesSection", () => ({
  MealTypesSection: () => null,
}));
vi.mock("@/components/settings/ChipList", () => ({ ChipList: () => null }));
vi.mock("@/components/settings/CollapsibleSection", () => ({
  CollapsibleSection: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@/components/settings/PersonaGrid", () => ({ PersonaGrid: () => null }));
vi.mock("@/components/settings/SegmentedControl", () => ({
  SegmentedControl: () => null,
}));
vi.mock("@/components/settings/TagCloud", () => ({ TagCloud: () => null }));
vi.mock("@/components/settings/ToggleSwitch", () => ({
  ToggleSwitch: () => null,
}));

function renderWithProviders(node: React.ReactNode, route = "/") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

function contextForPage(page: string) {
  const calls = chatMocks.useChatPageContext.mock.calls.map((call) => call[0]);
  return [...calls].reverse().find((entry) => entry?.page === page);
}

const basePreferences = {
  id: "pref-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
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
  replyLength: "normal",
  emojiUsage: "light",
  autoImproveChef: true,
  contextAwareness: true,
  seasonalAwareness: true,
  seasonalRegion: "US",
  proactiveTips: true,
  autoGenerateGrocery: true,
  consolidateIngredients: true,
  defaultPlanLength: "week",
  groceryGrouping: "category",
  defaultRecipeView: "basic",
  defaultUnitMode: "cup",
  saveChatHistory: true,
  reasoningEffort: "medium",
};

describe("page context producers", () => {
  beforeEach(() => {
    chatMocks.useChatPageContext.mockReset();
    chatMocks.clearSession.mockReset();

    apiMocks.fetchJson.mockReset();
    apiMocks.listRecipes.mockReset();
    apiMocks.createRecipe.mockReset();
    apiMocks.updateRecipe.mockReset();
    apiMocks.deleteRecipe.mockReset();
    apiMocks.exportRecipes.mockReset();
    apiMocks.importRecipes.mockReset();
    apiMocks.confirmIngestRecipe.mockReset();
    apiMocks.getPreferences.mockReset();
    apiMocks.patchPreferences.mockReset();
    apiMocks.resetPreferences.mockReset();
    apiMocks.getPersonas.mockReset();
    apiMocks.createPersona.mockReset();
    apiMocks.updatePersona.mockReset();
    apiMocks.deletePersona.mockReset();
    apiMocks.clearChatHistory.mockReset();
    apiMocks.detectRegion.mockReset();
    apiMocks.exportUserData.mockReset();

    configMocks.loadServerConfig.mockReset();
    configMocks.getCachedConfig.mockReset();
    configMocks.resetConfigCache.mockReset();

    configMocks.loadServerConfig.mockResolvedValue({
      mode: "local",
      url: "http://127.0.0.1:3001",
      token: "test-token",
    });
    configMocks.getCachedConfig.mockReturnValue({
      mode: "local",
      url: "http://127.0.0.1:3001",
      token: "test-token",
    });

    apiMocks.listRecipes.mockResolvedValue([]);
    apiMocks.createRecipe.mockResolvedValue(undefined);
    apiMocks.updateRecipe.mockResolvedValue(undefined);
    apiMocks.deleteRecipe.mockResolvedValue(undefined);
    apiMocks.exportRecipes.mockResolvedValue({});
    apiMocks.importRecipes.mockResolvedValue(undefined);
    apiMocks.confirmIngestRecipe.mockResolvedValue(undefined);

    apiMocks.getPreferences.mockResolvedValue(basePreferences);
    apiMocks.patchPreferences.mockResolvedValue(basePreferences);
    apiMocks.resetPreferences.mockResolvedValue(basePreferences);
    apiMocks.getPersonas.mockResolvedValue([]);
    apiMocks.createPersona.mockResolvedValue({
      id: "persona-1",
      emoji: "🧑‍🍳",
      title: "Chef",
      description: "desc",
      prompt: "prompt",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    apiMocks.updatePersona.mockResolvedValue(undefined);
    apiMocks.deletePersona.mockResolvedValue(undefined);
    apiMocks.clearChatHistory.mockResolvedValue(undefined);
    apiMocks.detectRegion.mockResolvedValue({ region: "US" });
    apiMocks.exportUserData.mockResolvedValue(undefined);

    apiMocks.fetchJson.mockResolvedValue({ data: [] });

    (window as unknown as { api: unknown }).api = {
      invoke: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
    };

    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {
        // no-op for chart layout in tests
      }

      unobserve() {
        // no-op for chart layout in tests
      }

      disconnect() {
        // no-op for chart layout in tests
      }
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("captures Home page context from dashboard data", async () => {
    apiMocks.fetchJson.mockImplementation(async (url: string) => {
      if (url === "/api/stats/meal-summary") {
        return { data: { from: "2026-04-21", to: "2026-04-27", totalMeals: 5 } };
      }
      if (url === "/api/grocery-lists?current=1") {
        return {
          data: {
            id: "list-1",
            name: "Weekly Groceries",
            createdAt: "2026-04-20T00:00:00.000Z",
            checkedCount: 3,
            totalItems: 10,
            completionPercentage: 30,
          },
        };
      }
      if (url === "/api/meals/heatmap?weeks=13") {
        return { data: { weeks: [], monthStarts: {} } };
      }

      throw new Error(`Unhandled URL: ${url}`);
    });

    renderWithProviders(<HomePage />);

    await waitFor(() => {
      expect(contextForPage("home")).toEqual(
        expect.objectContaining({
          page: "home",
          totalMeals: 5,
          groceryListName: "Weekly Groceries",
          groceryCompletion: 30,
        })
      );
    });
  });

  it("captures Meal Plan context for visible meals", async () => {
    apiMocks.fetchJson.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/meals?from=")) {
        return {
          data: [
            {
              id: "meal-1",
              name: "Taco Night",
              date: "2026-04-28T12:00:00.000Z",
              mealType: "dinner",
              mealTypeDefinitionId: null,
              mealTypeDefinition: null,
              notes: null,
              ingredients: [],
              description: null,
              cuisine: "mexican",
              instructions: [],
              servings: 2,
              prepTime: null,
              cookTime: null,
              servingsOverride: null,
              recipeId: null,
              linkedRecipe: null,
            },
          ],
        };
      }

      throw new Error(`Unhandled URL: ${url}`);
    });

    renderWithProviders(<MealPlanPage />);

    await waitFor(() => {
      const context = contextForPage("meal-plan");
      expect(context).toEqual(
        expect.objectContaining({
          page: "meal-plan",
          view: "week",
        })
      );
      expect(context?.meals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "meal-1",
            name: "Taco Night",
            mealType: "dinner",
          }),
        ])
      );
    });
  });

  it("captures Grocery List context for selected list", async () => {
    apiMocks.fetchJson.mockImplementation(async (url: string) => {
      if (url === "/api/grocery-lists") {
        return {
          data: [
            {
              id: "list-1",
              name: "Weekly Groceries",
              date: "2026-04-28T00:00:00.000Z",
              createdAt: "2026-04-20T00:00:00.000Z",
              updatedAt: "2026-04-28T00:00:00.000Z",
              favourite: false,
              itemCount: 2,
              totalItems: 2,
              checkedCount: 1,
              completionPercentage: 50,
              items: [
                {
                  id: "item-1",
                  name: "Avocado",
                  qty: "2",
                  unit: "piece",
                  category: "Produce",
                  checked: false,
                  notes: null,
                  meal: null,
                  order: 0,
                },
              ],
            },
          ],
        };
      }

      throw new Error(`Unhandled URL: ${url}`);
    });

    renderWithProviders(<GroceryListPage />);

    await waitFor(() => {
      const context = contextForPage("grocery-list");
      expect(context).toEqual(
        expect.objectContaining({
          page: "grocery-list",
          activeList: expect.objectContaining({
            id: "list-1",
            name: "Weekly Groceries",
            totalItems: 2,
            checkedCount: 1,
          }),
        })
      );
    });
  });

  it("captures Shopping context for the active list", async () => {
    apiMocks.fetchJson.mockImplementation(async (url: string) => {
      if (url === "/api/grocery-lists/list-1") {
        return {
          data: {
            id: "list-1",
            name: "Weekly Groceries",
            date: "2026-04-28T00:00:00.000Z",
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-28T00:00:00.000Z",
            favourite: false,
            itemCount: 2,
            totalItems: 2,
            checkedCount: 1,
            completionPercentage: 50,
            items: [
              {
                id: "item-1",
                name: "Avocado",
                qty: "2",
                unit: "piece",
                category: "Produce",
                checked: false,
                notes: null,
                meal: null,
                order: 0,
              },
            ],
          },
        };
      }

      throw new Error(`Unhandled URL: ${url}`);
    });

    renderWithProviders(
      <Routes>
        <Route element={<GroceryShopPage />} path="/grocery-list/shop/:id" />
      </Routes>,
      "/grocery-list/shop/list-1"
    );

    await waitFor(() => {
      expect(contextForPage("shopping")).toEqual(
        expect.objectContaining({
          page: "shopping",
          listId: "list-1",
          listName: "Weekly Groceries",
          itemCount: 1,
        })
      );
    });
  });

  it("captures Recipes page context including editor draft state", async () => {
    apiMocks.listRecipes.mockResolvedValue([
      {
        id: "recipe-1",
        title: "Easy Taco Salad",
        description: "Crisp and quick",
        servings: 2,
        sourceUrl: null,
        sourceLabel: null,
        ingredients: [
          {
            id: "ing-1",
            name: "Avocado",
            quantity: 1,
            unit: "piece",
            group: null,
            notes: null,
            order: 0,
          },
        ],
        instructions: ["Mix ingredients"],
        tags: ["quick"],
        origin: "manual",
        favourite: true,
        prepTime: 10,
        cookTime: null,
        difficulty: "Easy",
        cuisine: "mexican",
        rating: 4,
        cookNotes: null,
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-28T00:00:00.000Z",
      },
    ]);

    const view = renderWithProviders(<RecipesPage />);

    await waitFor(() => {
      expect(contextForPage("recipes")).toEqual(
        expect.objectContaining({
          page: "recipes",
          totalRecipes: 1,
          visibleRecipes: expect.arrayContaining([
            expect.objectContaining({ id: "recipe-1" }),
          ]),
          recipeEditor: expect.objectContaining({
            isOpen: false,
            mode: "add",
            draft: null,
          }),
        })
      );
    });

    fireEvent.click(view.getByRole("button", { name: "Add Recipe" }));

    await waitFor(() => {
      expect(contextForPage("recipes")).toEqual(
        expect.objectContaining({
          page: "recipes",
          recipeEditor: expect.objectContaining({
            isOpen: true,
            mode: "add",
            draft: expect.objectContaining({
              title: "Draft Recipe",
              ingredientCount: 5,
            }),
          }),
        })
      );
    });
  });

  it("captures Recipe Detail context including live view/unit/step state", async () => {
    apiMocks.fetchJson.mockImplementation(async (url: string) => {
      if (url === "/api/recipes/recipe-1") {
        return {
          data: {
            id: "recipe-1",
            title: "Sourdough Toast",
            description: "Simple breakfast",
            servings: 2,
            sourceUrl: null,
            sourceLabel: null,
            ingredients: [
              {
                id: "ing-1",
                name: "Sourdough",
                quantity: 2,
                unit: "slice",
                group: null,
                notes: null,
                order: 0,
              },
            ],
            instructions: ["Toast bread"],
            tags: ["breakfast"],
            origin: "manual",
            favourite: false,
            prepTime: 5,
            cookTime: 2,
            difficulty: "Easy",
            cuisine: "american",
            rating: 4,
            cookNotes: null,
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-28T00:00:00.000Z",
          },
        };
      }
      if (url === "/api/preferences") {
        return {
          data: {
            defaultUnitMode: "grams",
            defaultRecipeView: "detailed",
          },
        };
      }

      throw new Error(`Unhandled URL: ${url}`);
    });

    renderWithProviders(
      <Routes>
        <Route element={<RecipeDetailPage />} path="/recipes/:recipeId" />
      </Routes>,
      "/recipes/recipe-1"
    );

    await waitFor(() => {
      expect(contextForPage("recipe-detail")).toEqual(
        expect.objectContaining({
          page: "recipe-detail",
          recipeId: "recipe-1",
          activeView: "cooking",
          activeUnitMode: "grams",
          cookingStepNumber: 2,
        })
      );
    });
  });

  it("captures Stats context", async () => {
    const stats: StatsPayload = {
      heatmap: {
        weeks: [],
        monthStarts: {},
        totalMeals: 10,
        activeDays: 4,
        streak: 2,
      },
      mealTypeBreakdown: [],
      cuisineBreakdown: [],
      weeklyTrend: [],
      dayOfWeekBreakdown: [],
      planningWindow: {
        totalMeals: 10,
        activeDays: 4,
        avgMealsPerActiveDay: 2.5,
      },
      topMeals: [],
      topIngredients: [],
    };

    renderWithProviders(<StatsDashboard stats={stats} />);

    await waitFor(() => {
      expect(contextForPage("stats")).toEqual({ page: "stats" });
    });
  });

  it("captures Settings context", async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(contextForPage("settings")).toEqual({ page: "settings" });
    });
  });
});
