import { describe, expect, it } from "vitest";

import { rebindMealId, type MealUndoAction } from "./use-meal-undo-redo";

describe("useMealUndoRedo helpers", () => {
  it("rebinds meal ids inside Meal Bank transfer actions", () => {
    const stack: MealUndoAction[] = [
      {
        type: "bank-transfer",
        mealId: "old-id",
        from: {
          date: null,
          mealType: "bank",
          mealTypeDefinitionId: null,
          mealSubTypeDefinitionId: null,
        },
        to: {
          date: "2026-05-25T12:00:00.000Z",
          mealType: "dinner",
          mealTypeDefinitionId: "dinner-def",
          mealSubTypeDefinitionId: null,
        },
        summary: "Scheduled Freezer Chili",
      },
    ];

    rebindMealId(stack, "old-id", "new-id");

    expect(stack[0]).toMatchObject({ mealId: "new-id" });
  });
});