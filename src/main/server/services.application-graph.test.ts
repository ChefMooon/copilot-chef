import { describe, expect, it } from "vitest";
import { vi } from "vitest";

const electronMock = vi.hoisted(() => {
  const userDataPath = process.env.TEMP ?? process.cwd();

  return {
    app: {
      isPackaged: false,
      getPath: (name: string) => {
        if (name !== "userData") {
          throw new Error(`Unsupported Electron path: ${name}`);
        }

        return userDataPath;
      },
    },
  };
});

vi.mock("electron", () => electronMock);

import { MealService } from "./services/meal-service";
import { PrepListService } from "./services/prep-list-service";
import { createApplicationServices } from "./services";

describe("createApplicationServices", () => {
  it("returns a service graph with shared dependencies", () => {
    const services = createApplicationServices();

    expect(services.mealService).toBeInstanceOf(MealService);
    expect(services.prepListService).toBeInstanceOf(PrepListService);
    expect((services.prepListService as PrepListService & { mealService: MealService }).mealService).toBe(
      services.mealService
    );
  });

  it("allows prep-list to use an injected meal service", () => {
    const injectedMealService = new MealService();
    const prepListService = new PrepListService({ mealService: injectedMealService });

    expect(
      (prepListService as PrepListService & { mealService: MealService }).mealService
    ).toBe(injectedMealService);
  });
});
