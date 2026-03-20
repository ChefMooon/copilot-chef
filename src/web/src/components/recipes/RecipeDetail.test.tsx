/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecipeDetail } from "./RecipeDetail";
import { type RecipePayload } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("./AddRecipeModal", () => ({
  AddRecipeModal: () => null,
}));

vi.mock("./CookingMode", () => ({
  CookingMode: () => null,
}));

vi.mock("./IngredientRow", () => ({
  IngredientRow: ({ display }: { display: string }) =>
    React.createElement("li", null, display),
}));

vi.mock("./ServingsScaler", () => ({
  ServingsScaler: () => null,
}));

vi.mock("./SourceBadge", () => ({
  SourceBadge: () => React.createElement("span", null, "source"),
}));

afterEach(() => {
  cleanup();
});

function buildRecipe(overrides?: Partial<RecipePayload>): RecipePayload {
  return {
    id: "recipe-1",
    title: "Test Recipe",
    description: null,
    servings: 2,
    prepTime: null,
    cookTime: null,
    difficulty: null,
    instructions: ["Step one"],
    sourceUrl: null,
    sourceLabel: null,
    origin: "imported",
    rating: null,
    cookNotes: "- First line\n- Second line",
    lastMadeAt: null,
    ingredients: [
      {
        id: "ing-1",
        name: "Flour",
        quantity: 1,
        unit: "cup",
        notes: null,
        order: 0,
      },
    ],
    tags: [],
    linkedSubRecipes: [],
    ...overrides,
  };
}

describe("RecipeDetail", () => {
  it("renders cook notes with newline-preserving styling", () => {
    render(
      React.createElement(RecipeDetail, {
        recipe: buildRecipe(),
        defaultView: "basic",
        defaultUnitMode: "cup",
      })
    );

    const cookNotesLabel = screen.getByText("Cook Notes");
    const section = cookNotesLabel.closest("section");
    expect(section).not.toBeNull();

    const notesParagraph = section?.querySelector("p.mt-2");
    expect(notesParagraph).not.toBeNull();
    expect(notesParagraph).toHaveClass("whitespace-pre-line");
    expect(notesParagraph?.textContent).toContain("First line");
    expect(notesParagraph?.textContent).toContain("Second line");
  });
});
