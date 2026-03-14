export type MealItem = {
  id: string;
  name: string;
  mealType: string;
  date: string;
};

export type MealPlanPageContext = {
  page: "meal-plan";
  view: "day" | "week" | "month";
  date: string;
  dateRangeFrom: string;
  dateRangeTo: string;
  meals: MealItem[];
};

export type GroceryItemContext = {
  id: string;
  name: string;
  qty: string | null;
  unit: string | null;
  category: string;
  checked: boolean;
};

export type GroceryListSummary = {
  id: string;
  name: string;
  itemCount: number;
  checkedCount: number;
};

export type GroceryListPageContext = {
  page: "grocery-list";
  activeList: {
    id: string;
    name: string;
    items: GroceryItemContext[];
    totalItems: number;
    checkedCount: number;
    completionPercentage: number;
  } | null;
  allLists: GroceryListSummary[];
};

export type HomePageContext = {
  page: "home";
  mealPlanName: string | null;
  totalMeals: number;
  groceryListName: string | null;
  groceryCompletion: number;
};

export type MinimalPageContext = {
  page: "stats" | "settings";
};

export type PageContext =
  | MealPlanPageContext
  | GroceryListPageContext
  | HomePageContext
  | MinimalPageContext;

export function serializePageContext(ctx: PageContext): string {
  switch (ctx.page) {
    case "meal-plan": {
      const fmt = (iso: string) =>
        new Date(iso).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      const mealLines =
        ctx.meals.length > 0
          ? ctx.meals
              .map((m) => `  - ${m.mealType} on ${fmt(m.date)}: ${m.name}`)
              .join("\n")
          : "  (none)";
      return (
        `The user is on the Meal Plan page, ${ctx.view} view centered on ` +
        `${new Date(ctx.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.\n` +
        `Date range in view: ${new Date(ctx.dateRangeFrom).toLocaleDateString()} – ${new Date(ctx.dateRangeTo).toLocaleDateString()}.\n` +
        `Meals currently in view (${ctx.meals.length} total):\n${mealLines}`
      );
    }
    case "grocery-list": {
      const listSummaries =
        ctx.allLists.length > 0
          ? ctx.allLists
              .map(
                (l) =>
                  `  - "${l.name}": ${l.checkedCount}/${l.itemCount} items checked`
              )
              .join("\n")
          : "  (none)";
      if (!ctx.activeList) {
        return (
          `The user is on the Grocery List page. No list is currently selected.\n` +
          `All lists (${ctx.allLists.length}):\n${listSummaries}`
        );
      }
      const itemLines =
        ctx.activeList.items.length > 0
          ? ctx.activeList.items
              .map(
                (i) =>
                  `  - [${i.checked ? "x" : " "}] ${i.qty ? i.qty + " " : ""}${i.unit ? i.unit + " " : ""}${i.name} (${i.category})`
              )
              .join("\n")
          : "  (empty list)";
      return (
        `The user is on the Grocery List page, viewing "${ctx.activeList.name}" ` +
        `(${ctx.activeList.completionPercentage}% complete, ${ctx.activeList.checkedCount}/${ctx.activeList.totalItems} items checked).\n` +
        `Active list items:\n${itemLines}\n\n` +
        `Other lists (${ctx.allLists.length} total):\n${listSummaries}`
      );
    }
    case "home": {
      const planPart = ctx.mealPlanName
        ? ` Active meal plan: "${ctx.mealPlanName}" with ${ctx.totalMeals} meals.`
        : " No active meal plan.";
      const listPart = ctx.groceryListName
        ? ` Active grocery list: "${ctx.groceryListName}" (${ctx.groceryCompletion}% complete).`
        : " No active grocery list.";
      return `The user is on the Home page.${planPart}${listPart}`;
    }
    case "stats":
      return "The user is on the Stats page, viewing meal activity statistics.";
    case "settings":
      return "The user is on the Settings page, managing household preferences.";
  }
}
