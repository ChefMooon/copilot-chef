import { type RecipePayload } from "@/lib/api";

import { RecipeCard } from "./RecipeCard";

type RecipeGridProps = {
  recipes: RecipePayload[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleFavourite?: (recipe: RecipePayload, nextValue: boolean) => void;
  onEdit?: (recipe: RecipePayload) => void;
  onDelete?: (recipe: RecipePayload) => void;
};

export function RecipeGrid({
  recipes,
  selectedIds,
  onToggleSelect,
  onToggleFavourite,
  onEdit,
  onDelete,
}: RecipeGridProps) {
  if (recipes.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-cream-dark bg-white p-8 text-center text-sm text-text-muted">
        No recipes yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggleFavourite={onToggleFavourite}
          onToggleSelect={onToggleSelect}
          recipe={recipe}
          selected={selectedIds?.has(recipe.id)}
        />
      ))}
    </div>
  );
}
