// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import RecipeDetailPage from "./detail";

const { deleteRecipeMock, fetchJsonMock } = vi.hoisted(() => ({
  deleteRecipeMock: vi.fn(),
  fetchJsonMock: vi.fn(),
}));

vi.mock("@/context/chat-context", () => ({
  useChatPageContext: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    deleteRecipe: deleteRecipeMock,
    fetchJson: fetchJsonMock,
  };
});

vi.mock("@/components/recipes/RecipeDetail", () => ({
  RecipeDetail: ({
    isDeleting,
    onDeleteRequest,
  }: {
    isDeleting?: boolean;
    onDeleteRequest?: () => void;
  }) => (
    <div>
      <button onClick={onDeleteRequest} type="button">
        Open Delete
      </button>
      <span>{isDeleting ? "Deleting" : "Idle"}</span>
    </div>
  ),
}));

function renderRecipeDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/recipes/recipe-1"]}>
        <Routes>
          <Route element={<RecipeDetailPage />} path="/recipes/:recipeId" />
          <Route element={<div>Recipes Index</div>} path="/recipes" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("RecipeDetailPage", () => {
  afterEach(() => {
    fetchJsonMock.mockReset();
    deleteRecipeMock.mockReset();
    vi.restoreAllMocks();
  });

  it("uses the custom delete dialog from the detail view", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");

    fetchJsonMock.mockImplementation(async (url: string) => {
      if (url === "/api/recipes/recipe-1") {
        return {
          data: {
            id: "recipe-1",
            title: "Roast Chicken",
            description: null,
            servings: 4,
            ingredients: [],
            instructions: [],
            tags: [],
            origin: "manual",
            favourite: false,
            prepTime: null,
            cookTime: null,
            difficulty: null,
            cuisine: null,
            rating: null,
            cookNotes: null,
            sourceLabel: null,
            lastMadeAt: null,
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-28T00:00:00.000Z",
          },
        };
      }

      if (url === "/api/preferences") {
        return {
          data: {},
        };
      }

      throw new Error(`Unhandled URL: ${url}`);
    });
    deleteRecipeMock.mockResolvedValue(undefined);

    renderRecipeDetailPage();

    fireEvent.click(await screen.findByRole("button", { name: "Open Delete" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByText("Delete recipe?")).toBeTruthy();
    expect(screen.getByText("This will permanently delete Roast Chicken.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteRecipeMock).toHaveBeenCalled();
    });
    expect(deleteRecipeMock.mock.calls[0]?.[0]).toBe("recipe-1");
    expect(await screen.findByText("Recipes Index")).toBeTruthy();
  });
});