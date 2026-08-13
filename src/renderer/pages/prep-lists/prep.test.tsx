// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PrepViewPage from "./prep";
import styles from "../grocery-list/shop.module.css";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  refetch: vi.fn(),
}));

const prepList = {
  id: "prep-1",
  name: "Weekend Prep",
  notes: null,
  date: null,
  fromDate: null,
  toDate: null,
  sourceMode: "manual" as const,
  sourceLabel: null,
  sourceMealIds: [],
  sourceRecipeIds: [],
  favourite: false,
  sortMode: "manual" as const,
  groupBy: "none" as const,
  includeIngredients: true,
  includeTasks: true,
  includeQuantities: true,
  includeIngredientTypes: true,
  includeSourceLabels: false,
  excludePantryStaples: false,
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:00.000Z",
  checkedCount: 1,
  totalItems: 2,
  completionPercentage: 50,
  items: [
    {
      id: "item-open",
      kind: "ingredient" as const,
      name: "Chop onions",
      qty: "2",
      unit: "cups",
      ingredientType: "Produce",
      prepGroup: null,
      dish: "Soup",
      notes: null,
      checked: false,
      sortOrder: 0,
      sourceMealIds: [],
      sourceRecipeIds: [],
      sourceLabels: [],
    },
    {
      id: "item-done",
      kind: "task" as const,
      name: "Wash herbs",
      qty: null,
      unit: null,
      ingredientType: null,
      prepGroup: "Produce",
      dish: null,
      notes: null,
      checked: true,
      sortOrder: 1,
      sourceMealIds: [],
      sourceRecipeIds: [],
      sourceLabels: [],
    },
  ],
};

vi.mock("@/lib/api", () => ({
  fetchJson: mocks.fetchJson,
}));

vi.mock("@/lib/config", () => ({
  isServerConfigReady: () => true,
}));

vi.mock("@/lib/use-server-config", () => ({
  useServerConfig: () => ({ url: "http://127.0.0.1:3001", token: "token", mode: "local" }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: prepList, refetch: mocks.refetch }),
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: prepList.id }),
}));

describe("PrepViewPage item rows", () => {
  afterEach(() => {
    cleanup();
    mocks.fetchJson.mockReset();
    mocks.refetch.mockReset();
  });

  it("keeps unchecked rows normal and completed rows visually distinct", () => {
    render(<PrepViewPage />);

    const openItem = screen.getByRole("button", { name: /Chop onions/ });
    const doneItem = screen.getByRole("button", { name: /Wash herbs/ });

    expect(openItem).not.toHaveClass(styles.itemDone);
    expect(doneItem).toHaveClass(styles.itemDone);
    expect(doneItem.querySelector(`.${styles.checkFilled}`)).not.toBeNull();
    expect(openItem).toHaveAttribute("type", "button");
  });

  it("toggles an item through the existing update request", () => {
    mocks.fetchJson.mockResolvedValue({ data: prepList });
    render(<PrepViewPage />);

    fireEvent.click(screen.getByRole("button", { name: /Chop onions/ }));

    expect(mocks.fetchJson).toHaveBeenCalledWith(
      "/api/prep-lists/prep-1/items/item-open",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ checked: true }),
      })
    );
  });
});