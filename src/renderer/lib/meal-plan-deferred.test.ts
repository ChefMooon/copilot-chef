import { describe, expect, it, vi } from "vitest";

import {
  createCachedImporter,
  importMealPlanDayView,
  importMealPlanDeleteConfirmationModal,
  importMealPlanEditModal,
  importMealPlanMonthView,
  importMealPlanRecipeSearchModal,
  getMealPlanAlternatePreloadOrder,
  resolveInitialMealPlanView,
  scheduleMealPlanPreload,
} from "./meal-plan-deferred";

describe("Meal Plan deferred importers", () => {
  it("exposes cached importers for each required module", () => {
    expect([
      importMealPlanDayView,
      importMealPlanMonthView,
      importMealPlanEditModal,
      importMealPlanDeleteConfirmationModal,
      importMealPlanRecipeSearchModal,
    ]).toHaveLength(5);
  });

  it("orders the remembered alternate view before the remaining view", () => {
    expect(getMealPlanAlternatePreloadOrder("day")).toEqual(["day", "month"]);
    expect(getMealPlanAlternatePreloadOrder("month")).toEqual(["month", "day"]);
    expect(getMealPlanAlternatePreloadOrder("week")).toEqual(["day", "month"]);
  });

  it("resolves a valid stored view and safely falls back to Week View", () => {
    expect(resolveInitialMealPlanView({ getItem: () => "month" })).toBe("month");
    expect(resolveInitialMealPlanView({ getItem: () => "invalid" })).toBe("week");
    expect(resolveInitialMealPlanView({ getItem: () => null })).toBe("week");
  });

  it("falls back when storage access throws", () => {
    expect(
      resolveInitialMealPlanView({
        getItem: () => {
          throw new Error("storage unavailable");
        },
      })
    ).toBe("week");
  });

  it("does not call the loader again after a rejected import", async () => {
    const loader = vi.fn(() => Promise.reject(new Error("load failed")));
    const importModule = createCachedImporter(loader);
    const first = importModule();

    await expect(first).rejects.toThrow("load failed");
    await expect(importModule()).rejects.toThrow("load failed");
    expect(loader).toHaveBeenCalledOnce();
  });

  it("waits for the bounded idle fallback before running work", () => {
    vi.useFakeTimers();
    const task = vi.fn();
    scheduleMealPlanPreload(task);

    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});