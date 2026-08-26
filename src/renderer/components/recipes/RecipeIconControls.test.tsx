// @vitest-environment jsdom

import { fireEvent, render as testingRender, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecipeFilterSidebar } from "./RecipeFilterSidebar";
import { ServingsScaler } from "./ServingsScaler";
import { TooltipProvider } from "@/components/ui/tooltip";

function render(ui: Parameters<typeof testingRender>[0]) {
  return testingRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

describe("recipe icon controls", () => {
  it("keeps the clear-search control named and functional", () => {
    const onSearchChange = vi.fn();

    render(
      <RecipeFilterSidebar
        cuisine=""
        favouritesOnly={false}
        onClearFilters={vi.fn()}
        onCuisineChange={vi.fn()}
        onFavouritesOnlyChange={vi.fn()}
        onOriginChange={vi.fn()}
        onSearchChange={onSearchChange}
        origin=""
        search="pasta"
      />
    );

    const clearButton = screen.getByRole("button", { name: "Clear search" });
    expect(clearButton).toHaveClass("h-8", "w-8");
    expect(clearButton.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(clearButton);
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("names serving stepper controls and preserves their hit areas", () => {
    const onServingsChange = vi.fn();

    render(
      <ServingsScaler
        baseServings={4}
        onServingsChange={onServingsChange}
        onUnitModeChange={vi.fn()}
        servings={4}
        unitMode="cup"
      />
    );

    const decreaseButton = screen.getByRole("button", { name: "Decrease servings" });
    const increaseButton = screen.getByRole("button", { name: "Increase servings" });

    expect(decreaseButton).toHaveClass("h-8", "w-8");
    expect(increaseButton).toHaveClass("h-8", "w-8");
    expect(decreaseButton.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(increaseButton.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(decreaseButton);
    fireEvent.click(increaseButton);
    expect(onServingsChange).toHaveBeenNthCalledWith(1, 3);
    expect(onServingsChange).toHaveBeenNthCalledWith(2, 5);
  });
});
