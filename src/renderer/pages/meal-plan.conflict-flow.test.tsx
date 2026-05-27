// @vitest-environment jsdom

import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditableMeal } from "@/lib/calendar";
import MealPlanPage from "./meal-plan";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  toast: vi.fn(),
}));

const mealFixture: EditableMeal = {
  id: "meal-1",
  name: "Weeknight Pasta",
  date: new Date("2026-05-18T12:00:00.000Z"),
  type: "breakfast",
  sortOrder: 0,
  mealTypeDefinitionId: "def-breakfast",
  mealTypeDefinition: {
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
  mealSubTypeDefinitionId: null,
  mealSubTypeDefinition: null,
  notes: "",
  ingredients: [],
  description: "",
  cuisine: "italian",
  instructions: [],
  servings: 2,
  prepTime: null,
  cookTime: null,
  servingsOverride: null,
  recipeId: null,
  linkedRecipe: null,
};

vi.mock("@/lib/api", () => ({
  applySlotBatchAction: vi.fn(),
  createMeal: vi.fn(),
  createRecipe: vi.fn(),
  fetchJson: mocks.fetchJson,
  reorderSlotMeals: vi.fn(),
}));

vi.mock("@/lib/use-server-config", () => ({
  useServerConfig: () => ({
    mode: "local",
    url: "http://127.0.0.1:3001",
    token: "test-token",
  }),
}));

vi.mock("@/lib/config", () => ({
  getCachedConfig: () => ({
    mode: "local",
    url: "http://127.0.0.1:3001",
    token: "test-token",
  }),
  isServerConfigReady: () => true,
}));

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({
    toast: mocks.toast,
    dismissAll: vi.fn(),
    setDragging: vi.fn(),
  }),
}));

vi.mock("@/components/meal-plan/use-meal-undo-redo", () => ({
  useMealUndoRedo: () => ({
    recordAction: vi.fn(),
    discardLast: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
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
  }),
  useMealSubTypeDefinitions: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock("@/components/meal-plan/DayView", () => ({ DayView: () => null }));
vi.mock("@/components/meal-plan/MonthView", () => ({ MonthView: () => null }));
vi.mock("@/components/meal-plan/DropIntentPopover", () => ({ DropIntentPopover: () => null }));
vi.mock("@/components/meal-plan/DeleteConfirmationModal", () => ({ DeleteConfirmationModal: () => null }));
vi.mock("@/components/meal-plan/TrashDropZone", () => ({ TrashDropZone: () => null }));
vi.mock("@/components/meal-plan/DuplicateMealModal", () => ({ DuplicateMealModal: () => null }));
vi.mock("@/components/meal-plan/SlotManagerModal", () => ({ SlotManagerModal: () => null }));
vi.mock("@/components/meal-plan/MenuPrintExportModal", () => ({ MenuPrintExportModal: () => null }));

vi.mock("@/components/meal-plan/WeekView", () => ({
  WeekView: ({ onEdit }: { onEdit: (meal: EditableMeal) => void }) => (
    <button
      onClick={() => onEdit(mealFixture)}
      type="button"
    >
      Open Edit
    </button>
  ),
}));

vi.mock("@/components/meal-plan/EditModal", () => ({
  EditModal: ({
    meal,
    onSaveAsRecipe,
  }: {
    meal: EditableMeal;
    onSaveAsRecipe?: (meal: EditableMeal) => void;
  }) => (
    <button
      onClick={() => onSaveAsRecipe?.(meal)}
      type="button"
    >
      Save As Recipe
    </button>
  ),
}));

vi.mock("@/components/recipes/AddRecipeModal", () => ({
  AddRecipeModal: ({
    open,
    focusTitleRequestKey,
    onConflict,
  }: {
    open: boolean;
    focusTitleRequestKey?: number;
    onConflict?: (conflict: {
      error: string;
      code: "RECIPE_DUPLICATE_TITLE" | "RECIPE_DUPLICATE_SOURCE_URL";
      reason: "duplicate_title" | "duplicate_source_url";
      existing: {
        id?: string;
        title: string;
        description: string | null;
        servings: number;
        prepTime: number | null;
        cookTime: number | null;
        difficulty: string | null;
        cuisine?: string | null;
        instructions: string[];
        sourceUrl: string | null;
        sourceLabel: string | null;
        origin: "manual" | "imported";
        favourite: boolean;
        rating: number | null;
        cookNotes: string | null;
        lastMadeAt: string | null;
        tags: string[];
        ingredients: Array<{
          id: string;
          name: string;
          quantity: number | null;
          unit: string | null;
          group: string | null;
          notes: string | null;
          order: number;
        }>;
      };
    }) => void;
  }) => {
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const lastFocusKeyRef = useRef<number | undefined>(focusTitleRequestKey);

    useEffect(() => {
      if (!open || focusTitleRequestKey === undefined) {
        return;
      }

      if (lastFocusKeyRef.current === focusTitleRequestKey) {
        return;
      }

      lastFocusKeyRef.current = focusTitleRequestKey;
      titleInputRef.current?.focus();
    }, [focusTitleRequestKey, open]);

    if (!open) {
      return null;
    }

    return (
      <div>
        <input ref={titleInputRef} aria-label="Recipe Name" />
        <button
          onClick={() => {
            onConflict?.({
              error: "A recipe named \"Weeknight Pasta\" already exists.",
              code: "RECIPE_DUPLICATE_TITLE",
              reason: "duplicate_title",
              existing: {
                id: "recipe-existing-1",
                title: "Weeknight Pasta",
                description: null,
                servings: 2,
                prepTime: null,
                cookTime: null,
                difficulty: null,
                cuisine: "italian",
                instructions: ["Cook pasta"],
                sourceUrl: null,
                sourceLabel: null,
                origin: "manual",
                favourite: false,
                rating: null,
                cookNotes: null,
                lastMadeAt: null,
                tags: [],
                ingredients: [
                  {
                    id: "ingredient-1",
                    name: "Pasta",
                    quantity: null,
                    unit: null,
                    group: null,
                    notes: null,
                    order: 0,
                  },
                ],
              },
            });
          }}
          type="button"
        >
          Trigger Conflict
        </button>
      </div>
    );
  },
}));

function renderMealPlanPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/meal-plan"]}>
        <MealPlanPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("MealPlanPage conflict actions", () => {
  beforeEach(() => {
    mocks.fetchJson.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/meals?")) {
        return {
          data: [
            {
              id: "meal-1",
              name: "Weeknight Pasta",
              date: "2026-05-18T12:00:00.000Z",
              mealType: "breakfast",
              sortOrder: 0,
              mealTypeDefinitionId: "def-breakfast",
              mealSubTypeDefinitionId: null,
              notes: null,
              ingredients: [],
              description: null,
              cuisine: "italian",
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

      if (url === "/api/meals/meal-1" && init?.method === "PATCH") {
        return {
          data: {
            id: "meal-1",
          },
        };
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
  });

  afterEach(() => {
    cleanup();
    mocks.fetchJson.mockReset();
    mocks.toast.mockReset();
    vi.restoreAllMocks();
  });

  it("links existing recipe from conflict dialog and patches the meal", async () => {
    renderMealPlanPage();

    fireEvent.click(await screen.findByRole("button", { name: "Open Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save As Recipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Trigger Conflict" }));

    expect(await screen.findByText("Recipe already exists")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Link Existing" }));

    await waitFor(() => {
      expect(mocks.fetchJson).toHaveBeenCalledWith(
        "/api/meals/meal-1",
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });

    const patchCall = mocks.fetchJson.mock.calls.find(
      ([url, init]) => url === "/api/meals/meal-1" && init?.method === "PATCH"
    );

    expect(patchCall).toBeTruthy();
    expect(String((patchCall?.[1] as RequestInit).body)).toContain(
      '"recipeId":"recipe-existing-1"'
    );

    await waitFor(() => {
      expect(screen.queryByText("Recipe already exists")).not.toBeInTheDocument();
    });
  });

  it("keeps add recipe open and focuses title when continuing to edit", async () => {
    renderMealPlanPage();

    fireEvent.click(await screen.findByRole("button", { name: "Open Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save As Recipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Trigger Conflict" }));

    expect(await screen.findByText("Recipe already exists")).toBeInTheDocument();

    const titleInput = screen.getByRole("textbox", {
      name: "Recipe Name",
      hidden: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue Editing" }));

    await waitFor(() => {
      expect(screen.queryByText("Recipe already exists")).not.toBeInTheDocument();
      expect(titleInput).toHaveFocus();
    });

    expect(screen.getByRole("button", { name: "Trigger Conflict" })).toBeInTheDocument();
  });
});
