import { describe, expect, it } from "vitest";

import {
  QUICK_FILTERS,
  ONGOING_LABEL,
  formatListDate,
  isToday,
  isUpcoming,
  sortGroceryLists,
  type GroceryList,
} from "./grocery";

function createList(input: {
  id: string;
  date: string | null;
  createdAt: string;
}): GroceryList {
  return {
    id: input.id,
    name: `List ${input.id}`,
    date: input.date,
    favourite: false,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    checkedCount: 0,
    totalItems: 0,
    completionPercentage: 0,
    items: [],
  };
}

describe("renderer grocery helpers", () => {
  it("includes dedicated ongoing quick filter", () => {
    expect(QUICK_FILTERS.map((filter) => filter.id)).toContain("ongoing");
  });

  it("renders ongoing label for null dates", () => {
    expect(formatListDate(null)).toBe(ONGOING_LABEL);
  });

  it("treats null dates as neither today nor upcoming", () => {
    expect(isToday(null)).toBe(false);
    expect(isUpcoming(null, 7)).toBe(false);
  });

  it("sorts ongoing lists first by createdAt desc, then dated lists by date", () => {
    const lists = [
      createList({
        id: "dated-later",
        date: "2026-06-10T12:00:00.000Z",
        createdAt: "2026-05-01T12:00:00.000Z",
      }),
      createList({
        id: "ongoing-older",
        date: null,
        createdAt: "2026-05-01T12:00:00.000Z",
      }),
      createList({
        id: "dated-earlier",
        date: "2026-05-28T12:00:00.000Z",
        createdAt: "2026-05-02T12:00:00.000Z",
      }),
      createList({
        id: "ongoing-newer",
        date: null,
        createdAt: "2026-05-03T12:00:00.000Z",
      }),
    ];

    const result = sortGroceryLists(lists);

    expect(result.map((list) => list.id)).toEqual([
      "ongoing-newer",
      "ongoing-older",
      "dated-earlier",
      "dated-later",
    ]);
  });
});
