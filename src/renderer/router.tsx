import { Suspense, lazy } from "react";
import { createBrowserRouter, createHashRouter } from "react-router";

import { AuthenticatedAppLayout, PublicBrowserLayout } from "./app";
import { RouteErrorBoundary } from "./components/layout/route-error-boundary";
import { getPlatform } from "./lib/platform";

const HomePage = lazy(() => import("./pages/home"));
const MealPlanPage = lazy(() => import("./pages/meal-plan"));
const GroceryListPage = lazy(() => import("./pages/grocery-list"));
const ShoppingPage = lazy(() => import("./pages/grocery-list/shop"));
const PrepListsPage = lazy(() => import("./pages/prep-lists"));
const PrepViewPage = lazy(() => import("./pages/prep-lists/prep"));
const RecipesPage = lazy(() => import("./pages/recipes"));
const RecipeDetailPage = lazy(() => import("./pages/recipes/detail"));
const StatsPage = lazy(() => import("./pages/stats"));
const SettingsPage = lazy(() => import("./pages/settings"));
const ConnectPage = lazy(() => import("./pages/connect"));

function withRouteFallback(element: React.ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6">
          <p className="text-sm text-text-muted">Loading page...</p>
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

const authenticatedRoutes = [
  {
    path: "/",
    element: <AuthenticatedAppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: withRouteFallback(<HomePage />) },
      { path: "meal-plan", element: withRouteFallback(<MealPlanPage />) },
      {
        path: "grocery-list",
        element: withRouteFallback(<GroceryListPage />),
      },
      {
        path: "grocery-list/shop/:id",
        element: withRouteFallback(<ShoppingPage />),
      },
      {
        path: "prep-lists",
        element: withRouteFallback(<PrepListsPage />),
      },
      {
        path: "prep-lists/prep/:id",
        element: withRouteFallback(<PrepViewPage />),
      },
      { path: "recipes", element: withRouteFallback(<RecipesPage />) },
      {
        path: "recipes/:recipeId",
        element: withRouteFallback(<RecipeDetailPage />),
      },
      { path: "stats", element: withRouteFallback(<StatsPage />) },
      { path: "settings", element: withRouteFallback(<SettingsPage />) },
    ],
  },
];

const browserRoutes = [
  {
    path: "/connect",
    element: <PublicBrowserLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [{ index: true, element: withRouteFallback(<ConnectPage />) }],
  },
  ...authenticatedRoutes,
];

export const router =
  getPlatform().runtime === "electron"
    ? createHashRouter(authenticatedRoutes)
    : createBrowserRouter(browserRoutes);
