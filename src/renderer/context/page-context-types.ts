export type {
  MealItem,
  MealPlanPageContext,
  GroceryItemContext,
  GroceryListSummary,
  GroceryListPageContext,
  HomePageContext,
  RecipesPageContext,
  RecipeDetailIngredientContext,
  RecipeDetailPageContext,
  ShoppingPageContext,
  MinimalPageContext,
  PageContext,
} from "@shared/schemas/page-context";

import type { PageContext } from "@shared/schemas/page-context";

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
      const planPart = ` Meals currently scheduled this week: ${ctx.totalMeals}.`;
      const listPart = ctx.groceryListName
        ? ` Active grocery list: "${ctx.groceryListName}" (${ctx.groceryCompletion}% complete).`
        : " No active grocery list.";
      return `The user is on the Home page.${planPart}${listPart}`;
    }
    case "recipes": {
      const listLines =
        ctx.visibleRecipes.length > 0
          ? ctx.visibleRecipes
              .map((recipe) => `  - ${recipe.title} (${recipe.origin})`)
              .join("\n")
          : "  (no recipes in current filter)";

      const searchText = ctx.search.trim() ? ` Search: "${ctx.search.trim()}".` : "";
      const originText =
        ctx.origin === "all" ? " Origin filter: all." : ` Origin filter: ${ctx.origin}.`;
      const editorText = ctx.recipeEditor
        ? ctx.recipeEditor.isOpen
          ? `\nRecipe editor is open in ${ctx.recipeEditor.mode} mode.`
          : "\nRecipe editor is closed."
        : "";
      const draftText =
        ctx.recipeEditor?.isOpen && ctx.recipeEditor.draft
          ? ` Draft so far: title="${ctx.recipeEditor.draft.title || "(untitled)"}", servings=${ctx.recipeEditor.draft.servings ?? "(unset)"}, ingredients=${ctx.recipeEditor.draft.ingredientCount}, instructions=${ctx.recipeEditor.draft.instructionCount}, cuisine=${ctx.recipeEditor.draft.cuisine ?? "(unset)"}, difficulty=${ctx.recipeEditor.draft.difficulty ?? "(unset)"}, tags=${ctx.recipeEditor.draft.tagsCount}.`
          : "";

      return (
        `The user is on the Recipes page.${searchText}${originText}\n` +
        `Showing ${ctx.filteredRecipes} of ${ctx.totalRecipes} recipes.\n` +
        `Visible recipes:\n${listLines}${editorText}${draftText}`
      );
    }
    case "recipe-detail": {
      const ingredientLines =
        ctx.ingredients.length > 0
          ? ctx.ingredients
              .slice(0, 20)
              .map((ingredient) => {
                const quantity =
                  ingredient.quantity === null ? "" : `${ingredient.quantity} `;
                const unit = ingredient.unit ? `${ingredient.unit} ` : "";
                return `  - ${quantity}${unit}${ingredient.name}`.trimEnd();
              })
              .join("\n")
          : "  (no ingredients listed)";
      const descriptionText = ctx.description
        ? ` Description: ${ctx.description}`
        : "";
      const difficultyText = ctx.difficulty
        ? ` Difficulty: ${ctx.difficulty}.`
        : "";
      const timingText =
        ctx.prepTime !== null || ctx.cookTime !== null
          ? ` Prep: ${ctx.prepTime ?? 0}m. Cook: ${ctx.cookTime ?? 0}m.`
          : "";
      const ratingText =
        ctx.rating !== null ? ` Rating: ${ctx.rating}/5.` : "";
      const tagsText =
        ctx.tags.length > 0 ? ` Tags: ${ctx.tags.join(", ")}.` : "";
      const viewStateText =
        ` Viewing mode: ${ctx.activeView}. Unit mode: ${ctx.activeUnitMode}.` +
        (ctx.activeView === "cooking"
          ? ` Current cooking step: ${ctx.cookingStepNumber ?? 1}.`
          : "");

      return (
        `The user is viewing the recipe "${ctx.title}" (${ctx.origin}).` +
        ` Serves ${ctx.servings}.` +
        difficultyText +
        timingText +
        ratingText +
        tagsText +
        viewStateText +
        descriptionText +
        `\nIngredients:\n${ingredientLines}`
      );
    }
    case "shopping": {
      const itemLines =
        ctx.items.length > 0
          ? ctx.items
              .map(
                (item) =>
                  `  - [${item.checked ? "x" : " "}] ${item.qty ? item.qty + " " : ""}${item.unit ? item.unit + " " : ""}${item.name} (${item.category})`
              )
              .join("\n")
          : "  (empty list)";

      return (
        `The user is in Shopping Mode, working through "${ctx.listName}" ` +
        `(${ctx.completionPercentage}% complete, ${ctx.checkedCount}/${ctx.itemCount} items checked).\n` +
        `List items:\n${itemLines}`
      );
    }
    case "stats":
      return "The user is on the Stats page, viewing meal activity statistics.";
    case "settings":
      return "The user is on the Settings page, managing household preferences.";
  }
}
