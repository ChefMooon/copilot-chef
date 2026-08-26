// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { RecipeSearchFilterCard } from "./RecipeSearchFilterCard";

afterEach(() => {
  cleanup();
});

function renderCard(
  overrides: Partial<React.ComponentProps<typeof RecipeSearchFilterCard>> = {}
) {
  const props: React.ComponentProps<typeof RecipeSearchFilterCard> = {
    cuisine: "",
    favouritesOnly: false,
    onClearFilters: vi.fn(),
    onCuisineChange: vi.fn(),
    onFavouritesOnlyChange: vi.fn(),
    onOriginChange: vi.fn(),
    onSearchChange: vi.fn(),
    onSearchSortModeChange: vi.fn(),
    onSortByChange: vi.fn(),
    onSortOrderToggle: vi.fn(),
    origin: "",
    search: "",
    searchSortMode: "relevance",
    sortBy: "updated",
    sortOrder: "desc",
    ...overrides,
  };

  return {
    ...render(
      <TooltipProvider delayDuration={0}>
        <RecipeSearchFilterCard {...props} />
      </TooltipProvider>
    ),
    props,
  };
}

describe("RecipeSearchFilterCard", () => {
  it("starts collapsed and exposes an accessible advanced disclosure", () => {
    renderCard();

    const toggle = screen.getByRole("button", {
      name: "Show advanced recipe filters",
    });
    const panel = screen
      .getByRole("region", { name: "Recipe search and filters" })
      .querySelector("#recipe-advanced-filters");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "recipe-advanced-filters");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByLabelText("Recipe origin")).toBeDisabled();

    fireEvent.click(toggle);

    expect(
      screen.getByRole("button", { name: "Hide advanced recipe filters" })
    ).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByLabelText("Recipe origin")).toBeEnabled();
  });

  it("forwards filter, sort, and clear interactions", () => {
    const onClearFilters = vi.fn();
    const onCuisineChange = vi.fn();
    const onFavouritesOnlyChange = vi.fn();
    const onOriginChange = vi.fn();
    const onSearchChange = vi.fn();
    const onSearchSortModeChange = vi.fn();
    const onSortByChange = vi.fn();
    const onSortOrderToggle = vi.fn();
    renderCard({
      cuisine: "italian",
      favouritesOnly: true,
      onClearFilters,
      onCuisineChange,
      onFavouritesOnlyChange,
      onOriginChange,
      onSearchChange,
      onSearchSortModeChange,
      onSortByChange,
      onSortOrderToggle,
      origin: "manual",
      search: "pasta",
      searchSortMode: "relevance",
    });

    fireEvent.change(
      screen.getByPlaceholderText("Search title, tags, ingredients"),
      {
        target: { value: "pizza" },
      }
    );
    fireEvent.change(screen.getByLabelText("Sort recipes by"), {
      target: { value: "title" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Toggle order/i }));
    fireEvent.change(screen.getByLabelText("Search sort mode"), {
      target: { value: "selected" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Show advanced recipe filters" })
    );
    fireEvent.change(screen.getByLabelText("Recipe origin"), {
      target: { value: "imported" },
    });
    fireEvent.change(screen.getByLabelText("Recipe cuisine"), {
      target: { value: "japanese" },
    });
    fireEvent.click(screen.getByLabelText("Favourites only"));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onSearchChange).toHaveBeenCalledWith("pizza");
    expect(onSortByChange).toHaveBeenCalledWith("title");
    expect(onSortOrderToggle).toHaveBeenCalledOnce();
    expect(onSearchSortModeChange).toHaveBeenCalledWith("selected");
    expect(onOriginChange).toHaveBeenCalledWith("imported");
    expect(onCuisineChange).toHaveBeenCalledWith("japanese");
    expect(onFavouritesOnlyChange).toHaveBeenCalledWith(false);
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it("shows an active advanced cue while collapsed", () => {
    renderCard({ cuisine: "thai" });

    expect(
      screen.getByRole("button", { name: "Show advanced recipe filters" })
    ).not.toHaveAttribute("title");
    expect(screen.getByLabelText("Recipe origin")).toBeDisabled();
  });

  it("provides tooltips for icon-only search controls", async () => {
    renderCard({ search: "pasta" });

    fireEvent.focus(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Clear search"
    );

    fireEvent.blur(screen.getByRole("button", { name: "Clear search" }));
    fireEvent.focus(
      screen.getByRole("button", { name: "Show advanced recipe filters" })
    );
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Show advanced recipe filters"
    );
  });
});
