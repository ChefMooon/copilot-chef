import Link from "next/link";

import { Button } from "@/components/ui/button";
import { type RecipePayload } from "@/lib/api";

import { SourceBadge } from "./SourceBadge";

type RecipeCardProps = {
  recipe: RecipePayload;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEdit?: (recipe: RecipePayload) => void;
  onDelete?: (recipe: RecipePayload) => void;
};

export function RecipeCard({
  recipe,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: RecipeCardProps) {
  const hasDifficulty = Boolean(recipe.difficulty?.trim());
  const hasPrepTime = recipe.prepTime != null;
  const hasCookTime = recipe.cookTime != null;
  const hasRating = recipe.rating != null;
  const showMeta = hasDifficulty || hasPrepTime || hasCookTime || hasRating;

  return (
    <article className="rounded-card border border-cream-dark bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <Link className="line-clamp-2 text-base font-semibold leading-tight text-text sm:text-lg" href={`/recipes/${recipe.id}`}>
          {recipe.title}
        </Link>
        <div className="flex items-center gap-1.5">
          {onEdit ? (
            <Button
              aria-label={`Edit ${recipe.title}`}
              className="h-4 w-4 min-w-4 rounded-[4px] p-0 text-text-muted hover:text-green"
              onClick={() => onEdit(recipe)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M15.07 4a0.49 0.49 0 0 0 -0.36 -0.15 0.5 0.5 0 0 0 -0.35 0.14L3.44 14.91a0.5 0.5 0 0 0 0 0.71l4.94 4.94a0.51 0.51 0 0 0 0.36 0.15 0.49 0.49 0 0 0 0.35 -0.15L20 9.65a0.51 0.51 0 0 0 0 -0.71Z"
                  fill="currentColor"
                />
                <path
                  d="M2.43 16.8a0.51 0.51 0 0 0 -0.84 0.24L0.08 23.31a0.49 0.49 0 0 0 0.14 0.47 0.51 0.51 0 0 0 0.47 0.14L7 22.41a0.49 0.49 0 0 0 0.36 -0.35 0.52 0.52 0 0 0 -0.12 -0.49Z"
                  fill="currentColor"
                />
                <path
                  d="M23.2 2.92 21.08 0.8a2.52 2.52 0 0 0 -3.54 0l-1.41 1.42a0.48 0.48 0 0 0 0 0.7l4.95 5a0.48 0.48 0 0 0 0.7 0l1.42 -1.47a2.5 2.5 0 0 0 0 -3.53Z"
                  fill="currentColor"
                />
              </svg>
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              aria-label={`Delete ${recipe.title}`}
              className="h-4 w-4 min-w-4 rounded-[4px] p-0 text-text-muted hover:text-orange"
              onClick={() => onDelete(recipe)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M5.2805 0.7020642857142857 5.06 1.14H2.1199999999999997c-0.5420642857142857 0 -0.98 0.4379392857142857 -0.98 0.98S1.5779357142857142 3.0999999999999996 2.1199999999999997 3.0999999999999996h11.759999999999998c0.5420607142857142 0 0.98 -0.43793571428571426 0.98 -0.98s-0.4379392857142857 -0.98 -0.98 -0.98h-2.9399999999999995l-0.2205 -0.43793571428571426C10.554124999999999 0.36824999999999997 10.214189285714285 0.16 9.843625000000001 0.16h-3.6872499999999997c-0.3705642857142857 0 -0.7104999999999999 0.20825 -0.875875 0.5420642857142857ZM13.879999999999999 4.079999999999999H2.1199999999999997l0.6492499999999999 10.381874999999999c0.049 0.7748142857142857 0.692125 1.3781249999999998 1.4669392857142856 1.3781249999999998h7.5276250000000005c0.7748107142857142 0 1.417935714285714 -0.6033107142857143 1.466935714285714 -1.3781249999999998L13.879999999999999 4.079999999999999Z"
                  fill="currentColor"
                />
              </svg>
            </Button>
          ) : null}
          {onToggleSelect ? (
            <input
              checked={Boolean(selected)}
              className="h-4 w-4 rounded border-cream-dark text-green focus:ring-green"
              onChange={() => onToggleSelect(recipe.id)}
              type="checkbox"
            />
          ) : null}
        </div>
      </div>
      <SourceBadge origin={recipe.origin} sourceLabel={recipe.sourceLabel} />
      <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-text-muted sm:mt-3 sm:text-sm">
        {recipe.description || "No description"}
      </p>
      {showMeta ? (
        <div className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-medium text-text-muted sm:mt-3 sm:text-xs">
          {hasDifficulty ? <span>{recipe.difficulty}</span> : null}
          {hasPrepTime ? <span>Prep {recipe.prepTime}m</span> : null}
          {hasCookTime ? <span>Cook {recipe.cookTime}m</span> : null}
          {hasRating ? <span>★ {recipe.rating}</span> : null}
        </div>
      ) : null}
    </article>
  );
}
