import { describe, expect, it } from "vitest";

import { convertIngredient } from "./recipe-units";

describe("convertIngredient", () => {
  it("preserves count units in cup mode", () => {
    expect(convertIngredient(1, "count", "Hot Dog", "cup")).toEqual({
      quantity: 1,
      unit: "count",
      approximate: false,
    });
  });

  it("preserves count units in grams mode", () => {
    expect(convertIngredient(1, "count", "Hot Dog", "grams")).toEqual({
      quantity: 1,
      unit: "count",
      approximate: false,
    });
  });

  it("uses known densities when converting cups to grams", () => {
    expect(convertIngredient(2, "tbsp", "olive oil", "grams")).toEqual({
      quantity: 27,
      unit: "g",
      approximate: true,
    });
  });

  it("prefers specific density matches over generic tomato matches", () => {
    expect(convertIngredient(1, "cup", "tomato paste", "grams")).toEqual({
      quantity: 262,
      unit: "g",
      approximate: true,
    });
  });

  it("keeps original volume units when density is unknown", () => {
    expect(convertIngredient(1, "cup", "mystery ingredient", "grams")).toEqual({
      quantity: 1,
      unit: "cup",
      approximate: true,
    });
  });
});