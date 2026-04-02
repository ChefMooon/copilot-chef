export const recipeKeys = {
  all: ["recipes"] as const,
  detail: (recipeId: string) => ["recipe", recipeId] as const,
};
