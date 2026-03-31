import { createBrowserRouter } from "react-router";

import { AppLayout } from "./app";
import HomePage from "./pages/home";
import MealPlanPage from "./pages/meal-plan";
import GroceryListPage from "./pages/grocery-list";
import ShoppingPage from "./pages/grocery-list/shop";
import RecipesPage from "./pages/recipes";
import RecipeDetailPage from "./pages/recipes/detail";
import StatsPage from "./pages/stats";
import SettingsPage from "./pages/settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "meal-plan", element: <MealPlanPage /> },
      { path: "grocery-list", element: <GroceryListPage /> },
      { path: "grocery-list/shop/:id", element: <ShoppingPage /> },
      { path: "recipes", element: <RecipesPage /> },
      { path: "recipes/:recipeId", element: <RecipeDetailPage /> },
      { path: "stats", element: <StatsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
