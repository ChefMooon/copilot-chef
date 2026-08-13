// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditableMeal } from "@/lib/calendar";
import type { RecipePayload } from "@/lib/api";
import type { MealTypeProfilePayload } from "@shared/types";

import { EditModal } from "./EditModal";

const recipeForLink: RecipePayload = {
  id: "recipe-link-1",
  title: "Linked Pasta",
  description: "A linked recipe",
  servings: 2,
  prepTime: 10,
  cookTime: 20,
  difficulty: null,
  cuisine: "italian",
  instructions: ["Cook"],
  sourceUrl: null,
  sourceLabel: null,
  origin: "manual",
  favourite: false,
  rating: null,
  cookNotes: null,
  lastMadeAt: null,
  tags: [],
  ingredients: [
    {
      id: "ingredient-link-1",
      name: "Pasta",
      quantity: 1,
      unit: "cup",
      group: null,
      notes: null,
      order: 0,
    },
  ],
};

vi.mock("./RecipeSearchModal", () => ({
  RecipeSearchModal: ({
    open,
    errorMessage,
    onClose,
    onSelectRecipe,
  }: {
    open: boolean;
    errorMessage?: string | null;
    onClose: () => void;
    onSelectRecipe: (
      recipe: RecipePayload,
      servings: number,
      personalNote: string
    ) => Promise<void>;
  }) =>
    open ? (
      <div>
        {errorMessage ? <p>{errorMessage}</p> : null}
        <button
          onClick={() => {
            void onSelectRecipe(recipeForLink, 2, "");
          }}
          type="button"
        >
          Confirm Link
        </button>
        <button onClick={onClose} type="button">
          Close Search
        </button>
      </div>
    ) : null,
}));

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

const editableMeal: EditableMeal = {
  ...linkedMeal,
  recipeId: null,
  linkedRecipe: null,
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

  it("keeps recipe search open and shows an error when linking save fails", async () => {
    const closeModal = vi.fn();

    render(
      <EditModal
        meal={editableMeal}
        mealSubTypes={[]}
        mealTypeProfiles={mealTypeProfiles}
        onClose={closeModal}
        onDelete={vi.fn(async () => undefined)}
        onSave={vi.fn(async () => {
          throw new Error("Unable to link recipe");
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Link Recipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Link" }));

    expect((await screen.findAllByText("Unable to link recipe")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Confirm Link" })).toBeInTheDocument();
    expect(closeModal).not.toHaveBeenCalled();
  });

  it("keeps the meal photo section collapsed by default", () => {
    render(
      <EditModal
        meal={editableMeal}
        mealSubTypes={[]}
        mealTypeProfiles={mealTypeProfiles}
        onClose={vi.fn()}
        onDelete={vi.fn(async () => undefined)}
        onSave={vi.fn(async () => undefined)}
      />
    );

    const toggle = screen.getByRole("button", { name: /meal photo/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Meal Photo")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Meal Photo")).toBeInTheDocument();
  });

  it("names ingredient and instruction icon actions independently of their glyphs", () => {
    render(
      <EditModal
        meal={{
          ...editableMeal,
          ingredients: [
            {
              name: "Pasta",
              quantity: "1",
              unit: "cup",
              group: null,
              notes: null,
              order: 0,
            },
          ],
        }}
        mealSubTypes={[]}
        mealTypeProfiles={mealTypeProfiles}
        onClose={vi.fn()}
        onDelete={vi.fn(async () => undefined)}
        onSave={vi.fn(async () => undefined)}
      />
    );

    expect(screen.getByRole("button", { name: "Remove ingredient 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move instruction 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move instruction 2 up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move instruction 1 down" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove instruction 2" })).toBeInTheDocument();
  });

  it("does not render stray disabled text in the modal body", () => {
    const { container } = render(
      <EditModal
        meal={editableMeal}
        mealSubTypes={[]}
        mealTypeProfiles={mealTypeProfiles}
        onClose={vi.fn()}
        onDelete={vi.fn(async () => undefined)}
        onSave={vi.fn(async () => undefined)}
      />
    );

    expect(screen.getByLabelText(/edit meal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/meal type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sub-type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/day/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /meal photo/i })).toBeInTheDocument();
    const mealTypeBadge = screen.getByText("Dinner", { selector: "span" });

    expect(mealTypeBadge).toBeInTheDocument();
    expect((mealTypeBadge as HTMLElement).style.color).toBe("");
    expect(container).not.toHaveTextContent("disabled=");
  });
});
