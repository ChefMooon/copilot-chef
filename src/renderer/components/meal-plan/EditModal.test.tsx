// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditableMeal } from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";

import { EditModal } from "./EditModal";

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

const linkedMeal: EditableMeal = {
  id: "meal-1",
  name: "Weeknight Pasta",
  date: monday,
  type: "DINNER",
  sortOrder: 10,
  mealTypeDefinitionId: "dinner",
  mealTypeDefinition: mealTypeProfiles[0].mealTypes[0],
  mealSubTypeDefinitionId: null,
  mealSubTypeDefinition: null,
  notes: "Extra basil",
  ingredients: [],
  description: "Simple dinner",
  cuisine: "italian",
  instructions: ["Boil pasta", "Make sauce"],
  servings: 2,
  prepTime: 10,
  cookTime: 20,
  servingsOverride: null,
  recipeId: "recipe-123",
  linkedRecipe: {
    id: "recipe-123",
    title: "Weeknight Pasta",
    description: "Fast and cozy.",
    instructions: ["Boil pasta", "Make sauce"],
    cookNotes: null,
    servings: 2,
    prepTime: 10,
    cookTime: 20,
    cuisine: "italian",
    ingredients: [],
  },
};

afterEach(() => {
  cleanup();
});

describe("EditModal", () => {
  it("navigates to the linked recipe detail path when View Recipe is clicked", () => {
    const navigate = vi.fn();

    render(
      <EditModal
        meal={linkedMeal}
        mealSubTypes={[]}
        mealTypeProfiles={mealTypeProfiles}
        onClose={vi.fn()}
        onDelete={vi.fn(async () => undefined)}
        onResuggest={vi.fn(async () => undefined)}
        onSave={vi.fn(async () => undefined)}
        onUnlinkRecipe={vi.fn(async () => undefined)}
        onViewLinkedRecipe={(recipeId) => {
          navigate(`/recipes/${recipeId}`);
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /view recipe/i }));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/recipes/recipe-123");
  });
});
