import { describe, expect, it } from "vitest";

import { normalizeIngredient } from "./ingredient-normalizer";

describe("normalizeIngredient", () => {
  it("promotes leading count units from parsed ingredient names", () => {
    expect(normalizeIngredient("1 count Hot Dog")).toMatchObject({
      name: "Hot Dog",
      quantity: 1,
      unit: "count",
      confidence: "high",
    });
  });

  it("promotes item aliases to count units", () => {
    expect(normalizeIngredient("2 items apples")).toMatchObject({
      name: "apples",
      quantity: 2,
      unit: "count",
      confidence: "high",
    });
  });
});