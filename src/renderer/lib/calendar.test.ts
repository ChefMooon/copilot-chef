import { describe, expect, it } from "vitest";

import {
  formatMealTypeProfileRange,
  getDefaultMealTypeProfile,
  resolveMealTypeProfileForDate,
} from "./calendar";
import type { MealTypeProfilePayload } from "@shared/types";

const defaultProfile = getDefaultMealTypeProfile();

const rangedProfile: MealTypeProfilePayload = {
  ...defaultProfile,
  id: "range-profile",
  name: "Range Profile",
  isDefault: false,
  priority: 10,
  startDate: "2026-04-15T00:00:00.000Z",
  endDate: "2026-04-22T00:00:00.000Z",
};

describe("meal type profile dates", () => {
  it("formats profile ranges using the stored calendar date", () => {
    expect(formatMealTypeProfileRange(rangedProfile)).toBe("Apr 15 - Apr 22");
  });

  it("resolves profile start and end dates without timezone drift", () => {
    expect(
      resolveMealTypeProfileForDate(new Date(2026, 3, 14, 12), [defaultProfile, rangedProfile]).id
    ).toBe(defaultProfile.id);

    expect(
      resolveMealTypeProfileForDate(new Date(2026, 3, 15, 12), [defaultProfile, rangedProfile]).id
    ).toBe(rangedProfile.id);

    expect(
      resolveMealTypeProfileForDate(new Date(2026, 3, 22, 12), [defaultProfile, rangedProfile]).id
    ).toBe(rangedProfile.id);

    expect(
      resolveMealTypeProfileForDate(new Date(2026, 3, 23, 12), [defaultProfile, rangedProfile]).id
    ).toBe(defaultProfile.id);
  });
});
