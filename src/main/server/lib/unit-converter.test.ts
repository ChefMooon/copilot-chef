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
});