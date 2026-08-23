// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditableMeal } from "@/lib/calendar";
import type { MealTypeDefinitionPayload } from "@shared/types";

import { SlotManagerModal } from "./SlotManagerModal";

const mealTypeDefinition: MealTypeDefinitionPayload = {
  id: "dinner",
  profileId: "default",
  slug: "DINNER",
  name: "Dinner",
  color: "#22c55e",
  enabled: true,
  sortOrder: 1,
};

const createMeal = (id: string, name: string): EditableMeal => ({
  id,
  name,
  date: new Date(2026, 7, 23),
  type: "DINNER",
  sortOrder: Number(id),
  mealTypeDefinitionId: mealTypeDefinition.id,
  mealTypeDefinition,
  mealSubTypeDefinitionId: null,
  mealSubTypeDefinition: null,
  notes: "",
  ingredients: [],
  description: "",
  cuisine: null,
  instructions: [],
  servings: 1,
  prepTime: null,
  cookTime: null,
  servingsOverride: null,
  recipeId: null,
  linkedRecipe: null,
});

afterEach(() => {
  cleanup();
});

describe("SlotManagerModal", () => {
  it("uses the meal type on the header and labels row actions contextually", () => {
    render(
      <SlotManagerModal
        mealTypeDefinition={mealTypeDefinition}
        onAddMeal={vi.fn()}
        onClose={vi.fn()}
        onDelete={vi.fn(async () => undefined)}
        onEdit={vi.fn()}
        onReorder={vi.fn(async () => undefined)}
        slotDate={new Date(2026, 7, 23)}
        slotMeals={[createMeal("1", "Rice & Egg"), createMeal("2", "Honey Roasted Carrots")]}
        slotType="DINNER"
      />
    );

    const dialog = screen.getByRole("dialog");
    const header = dialog.querySelector("header");

    expect(header).toHaveStyle({ "--meal-type-color": "#22c55e" });
    expect(screen.getByRole("button", { name: "Edit Rice & Egg" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Honey Roasted Carrots" })
    ).toBeInTheDocument();
  });

  it("prevents dismissal while a reorder is in flight", async () => {
    let resolveReorder: (() => void) | undefined;
    const onReorder = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReorder = resolve;
        })
    );
    const onClose = vi.fn();

    render(
      <SlotManagerModal
        mealTypeDefinition={mealTypeDefinition}
        onAddMeal={vi.fn()}
        onClose={onClose}
        onDelete={vi.fn(async () => undefined)}
        onEdit={vi.fn()}
        onReorder={onReorder}
        slotDate={new Date(2026, 7, 23)}
        slotMeals={[createMeal("1", "Rice & Egg"), createMeal("2", "Honey Roasted Carrots")]}
        slotType="DINNER"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Rice & Egg down" }));

    expect(onReorder).toHaveBeenCalledWith(["2", "1"]);
    expect(screen.getByRole("button", { name: "Close slot manager" })).toBeDisabled();

    resolveReorder?.();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close slot manager" })).toBeEnabled();
    });
  });

  it("announces reorder failures", async () => {
    render(
      <SlotManagerModal
        mealTypeDefinition={mealTypeDefinition}
        onAddMeal={vi.fn()}
        onClose={vi.fn()}
        onDelete={vi.fn(async () => undefined)}
        onEdit={vi.fn()}
        onReorder={vi.fn(async () => {
          throw new Error("Order could not be saved.");
        })}
        slotDate={new Date(2026, 7, 23)}
        slotMeals={[createMeal("1", "Rice & Egg"), createMeal("2", "Honey Roasted Carrots")]}
        slotType="DINNER"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Rice & Egg down" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Order could not be saved.");
  });
});
