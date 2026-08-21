// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type QueryState = {
  data?: unknown;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch: ReturnType<typeof vi.fn>;
};

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const queryClientMock = {
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
};

const listRecipesMock = vi.fn();
const toastMock = vi.fn();
const getSettingMock = vi.fn().mockResolvedValue(null);

let StatsPage: (typeof import("./stats"))["default"];
let RecipesPage: (typeof import("./recipes"))["default"];
let HomeDashboard: (typeof import("@/components/home/home-dashboard"))["HomeDashboard"];

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
  useQueryClient: () => queryClientMock,
}));

vi.mock("@/lib/api", () => ({
  fetchJson: vi.fn(),
  listRecipes: listRecipesMock,
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  confirmIngestRecipe: vi.fn(),
  importRecipes: vi.fn(),
  exportRecipes: vi.fn(),
  isRateLimitedApiError: (error: unknown) =>
    Boolean((error as { status?: number } | null)?.status === 429),
}));

vi.mock("@/lib/use-server-config", () => ({
  useServerConfig: () => ({ url: "http://localhost:3001", token: "test" }),
}));

vi.mock("@/lib/config", () => ({
  isServerConfigReady: () => true,
}));

vi.mock("@/lib/platform", () => ({
  getPlatform: () => ({
    runtime: "browser",
    getSetting: getSettingMock,
  }),
}));

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/components/recipes/RecipeDeleteDialog", () => ({
  RecipeDeleteDialog: () => null,
}));

vi.mock("@/components/recipes/RecipeFilterSidebar", () => ({
  RecipeFilterSidebar: () => <div>Filters</div>,
}));

vi.mock("@/components/recipes/RecipeGrid", () => ({
  RecipeGrid: () => <div>Recipes</div>,
}));

function queryState(overrides: Partial<QueryState> = {}): QueryState {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("throttling UI regression coverage", () => {
  beforeAll(async () => {
    StatsPage = (await import("./stats")).default;
    RecipesPage = (await import("./recipes")).default;
    HomeDashboard = (await import("@/components/home/home-dashboard")).HomeDashboard;
  });

  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    queryClientMock.invalidateQueries.mockReset();
    queryClientMock.setQueryData.mockReset();
    listRecipesMock.mockReset();
    toastMock.mockReset();
    getSettingMock.mockReset();
    getSettingMock.mockResolvedValue(null);
    useMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows stats rate-limit message and retries on demand", async () => {
    const refetch = vi.fn();
    useQueryMock.mockReturnValue(
      queryState({ isError: true, error: { status: 429 }, refetch })
    );

    render(<StatsPage />);

    expect(
      screen.getByText("Requests are coming in too quickly right now.")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry now" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows home dashboard rate-limit banner and retries all home queries", async () => {
    const mealSummaryRefetch = vi.fn();
    const groceryRefetch = vi.fn();
    const heatmapRefetch = vi.fn();
    const upcomingRefetch = vi.fn();

    useQueryMock
      .mockReturnValueOnce(queryState({ data: [] }))
      .mockReturnValueOnce(
        queryState({
          data: {
            from: "2026-05-25",
            to: "2026-05-31",
            totalSlots: 5,
          },
          refetch: mealSummaryRefetch,
        })
      )
      .mockReturnValueOnce(
        queryState({
          isError: true,
          error: { status: 429 },
          refetch: groceryRefetch,
        })
      )
      .mockReturnValueOnce(
        queryState({
          data: { weeks: [], monthStarts: {} },
          refetch: heatmapRefetch,
        })
      )
      .mockReturnValueOnce(
        queryState({
          data: {
            days: 7,
            from: "2026-05-25",
            to: "2026-05-31",
            meals: [],
          },
          refetch: upcomingRefetch,
        })
      );

    render(
      <MemoryRouter>
        <HomeDashboard />
      </MemoryRouter>
    );

    expect(
      screen.getByText("Some dashboard data is temporarily rate limited.")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry now" }));

    expect(mealSummaryRefetch).toHaveBeenCalledOnce();
    expect(groceryRefetch).toHaveBeenCalledOnce();
    expect(heatmapRefetch).toHaveBeenCalledOnce();
    expect(upcomingRefetch).toHaveBeenCalledOnce();
  }, 15_000);

  it("shows recipes rate-limit panel and retries both recipe queries", async () => {
    const recipesRefetch = vi.fn();
    const allRecipesRefetch = vi.fn();

    useQueryMock
      .mockReturnValueOnce(
        queryState({
          isError: true,
          error: { status: 429 },
          refetch: recipesRefetch,
        })
      )
      .mockReturnValueOnce(
        queryState({
          isError: true,
          error: { status: 429 },
          refetch: allRecipesRefetch,
        })
      );

    render(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText("Recipe requests are temporarily rate limited.")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry now" }));

    expect(recipesRefetch).toHaveBeenCalledOnce();
    expect(allRecipesRefetch).toHaveBeenCalledOnce();
  });
});