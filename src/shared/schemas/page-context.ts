import { z } from "zod";
import {
  RECIPE_SEARCH_SORT_MODE_VALUES,
  RECIPE_SORT_BY_VALUES,
  RECIPE_SORT_ORDER_VALUES,
} from "@shared/api/constants";

export const mealItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  mealType: z.string(),
  date: z.string(),
});

export const mealPlanPageContextSchema = z.object({
  page: z.literal("meal-plan"),
  view: z.enum(["day", "week", "month"]),
  date: z.string(),
  dateRangeFrom: z.string(),
  dateRangeTo: z.string(),
  meals: z.array(mealItemSchema),
});

export const groceryItemContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  qty: z.string().nullable(),
  unit: z.string().nullable(),
  category: z.string(),
  checked: z.boolean(),
});

export const groceryListSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  itemCount: z.number(),
  checkedCount: z.number(),
});

export const groceryListPageContextSchema = z.object({
  page: z.literal("grocery-list"),
  activeList: z
    .object({
      id: z.string(),
      name: z.string(),
      items: z.array(groceryItemContextSchema),
      totalItems: z.number(),
      checkedCount: z.number(),
      completionPercentage: z.number(),
    })
    .nullable(),
  allLists: z.array(groceryListSummarySchema),
});

export const homePageContextSchema = z.object({
  page: z.literal("home"),
  totalMeals: z.number(),
  groceryListName: z.string().nullable(),
  groceryCompletion: z.number(),
});

export const recipeListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  origin: z.string(),
  cuisine: z.string().nullable(),
  favourite: z.boolean(),
});

export const recipesPageContextSchema = z.object({
  page: z.literal("recipes"),
  search: z.string(),
  origin: z.string(),
  cuisine: z.string(),
  sortBy: z.enum(RECIPE_SORT_BY_VALUES),
  sortOrder: z.enum(RECIPE_SORT_ORDER_VALUES),
  searchSortMode: z.enum(RECIPE_SEARCH_SORT_MODE_VALUES),
  totalRecipes: z.number(),
  favouriteCount: z.number(),
  filteredRecipes: z.number(),
  showingFavouritesOnly: z.boolean(),
  visibleRecipes: z.array(recipeListItemSchema),
  recipeEditor: z
    .object({
      isOpen: z.boolean(),
      mode: z.enum(["add", "edit"]),
      draft: z
        .object({
          title: z.string(),
          description: z.string().nullable(),
          servings: z.number().int().positive().nullable(),
          ingredientCount: z.number().int().nonnegative(),
          instructionCount: z.number().int().nonnegative(),
          cuisine: z.string().nullable(),
          difficulty: z.string().nullable(),
          tagsCount: z.number().int().nonnegative(),
        })
        .nullable(),
    })
    .optional(),
});

export const recipeDetailIngredientContextSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
});

export const recipeDetailPageContextSchema = z.object({
  page: z.literal("recipe-detail"),
  recipeId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  difficulty: z.string().nullable(),
  cuisine: z.string().nullable(),
  servings: z.number(),
  prepTime: z.number().nullable(),
  cookTime: z.number().nullable(),
  rating: z.number().nullable(),
  origin: z.string(),
  favourite: z.boolean(),
  tags: z.array(z.string()),
  ingredients: z.array(recipeDetailIngredientContextSchema),
  activeView: z.enum(["basic", "detailed", "cooking"]),
  activeUnitMode: z.enum(["cup", "grams"]),
  cookingStepNumber: z.number().int().positive().nullable(),
});

export const shoppingPageContextSchema = z.object({
  page: z.literal("shopping"),
  listId: z.string(),
  listName: z.string(),
  itemCount: z.number(),
  checkedCount: z.number(),
  completionPercentage: z.number(),
  items: z.array(groceryItemContextSchema),
});

export const prepItemContextSchema = z.object({
  id: z.string(),
  kind: z.enum(["ingredient", "task"]),
  name: z.string(),
  qty: z.string().nullable(),
  unit: z.string().nullable(),
  ingredientType: z.string().nullable(),
  prepGroup: z.string().nullable(),
  dish: z.string().nullable(),
  checked: z.boolean(),
});

export const prepListSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  notes: z.string().nullable(),
  sourceMode: z.string(),
  itemCount: z.number(),
  checkedCount: z.number(),
});

export const prepListsPageContextSchema = z.object({
  page: z.literal("prep-lists"),
  activeList: z
    .object({
      id: z.string(),
      name: z.string(),
      notes: z.string().nullable(),
      sourceMode: z.string(),
      sourceLabel: z.string().nullable(),
      groupBy: z.string(),
      sortMode: z.string(),
      totalItems: z.number(),
      checkedCount: z.number(),
      completionPercentage: z.number(),
      items: z.array(prepItemContextSchema),
    })
    .nullable(),
  allLists: z.array(prepListSummarySchema),
});

export const prepPageContextSchema = z.object({
  page: z.literal("prep"),
  listId: z.string(),
  listName: z.string(),
  notes: z.string().nullable(),
  sourceMode: z.string(),
  groupBy: z.string(),
  sortMode: z.string(),
  itemCount: z.number(),
  checkedCount: z.number(),
  completionPercentage: z.number(),
  items: z.array(prepItemContextSchema),
});

export const minimalPageContextSchema = z.object({
  page: z.enum(["stats", "settings"]),
});

export const pageContextSchema = z.union([
  mealPlanPageContextSchema,
  groceryListPageContextSchema,
  homePageContextSchema,
  recipesPageContextSchema,
  recipeDetailPageContextSchema,
  shoppingPageContextSchema,
  prepListsPageContextSchema,
  prepPageContextSchema,
  minimalPageContextSchema,
]);

export type MealItem = z.infer<typeof mealItemSchema>;
export type MealPlanPageContext = z.infer<typeof mealPlanPageContextSchema>;
export type GroceryItemContext = z.infer<typeof groceryItemContextSchema>;
export type GroceryListSummary = z.infer<typeof groceryListSummarySchema>;
export type GroceryListPageContext = z.infer<typeof groceryListPageContextSchema>;
export type HomePageContext = z.infer<typeof homePageContextSchema>;
export type RecipeListItem = z.infer<typeof recipeListItemSchema>;
export type RecipesPageContext = z.infer<typeof recipesPageContextSchema>;
export type RecipeDetailIngredientContext = z.infer<
  typeof recipeDetailIngredientContextSchema
>;
export type RecipeDetailPageContext = z.infer<
  typeof recipeDetailPageContextSchema
>;
export type ShoppingPageContext = z.infer<typeof shoppingPageContextSchema>;
export type PrepItemContext = z.infer<typeof prepItemContextSchema>;
export type PrepListSummary = z.infer<typeof prepListSummarySchema>;
export type PrepListsPageContext = z.infer<typeof prepListsPageContextSchema>;
export type PrepPageContext = z.infer<typeof prepPageContextSchema>;
export type MinimalPageContext = z.infer<typeof minimalPageContextSchema>;
export type PageContext = z.infer<typeof pageContextSchema>;