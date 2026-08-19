// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { getNextSettingsTabId } from "./settings";

describe("Settings tab keyboard navigation", () => {
  it("cycles through the persisted tab order with arrow keys", () => {
    expect(getNextSettingsTabId(0, "ArrowLeft")).toBe("data-management");
    expect(getNextSettingsTabId(4, "ArrowRight")).toBe("app-settings");
    expect(getNextSettingsTabId(1, "ArrowRight")).toBe("meal-plans");
    expect(getNextSettingsTabId(2, "ArrowLeft")).toBe("dietary-profile");
  });

  it("supports Home and End and ignores unrelated keys", () => {
    expect(getNextSettingsTabId(3, "Home")).toBe("app-settings");
    expect(getNextSettingsTabId(0, "End")).toBe("data-management");
    expect(getNextSettingsTabId(2, "Enter")).toBeNull();
  });
});
