import { Link } from "react-router";
import { PencilSimple, Star, Trash } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type RecipePayload } from "@/lib/api";
import { getCuisineLabel } from "@shared/api/constants";

import { SourceBadge } from "./SourceBadge";

type RecipeCardProps = {
  recipe: RecipePayload;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onToggleFavourite?: (recipe: RecipePayload, nextValue: boolean) => void;
  onEdit?: (recipe: RecipePayload) => void;
  onDelete?: (recipe: RecipePayload) => void;
};

export function RecipeCard({
  recipe,
  selected,
  onToggleSelect,
  onToggleFavourite,
  onEdit,
  onDelete,
}: RecipeCardProps) {
  const hasDifficulty = Boolean(recipe.difficulty?.trim());
  const hasPrepTime = recipe.prepTime != null;
  const hasCookTime = recipe.cookTime != null;
  const hasRating = recipe.rating != null;
  const cuisineLabel = getCuisineLabel(recipe.cuisine);
  const showMeta =
    Boolean(cuisineLabel) ||
    hasDifficulty ||
    hasPrepTime ||
    hasCookTime ||
    hasRating;

  return (
    <article
      className={`rounded-card flex h-[168px] flex-col overflow-hidden border border-cream-dark bg-white px-3 pb-1.5 pt-2.5 shadow-sm transition-all sm:h-[180px] sm:px-4 sm:pb-2 sm:pt-3 ${selected ? "ring-2 ring-green ring-offset-2" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        {onToggleSelect ? (
          <input
            aria-label={`Select ${recipe.title}`}
            checked={Boolean(selected)}
            className="h-4 w-4 flex-shrink-0 rounded border-cream-dark text-green focus:ring-green"
            onChange={() => onToggleSelect(recipe.id)}
            type="checkbox"
          />
        ) : null}
        <Link
          className="line-clamp-2 flex-1 text-base font-semibold leading-tight text-text sm:text-lg"
          to={`/recipes/${recipe.id}`}
        >
          {recipe.title}
        </Link>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {onToggleFavourite ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={`${recipe.favourite ? "Remove" : "Add"} ${recipe.title} ${recipe.favourite ? "from" : "to"} favourites`}
                  className={`h-4 min-h-8 w-4 min-w-8 rounded-[4px] border p-0 ${recipe.favourite ? "border-orange/30 bg-orange/10 text-orange hover:bg-orange/15 hover:text-orange" : "border-cream-dark bg-cream text-text-muted hover:border-orange/40 hover:bg-orange/5 hover:text-orange"}`}
                  onClick={() => onToggleFavourite(recipe, !recipe.favourite)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Star
                    aria-hidden="true"
                    size={14}
                    weight={recipe.favourite ? "bold" : "regular"}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {recipe.favourite ? "Remove from favourites" : "Add to favourites"}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {onEdit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={`Edit ${recipe.title}`}
                  className="h-4 min-h-8 w-4 min-w-8 rounded-[4px] p-0 text-text-muted hover:text-green"
                  onClick={() => onEdit(recipe)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <PencilSimple aria-hidden="true" size={12} weight="regular" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit recipe</TooltipContent>
            </Tooltip>
          ) : null}
          {onDelete ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={`Delete ${recipe.title}`}
                  className="h-4 min-h-8 w-4 min-w-8 rounded-[4px] p-0 text-text-muted hover:text-orange"
                  onClick={() => onDelete(recipe)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash aria-hidden="true" size={12} weight="bold" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete recipe</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
      <SourceBadge
        compact
        origin={recipe.origin}
        sourceLabel={recipe.sourceLabel}
        sourceUrl={recipe.sourceUrl}
      />
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-text-muted sm:mt-2 sm:text-sm">
        {recipe.description || "No description"}
      </p>
      {showMeta ? (
        <div className="mt-auto flex max-h-[3rem] flex-wrap gap-x-2.5 gap-y-0.5 overflow-hidden pt-1.5 text-[11px] font-medium sm:max-h-[3.25rem] sm:text-xs">
          {cuisineLabel ? (
            <span className="rounded-full bg-green-pale px-2 py-1 text-green">
              {cuisineLabel}
            </span>
          ) : null}
          {hasDifficulty ? (
            <span className="rounded-full bg-orange/15 px-2 py-1 text-orange">
              {recipe.difficulty}
            </span>
          ) : null}
          {hasPrepTime ? (
            <span className="rounded-full bg-green-pale px-2 py-1 text-green">
              Prep {recipe.prepTime}m
            </span>
          ) : null}
          {hasCookTime ? (
            <span className="rounded-full bg-orange/15 px-2 py-1 text-orange">
              Cook {recipe.cookTime}m
            </span>
          ) : null}
          {hasRating ? (
            <span className="rounded-full bg-green-pale px-2 py-1 text-green">
              ★ {recipe.rating}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
