// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ItemRow } from "./ItemRow";

const item = {
  id: "item-1",
  name: "Tomatoes",
  qty: "2",
  unit: "kg",
  category: "Produce",
  notes: null,
  meal: null,
  checked: false,
  sortOrder: 0,
};

describe("ItemRow icon actions", () => {
  afterEach(() => cleanup());

  it("keeps row actions named and preserves boundary disabled states", () => {
    render(
      <ItemRow
        dropPosition={null}
        index={0}
        item={item}
        onDelete={vi.fn()}
        onDragEndItem={vi.fn()}
        onDragHoverItem={vi.fn()}
        onDragStartItem={vi.fn()}
        onDropItem={vi.fn()}
        onMove={vi.fn()}
        onUpdate={vi.fn()}
        total={2}
      />
    );

    expect(screen.getByRole("button", { name: "Move item up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move item down" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Show more fields" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove Tomatoes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove Tomatoes" }).querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
