// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickReference } from "./QuickReference";

import type { GroceryList } from "@/lib/grocery";

const list: GroceryList = {
  id: "list-1",
  name: "Weekend shop",
  date: "2026-08-15",
  favourite: false,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
  checkedCount: 1,
  totalItems: 2,
  completionPercentage: 50,
  items: [
    {
      id: "item-1",
      name: "Tomatoes",
      qty: "2",
      unit: null,
      category: "Produce",
      notes: null,
      meal: null,
      checked: false,
      sortOrder: 0,
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe("QuickReference icon affordances", () => {
  it("renders semantic filter icons and a named favourite action", () => {
    const onSelectFilter = vi.fn();
    const onToggleFav = vi.fn();

    render(
      <QuickReference
        activeFilter="today"
        lists={[list]}
        onChangeUpcomingDays={vi.fn()}
        onSelectFilter={onSelectFilter}
        onSelectList={vi.fn()}
        onToggleFav={onToggleFav}
        selectedId={null}
        upcomingDays={7}
      />
    );

    expect(screen.getByRole("button", { name: "Today" }).querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    const favouriteButton = screen.getByRole("button", {
      name: "Add Weekend shop to favourites",
    });
    expect(favouriteButton.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(screen.getByRole("button", { name: "Favourites" }));
    fireEvent.click(favouriteButton);

    expect(onSelectFilter).toHaveBeenCalledWith("fav");
    expect(onToggleFav).toHaveBeenCalledWith("list-1", true);
  });
});
