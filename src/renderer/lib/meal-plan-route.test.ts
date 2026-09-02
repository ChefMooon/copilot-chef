import { describe, expect, it, vi } from "vitest";

const pageModuleFactory = vi.hoisted(() => vi.fn(() => ({
  default: () => null,
})));

vi.mock("../pages/meal-plan", pageModuleFactory);

describe("meal plan route importer", () => {
  it("lazily creates and shares one import promise", async () => {
    const { importMealPlanRoute } = await import("./meal-plan-route");

    expect(pageModuleFactory).not.toHaveBeenCalled();

    const first = importMealPlanRoute();
    const second = importMealPlanRoute();

    expect(second).toBe(first);
    await first;
    expect(pageModuleFactory).toHaveBeenCalledTimes(1);
  });
});