export const recipeKeys = {
  all: ["recipes"] as const,
  detail: (recipeId: string) => ["recipe", recipeId] as const,
  madeHistory: (recipeId: string) => ["recipe", recipeId, "made-history"] as const,
  iterations: (recipeId: string) => ["recipe", recipeId, "iterations"] as const,
};
