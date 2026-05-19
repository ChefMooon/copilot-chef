// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DuplicateMealModal } from "./DuplicateMealModal";
import type { EditableMeal } from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";

const monday = new Date(2026, 4, 18);

const mealTypeProfiles: MealTypeProfilePayload[] = [
  {
    id: "profile-default",
    name: "Default",
    description: null,
    color: "#3b5e45",
    isDefault: true,
    priority: 0,
    startDate: null,
    endDate: null,
    mealTypes: [
      {
        id: "breakfast",
        profileId: "profile-default",
        slug: "BREAKFAST",
        name: "Breakfast",
        color: "#f97316",
        enabled: true,
        sortOrder: 0,
      },
      {
        id: "dinner",
        profileId: "profile-default",
        slug: "DINNER",
        name: "Dinner",
        color: "#22c55e",
        enabled: true,
        sortOrder: 1,
      },
    ],
  },
];

const meal: EditableMeal = {
  id: "meal-1",
  name: "Shakshuka",
  date: monday,
  type: "BREAKFAST",
  sortOrder: 10,
  mealTypeDefinitionId: "breakfast",
  mealTypeDefinition: mealTypeProfiles[0].mealTypes[0],
  mealSubTypeDefinitionId: null,
  mealSubTypeDefinition: null,
  notes: "With feta",
  ingredients: [],
  description: "Tomato and eggs",
  cuisine: "Middle Eastern",
  instructions: ["Cook onions", "Simmer tomatoes", "Poach eggs"],
  servings: 2,
  prepTime: 15,
  cookTime: 20,
  servingsOverride: null,
  recipeId: null,
  linkedRecipe: null,
};

afterEach(() => {
  cleanup();
});

describe("DuplicateMealModal", () => {
  it("disables duplicating to the source day", () => {
    render(
      <DuplicateMealModal
        isOpen
        meal={meal}
        mealTypeProfiles={mealTypeProfiles}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        referenceDate={monday}
      />
    );

    expect(screen.getByText("Source day")).toBeTruthy();

    const sourceButton = document.querySelector(
      "button[data-source-day='true']"
    );

    expect(sourceButton).toBeTruthy();
    expect(sourceButton).toHaveProperty("disabled", true);
  });

  it("sends selected day and default target meal type", () => {
    const onDuplicate = vi.fn();

    render(
      <DuplicateMealModal
        isOpen
        meal={meal}
        mealTypeProfiles={mealTypeProfiles}
        onClose={vi.fn()}
        onDuplicate={onDuplicate}
        referenceDate={monday}
      />
    );

    const target = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[data-target-date]")
    ).find((button) => button.dataset.sourceDay === "false" && !button.disabled);

    expect(target).toBeTruthy();

    fireEvent.click(target as HTMLButtonElement);

    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDuplicate.mock.calls[0][0]).toMatchObject({
      mealType: "BREAKFAST",
      mealTypeDefinitionId: "breakfast",
    });
  });
});
