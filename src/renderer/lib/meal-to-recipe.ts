import { type RecipePayload } from "./api";
import { type EditableMeal } from "./calendar";

function parseMealQuantity(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const [, whole, numerator, denominator] = mixedMatch;
    return Number(whole) + Number(numerator) / Number(denominator);
  }

  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const [, numerator, denominator] = fractionMatch;
    return Number(numerator) / Number(denominator);
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mealToRecipePayload(meal: EditableMeal): RecipePayload {
  return {
    id: "",
    title: meal.name,
    description: meal.description || null,
    servings: meal.servings,
    prepTime: meal.prepTime,
    cookTime: meal.cookTime,
    difficulty: null,
    instructions: meal.instructions,
    sourceUrl: null,
    sourceLabel: null,
    origin: "manual",
    rating: null,
    cookNotes: null,
    lastMadeAt: null,
    ingredients: meal.ingredients.map((ingredient, index) => ({
      id: `new-${index}`,
      name: ingredient.name,
      quantity: parseMealQuantity(ingredient.quantity),
      unit: ingredient.unit,
      group: ingredient.group,
      notes: ingredient.notes,
      order: ingredient.order ?? index,
    })),
    tags: [],
    linkedSubRecipes: [],
  };
}
