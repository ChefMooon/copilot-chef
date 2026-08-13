// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChipList } from "./ChipList";

afterEach(() => {
  cleanup();
});

describe("ChipList", () => {
  it("names chip removal controls and hides decorative icons", () => {
    render(
      <ChipList
        description="Ingredients to avoid"
        items={["Peanuts"]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        placeholder="Add an ingredient"
        title="Avoid ingredients"
      />
    );

    expect(
      screen.getByRole("button", { name: "Remove Peanuts" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    expect(screen.getByLabelText("Avoid ingredients")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Peanuts" }).querySelector("svg"))
      .toHaveAttribute("aria-hidden", "true");
  });

  it("removes a chip through its named action", () => {
    const onRemove = vi.fn();

    render(
      <ChipList
        description="Ingredients to avoid"
        items={["Peanuts"]}
        onAdd={vi.fn()}
        onRemove={onRemove}
        onReorder={vi.fn()}
        placeholder="Add an ingredient"
        title="Avoid ingredients"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Peanuts" }));
    expect(onRemove).toHaveBeenCalledWith("Peanuts");
  });
});