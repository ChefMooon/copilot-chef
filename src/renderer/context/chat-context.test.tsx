// @vitest-environment jsdom

import { useEffect, useRef } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ChatProvider, useChatContext } from "./chat-context";

function createJsonResponse(message: string): Response {
  return new Response(
    JSON.stringify({
      message,
      choices: [],
      responseMode: "auto",
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }
  );
}

function Harness() {
  const navigate = useNavigate();
  const { sendMessage, setPageContext } = useChatContext();
  const hasSetContextRef = useRef(false);

  useEffect(() => {
    if (hasSetContextRef.current) {
      return;
    }
    hasSetContextRef.current = true;

    setPageContext({
      page: "recipes",
      search: "taco",
      origin: "all",
      cuisine: "all",
      totalRecipes: 3,
      favouriteCount: 1,
      filteredRecipes: 2,
      showingFavouritesOnly: false,
      visibleRecipes: [
        {
          id: "recipe-1",
          title: "Easy Taco Salad",
          origin: "manual",
          cuisine: "mexican",
          favourite: true,
        },
      ],
      recipeEditor: {
        isOpen: true,
        mode: "add",
        draft: {
          title: "Taco Bowl",
          description: null,
          servings: 4,
          ingredientCount: 6,
          instructionCount: 4,
          cuisine: "mexican",
          difficulty: "Easy",
          tagsCount: 2,
        },
      },
    });
  }, [setPageContext]);

  return (
    <div>
      <button
        onClick={() => {
          void sendMessage("help me");
        }}
        type="button"
      >
        send
      </button>
      <button
        onClick={() => navigate("/settings")}
        type="button"
      >
        goto-settings
      </button>
    </div>
  );
}

function renderHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/recipes"]}>
        <ChatProvider>
          <Routes>
            <Route element={<Harness />} path="*" />
          </Routes>
        </ChatProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ChatProvider page context payload", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(createJsonResponse("ok"));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("includes active pageContextData when path matches", async () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    const [, requestInit] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body));

    expect(body.pageContextData.page).toBe("recipes");
    expect(body.pageContextData.recipeEditor.isOpen).toBe(true);
    expect(body.pageContextData.recipeEditor.draft.title).toBe("Taco Bowl");
    expect(body.pageContext).toContain("Recipes page");
    expect(body.pageContext).toContain("Recipe editor is open");
  });

  it("omits pageContextData when stored path no longer matches", async () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "goto-settings" }));
    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    const [, requestInit] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body));

    expect(body.pageContextData).toBeNull();
    expect(body.pageContext).toBe(
      "The user is on the Settings page, managing household preferences."
    );
  });
});
