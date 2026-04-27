import { z } from "zod";

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
  totalRecipes: z.number(),
  favouriteCount: z.number(),
  filteredRecipes: z.number(),
  showingFavouritesOnly: z.boolean(),
  visibleRecipes: z.array(recipeListItemSchema),
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
export type MinimalPageContext = z.infer<typeof minimalPageContextSchema>;
export type PageContext = z.infer<typeof pageContextSchema>;