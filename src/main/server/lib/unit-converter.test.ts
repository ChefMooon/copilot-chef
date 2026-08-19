import { describe, expect, it } from "vitest";

import { convertIngredient } from "./unit-converter";

describe("server convertIngredient", () => {
  it("preserves count units", () => {
    expect(convertIngredient(1, "count", "Hot Dog", "grams")).toEqual({
      quantity: 1,
      unit: "count",
      approximate: false,
    });
  });

  it("prefers exact and specific density matches", () => {
    expect(convertIngredient(1, "cup", "tomato paste", "grams")).toEqual({
      quantity: 262,
      unit: "g",
      approximate: true,
    });
  });

  it("preserves cup quantities in cup mode", () => {
    expect(convertIngredient(3.5, "cup", "flour", "cup")).toEqual({
      quantity: 3.5,
      unit: "cup",
      approximate: false,
    });
  });

  it("uses the generic flour density when converting to grams", () => {
    expect(convertIngredient(3.5, "cup", "flour", "grams")).toEqual({
      quantity: 437.5,
      unit: "g",
      approximate: true,
    });
  });
});