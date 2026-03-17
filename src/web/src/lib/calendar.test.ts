import { describe, expect, it } from "vitest";

import { createEmptyMeal, createMealSlots } from "./calendar";

describe("calendar helpers", () => {
  it("creates fixed meal slots for a day even when some meals are missing", () => {
    const targetDate = new Date(2026, 2, 17, 8, 30, 0);
    const otherDate = new Date(2026, 2, 18, 12, 0, 0);

    const slots = createMealSlots(
      [
        {
          id: "breakfast-1",
          mealPlanId: "plan-1",
          name: "Overnight Oats",
          date: new Date(2026, 2, 17, 12, 0, 0),
          type: "breakfast",
          notes: "",
          ingredients: [],
        },
        {
          id: "dinner-1",
          mealPlanId: "plan-1",
          name: "Sheet Pan Salmon",
          date: new Date(2026, 2, 17, 12, 0, 0),
          type: "dinner",
          notes: "",
          ingredients: [],
        },
        {
          id: "other-day",
          mealPlanId: "plan-1",
          name: "Ignore Me",
          date: otherDate,
          type: "lunch",
          notes: "",
          ingredients: [],
        },
      ],
      targetDate
    );

    expect(slots.map((slot) => slot.type)).toEqual([
      "breakfast",
      "morning snack",
      "lunch",
      "afternoon snack",
      "dinner",
    ]);
    expect(slots.map((slot) => slot.meals.length)).toEqual([1, 0, 0, 0, 1]);
    expect(slots[0]?.meals[0]?.name).toBe("Overnight Oats");
    expect(slots[4]?.meals[0]?.name).toBe("Sheet Pan Salmon");
  });

  it("normalizes new empty meals to midday for stable day comparisons", () => {
    const meal = createEmptyMeal(new Date(2026, 2, 17, 1, 15, 0), "lunch");

    expect(meal.date.getHours()).toBe(12);
    expect(meal.date.getMinutes()).toBe(0);
    expect(meal.date.getDate()).toBe(17);
    expect(meal.type).toBe("lunch");
  });
});