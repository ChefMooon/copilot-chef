// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type RecipePayload } from "@/lib/api";

import { RecipeCard } from "./RecipeCard";
import { RecipeGrid } from "./RecipeGrid";

afterEach(() => {
  cleanup();
});

const baseRecipe: RecipePayload = {
  id: "recipe-1",
  title: "Roast Chicken",
  description: "Classic roast chicken dinner recipe with lemon and garlic.",
  servings: 4,
  prepTime: 10,
  cookTime: 25,
  difficulty: "easy",
  cuisine: "american",
  instructions: ["Season chicken", "Roast chicken"],
  sourceUrl: null,
  sourceLabel: null,
  origin: "manual",
  favourite: false,
  rating: null,
  cookNotes: null,
  lastMadeAt: null,
  sourceRecipeId: null,
  sourceRecipe: null,
  ingredients: [
    {
      id: "ingredient-1",
      name: "Chicken",
      quantity: 1,
      quantityNumerator: 1,
      quantityDenominator: 1,
      unit: "lb",
      group: null,
      notes: null,
      parseConfidence: null,
      parseRaw: null,
      order: 0,
    },
  ],
  tags: [],
  linkedSubRecipes: [],
};

function renderRecipeCard(recipe: RecipePayload) {
  return render(
    <MemoryRouter>
      <RecipeCard recipe={recipe} />
    </MemoryRouter>
  );
}

describe("RecipeCard layout", () => {
  it("uses fixed card sizing and clamps description to 2 lines", () => {
    const { container } = renderRecipeCard({
      ...baseRecipe,
      description:
        "A long recipe description that should be clamped to two lines so card height remains stable regardless of content length.",
    });

    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    expect(article).toHaveClass("h-[168px]");
    expect(article).toHaveClass("sm:h-[180px]");

    const description = screen.getByText(/A long recipe description/i);
    expect(description).toHaveClass("line-clamp-2");
  });

  it("collapses the metadata chip section when there are no metadata chips", () => {
    const { container } = renderRecipeCard({
      ...baseRecipe,
      cuisine: null,
      difficulty: null,
      prepTime: null,
      cookTime: null,
      rating: null,
    });

    const article = container.querySelector("article");
    const articleQueries = within(article as HTMLElement);
    expect(articleQueries.queryByText(/Prep/i)).not.toBeInTheDocument();
    expect(articleQueries.queryByText(/Cook/i)).not.toBeInTheDocument();
    expect(article?.querySelector("div.mt-auto")).toBeNull();
  });

  it("shows metadata chips in a capped two-row section when metadata is present", () => {
    const { container } = renderRecipeCard(baseRecipe);

    const article = container.querySelector("article");
    const metaSection = article?.querySelector("div.mt-auto");
    const articleQueries = within(article as HTMLElement);

    expect(metaSection).not.toBeNull();
    expect(metaSection).toHaveClass("max-h-[3rem]");
    expect(metaSection).toHaveClass("overflow-hidden");
    expect(articleQueries.getByText("Manual")).toHaveClass("py-0.5");
    expect(articleQueries.getByText(/Prep/i)).toBeInTheDocument();
    expect(articleQueries.getByText(/Cook/i)).toBeInTheDocument();
  });
});

describe("RecipeCard optional actions", () => {
  it("renders named favourite, edit, and delete actions and invokes callbacks", () => {
    const onToggleFavourite = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <MemoryRouter>
        <RecipeCard
          onDelete={onDelete}
          onEdit={onEdit}
          onToggleFavourite={onToggleFavourite}
          recipe={baseRecipe}
        />
      </MemoryRouter>
    );

    const favouriteButton = screen.getByRole("button", {
      name: "Add Roast Chicken to favourites",
    });
    expect(screen.getByRole("button", { name: "Edit Roast Chicken" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Roast Chicken" })).toBeInTheDocument();
    expect(favouriteButton.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(favouriteButton);
    fireEvent.click(screen.getByRole("button", { name: "Edit Roast Chicken" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Roast Chicken" }));

    expect(onToggleFavourite).toHaveBeenCalledWith(baseRecipe, true);
    expect(onEdit).toHaveBeenCalledWith(baseRecipe);
    expect(onDelete).toHaveBeenCalledWith(baseRecipe);
  });

  it("uses the selected favourite state and accessible name", () => {
    render(
      <MemoryRouter>
        <RecipeCard
          onToggleFavourite={vi.fn()}
          recipe={{ ...baseRecipe, favourite: true }}
        />
      </MemoryRouter>
    );

    const favouriteButton = screen.getByRole("button", {
      name: "Remove Roast Chicken from favourites",
    });
    expect(favouriteButton.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(favouriteButton);
  });
});

describe("RecipeGrid layout", () => {
  it("stretches grid items for consistent row heights", () => {
    const { container } = render(
      <MemoryRouter>
        <RecipeGrid recipes={[baseRecipe]} />
      </MemoryRouter>
    );

    const grid = container.firstElementChild;
    expect(grid).not.toBeNull();
    expect(grid).toHaveClass("items-stretch");
  });
});
