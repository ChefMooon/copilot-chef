type Importer<T> = () => Promise<T>;

export type MealPlanView = "day" | "week" | "month";

export const MEAL_PLAN_PRELOAD_TIMEOUT_MS = 1000;

export function createCachedImporter<T>(importer: Importer<T>): Importer<T> {
  let promise: Promise<T> | undefined;

  return () => {
    if (!promise) {
      promise = importer();
    }

    return promise;
  };
}

export const importMealPlanDayView = createCachedImporter(() =>
  import("@/components/meal-plan/DayView")
);

export const importMealPlanMonthView = createCachedImporter(() =>
  import("@/components/meal-plan/MonthView")
);

export const importMealPlanEditModal = createCachedImporter(() =>
  import("@/components/meal-plan/EditModal")
);

export const importMealPlanDeleteConfirmationModal = createCachedImporter(() =>
  import("@/components/meal-plan/DeleteConfirmationModal")
);

export const importMealPlanRecipeSearchModal = createCachedImporter(() =>
  import("@/components/meal-plan/RecipeSearchModal")
);

export function resolveInitialMealPlanView(
  storage?: Pick<Storage, "getItem">
): MealPlanView {
  try {
    const storedView =
      storage?.getItem("cal_view") ??
      (typeof localStorage === "undefined"
        ? null
        : localStorage.getItem("cal_view"));
    if (storedView === "day" || storedView === "week" || storedView === "month") {
      return storedView;
    }
  } catch {
    // Use the default view when storage is unavailable.
  }

  return "week";
}

export function getMealPlanAlternatePreloadOrder(
  initialView: MealPlanView
): Array<Exclude<MealPlanView, "week">> {
  return initialView === "month" ? ["month", "day"] : ["day", "month"];
}

export function scheduleMealPlanPreload(task: () => void): () => void {
  let cancelled = false;
  let started = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let idleCallbackId: number | undefined;

  const run = () => {
    if (cancelled) {
      return;
    }

    started = true;
    task();
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    idleCallbackId = window.requestIdleCallback(run, {
      timeout: MEAL_PLAN_PRELOAD_TIMEOUT_MS,
    });
  } else {
    timeoutId = setTimeout(run, MEAL_PLAN_PRELOAD_TIMEOUT_MS);
  }

  return () => {
    cancelled = true;
    if (idleCallbackId !== undefined && typeof window !== "undefined") {
      window.cancelIdleCallback(idleCallbackId);
    }
    if (!started && timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  };
}
