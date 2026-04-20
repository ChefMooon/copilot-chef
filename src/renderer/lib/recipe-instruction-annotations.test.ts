import { describe, expect, it } from "vitest";

import { annotateInstructionSteps } from "./recipe-instruction-annotations";

describe("annotateInstructionSteps", () => {
  it("injects inline amounts for matching ingredients", () => {
    const [step] = annotateInstructionSteps(
      ["Drizzle olive oil over the tomatoes and season with salt."],
      [
        {
          ingredientId: "oil",
          ingredientName: "olive oil",
          amountText: "2 tbsp",
        },
        {
          ingredientId: "salt",
          ingredientName: "salt",
          amountText: "1/2 tsp",
        },
      ]
    );

    expect(step.parts).toEqual([
      { type: "text", value: "Drizzle " },
      {
        type: "match",
        ingredientId: "oil",
        text: "olive oil",
        amountText: "2 tbsp",
      },
      { type: "text", value: " over the tomatoes and season with " },
      {
        type: "match",
        ingredientId: "salt",
        text: "salt",
        amountText: "1/2 tsp",
      },
      { type: "text", value: "." },
    ]);
  });

  it("prefers longer overlapping ingredient names over shorter ones", () => {
    const [step] = annotateInstructionSteps(
      ["Whisk the olive oil with lemon juice."],
      [
        {
          ingredientId: "short-oil",
          ingredientName: "oil",
          amountText: "1 tsp",
        },
        {
          ingredientId: "olive-oil",
          ingredientName: "olive oil",
          amountText: "2 tbsp",
        },
      ]
    );

    expect(step.parts).toEqual([
      { type: "text", value: "Whisk the " },
      {
        type: "match",
        ingredientId: "olive-oil",
        text: "olive oil",
        amountText: "2 tbsp",
      },
      { type: "text", value: " with lemon juice." },
    ]);
  });

  it("annotates repeated ingredient mentions in the same step", () => {
    const [step] = annotateInstructionSteps(
      ["Melt butter, then brush butter over the top."],
      [
        {
          ingredientId: "butter",
          ingredientName: "butter",
          amountText: "3 tbsp",
        },
      ]
    );

    expect(step.parts).toEqual([
      { type: "text", value: "Melt " },
      {
        type: "match",
        ingredientId: "butter",
        text: "butter",
        amountText: "3 tbsp",
      },
      { type: "text", value: ", then brush " },
      {
        type: "match",
        ingredientId: "butter",
        text: "butter",
        amountText: "3 tbsp",
      },
      { type: "text", value: " over the top." },
    ]);
  });

  it("skips ingredients without usable amounts and leaves unmatched steps plain", () => {
    const [step] = annotateInstructionSteps(
      ["Tear the basil and scatter it over the pasta."],
      [
        {
          ingredientId: "basil",
          ingredientName: "basil",
          amountText: null,
        },
      ]
    );

    expect(step.parts).toEqual([
      {
        type: "text",
        value: "Tear the basil and scatter it over the pasta.",
      },
    ]);
    expect(step.matchedIngredientIds).toEqual([]);
  });
});