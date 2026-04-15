import type { PageContext } from "@shared/schemas/page-context";

export function getMinimalContextForPath(path: string): string {
  if (path === "/") return "The user is on the Home page.";
  if (path === "/meal-plan") return "The user is on the Meal Plan page.";
  if (path === "/grocery-list") {
    return "The user is on the Grocery List page.";
  }
  if (path.startsWith("/grocery-list/shop/")) {
    return "The user is on the Shopping Mode page, working through a grocery list.";
  }
  if (path === "/recipes") return "The user is on the Recipes page.";
  if (path.startsWith("/recipes/")) {
    return "The user is on the Recipe Detail page, viewing a specific recipe.";
  }
  if (path === "/stats") {
    return "The user is on the Stats page, viewing meal activity statistics.";
  }
  if (path === "/settings") {
    return "The user is on the Settings page, managing household preferences.";
  }
  return `The user is on the ${path} page.`;
}

export function getActivePageContext(
  path: string,
  pageContext: PageContext | null,
  pageContextPath: string | null
): PageContext | null {
  if (!pageContext || !pageContextPath) {
    return null;
  }

  return pageContextPath === path ? pageContext : null;
}