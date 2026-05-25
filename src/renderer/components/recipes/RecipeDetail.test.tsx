// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/providers/toast-provider";
import { type RecipeIterationPayload, type RecipePayload } from "@/lib/api";
import { RecipeDetail } from "./RecipeDetail";

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
  iterations,
  isIterationsLoading,
}: {
  recipe?: RecipePayload;
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
        <MemoryRouter>
          <RecipeDetail
            defaultUnitMode="cup"
            defaultView="basic"
            isIterationsLoading={isIterationsLoading ?? false}
            iterations={iterations ?? []}
            recipe={recipe ?? baseRecipe}
          />
        </MemoryRouter>
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
});
