// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/providers/toast-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  type RecipeIterationPayload,
  type RecipeMadeHistoryPayload,
  type RecipePayload,
} from "@/lib/api";
import { RecipeDetail } from "./RecipeDetail";

const TEST_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6p9xkAAAAASUVORK5CYII=";

const { createRecipeMock, updateRecipeMock } = vi.hoisted(() => ({
  createRecipeMock: vi.fn(),
  updateRecipeMock: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    createRecipe: createRecipeMock,
    updateRecipe: updateRecipeMock,
  };
});

const baseRecipe: RecipePayload = {
  id: "recipe-1",
  title: "Roast Chicken",
  description: "Classic roast chicken.",
  servings: 4,
  prepTime: 20,
  cookTime: 90,
  difficulty: "Medium",
  cuisine: "american",
  instructions: ["Season chicken.", "Roast until golden."],
  sourceUrl: null,
  sourceLabel: null,
  origin: "manual",
  favourite: false,
  rating: null,
  cookNotes: null,
  lastMadeAt: null,
  sourceRecipeId: null,
  sourceRecipe: null,
  ingredients: [
    {
      id: "ingredient-1",
      name: "Chicken",
      quantity: 1,
      quantityNumerator: 1,
      quantityDenominator: 1,
      unit: "lb",
      group: null,
      notes: null,
      parseConfidence: null,
      parseRaw: null,
      order: 0,
    },
  ],
  tags: ["dinner"],
  linkedSubRecipes: [],
};

function renderRecipeDetail({
  recipe,
  madeHistory,
  isMadeHistoryLoading,
  iterations,
  isIterationsLoading,
}: {
  recipe?: RecipePayload;
  madeHistory?: RecipeMadeHistoryPayload | null;
  isMadeHistoryLoading?: boolean;
  iterations?: RecipeIterationPayload[];
  isIterationsLoading?: boolean;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <RecipeDetail
              defaultUnitMode="cup"
              defaultView="basic"
              isMadeHistoryLoading={isMadeHistoryLoading ?? false}
              isIterationsLoading={isIterationsLoading ?? false}
              iterations={iterations ?? []}
              madeHistory={madeHistory ?? null}
              recipe={recipe ?? baseRecipe}
            />
          </MemoryRouter>
        </TooltipProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("RecipeDetail duplicate draft flow", () => {
  it("does not create a recipe when duplicate modal is closed without saving", async () => {
    createRecipeMock.mockReset();
    updateRecipeMock.mockReset();

    renderRecipeDetail();

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit recipe" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });

    expect(createRecipeMock).not.toHaveBeenCalled();
  });

  it("renders source chip and removes legacy lineage sections", () => {
    renderRecipeDetail({
      recipe: {
        ...baseRecipe,
        sourceRecipeId: "recipe-parent",
        sourceRecipe: {
          id: "recipe-parent",
          title: "Original Roast Chicken",
        },
      },
    });

    const sourceChip = screen.getByRole("link", { name: "Source" });

    expect(sourceChip).toHaveAttribute("href", "/recipes/recipe-parent");
    expect(sourceChip).toHaveAttribute("title", "Original Roast Chicken");
    expect(screen.queryByText("Source Recipe")).not.toBeInTheDocument();
    expect(screen.queryByText("Derived Recipes")).not.toBeInTheDocument();
  });

  it("renders direct derived link chip when one derived recipe exists", () => {
    renderRecipeDetail({
      iterations: [
        {
          id: "recipe-derived-1",
          title: "Roast Chicken with Lemon",
          parentId: "recipe-1",
          depth: 1,
        },
      ],
    });

    const derivedChip = screen.getByRole("link", { name: "Derived 1" });
    expect(derivedChip).toHaveAttribute("href", "/recipes/recipe-derived-1");
    expect(derivedChip).toHaveAttribute("title", "Roast Chicken with Lemon");
  });

  it("opens a derived recipes modal when multiple derived recipes exist", async () => {
    renderRecipeDetail({
      iterations: [
        {
          id: "recipe-derived-1",
          title: "Roast Chicken with Lemon",
          parentId: "recipe-1",
          depth: 1,
        },
        {
          id: "recipe-derived-2",
          title: "Roast Chicken with Herbs",
          parentId: "recipe-1",
          depth: 1,
        },
      ],
    });

    const derivedButton = screen.getByRole("button", { name: "Derived 2" });
    expect(derivedButton).not.toHaveAttribute("title");

    fireEvent.click(derivedButton);

    const modal = await screen.findByRole("dialog", { name: "Derived recipes" });
    expect(modal).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Roast Chicken with Lemon" })
    ).toHaveAttribute("href", "/recipes/recipe-derived-1");
    expect(
      screen.getByRole("link", { name: "Roast Chicken with Herbs" })
    ).toHaveAttribute("href", "/recipes/recipe-derived-2");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Derived recipes" })
      ).not.toBeInTheDocument();
    });
  });

  it("shows made count in chip and opens made history modal", async () => {
    renderRecipeDetail({
      recipe: {
        ...baseRecipe,
        lastMadeAt: "2026-05-20T12:00:00.000Z",
      },
    });

    const lastMadeButtons = screen.getAllByRole("button", { name: /Last made:/i });
    fireEvent.click(lastMadeButtons[lastMadeButtons.length - 1]);

    const openedHistoryDialogs = await screen.findAllByRole("dialog", {
      name: "Recipe made history",
    });
    expect(openedHistoryDialogs[openedHistoryDialogs.length - 1]).toBeInTheDocument();
  });

  it("prefers made-history last made date when recipe timestamp is missing", () => {
    renderRecipeDetail({
      recipe: {
        ...baseRecipe,
        lastMadeAt: null,
      },
      madeHistory: {
        recipeId: baseRecipe.id,
        madeCount: 2,
        lastMadeAt: "2026-05-20T12:00:00.000Z",
        entries: [
          {
            mealId: "meal-1",
            mealName: "Roast Chicken",
            date: "2026-05-20T12:00:00.000Z",
            mealType: "dinner",
            notes: null,
            photoUrl: null,
            photoDataUrl: null,
            photoMimeType: null,
            photoFileName: null,
          },
        ],
      },
    });

    const lastMadeButtons = screen.getAllByRole("button", { name: /Last made:/i });
    const lastMadeButton = lastMadeButtons[lastMadeButtons.length - 1];

    expect(lastMadeButton).not.toHaveTextContent("Never");
    expect(lastMadeButton).toHaveTextContent("2x");
  });

  it("opens full photo viewer and supports close + zoom interactions", async () => {
    renderRecipeDetail({
      recipe: {
        ...baseRecipe,
        lastMadeAt: "2026-05-20T12:00:00.000Z",
      },
      madeHistory: {
        recipeId: baseRecipe.id,
        madeCount: 1,
        lastMadeAt: "2026-05-20T12:00:00.000Z",
        entries: [
          {
            mealId: "meal-1",
            date: "2026-05-20T12:00:00.000Z",
            mealType: "dinner",
            mealName: "Roast Chicken",
            photoUrl: null,
            photoDataUrl: TEST_IMAGE_DATA_URL,
            photoFileName: "roast-chicken.png",
            photoMimeType: "image/png",
            notes: null,
          },
        ],
      },
    });

    const lastMadeButtons = screen.getAllByRole("button", { name: /Last made:/i });
    fireEvent.click(lastMadeButtons[lastMadeButtons.length - 1]);

    const openedHistoryDialogs = await screen.findAllByRole("dialog", {
      name: "Recipe made history",
    });
    expect(openedHistoryDialogs[openedHistoryDialogs.length - 1]).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /(?:View|Open) full photo/i }));

    expect(
      await screen.findByRole("dialog", { name: "Cooking history photo viewer" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("125%");

    fireEvent.keyDown(window, { key: "=" });
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("150%");

    fireEvent.wheel(screen.getByLabelText("Cooking history photo canvas"), { deltaY: -100 });
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("175%");

    fireEvent.doubleClick(screen.getByLabelText("Cooking history photo canvas"));
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("100%");

    fireEvent.keyDown(window, { key: "0" });
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("100%");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Cooking history photo viewer" })
      ).not.toBeInTheDocument();
    });
    const remainingHistoryDialogs = screen.getAllByRole("dialog", {
      name: "Recipe made history",
    });
    expect(remainingHistoryDialogs[remainingHistoryDialogs.length - 1]).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /(?:View|Open) full photo/i }));
    expect(
      await screen.findByRole("dialog", { name: "Cooking history photo viewer" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close viewer" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Cooking history photo viewer" })
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /(?:View|Open) full photo/i }));
    expect(
      await screen.findByRole("dialog", { name: "Cooking history photo viewer" })
    ).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText("Cooking history photo viewer backdrop"));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Cooking history photo viewer" })
      ).not.toBeInTheDocument();
    });
  }, 15_000);
});
