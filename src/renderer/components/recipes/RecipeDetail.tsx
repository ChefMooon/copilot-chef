import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { convertIngredient, type UnitMode } from "@/lib/recipe-units";
import { formatFraction } from "@/lib/fractions";
import { annotateInstructionSteps } from "@/lib/recipe-instruction-annotations";
import { recipeKeys } from "@/lib/query-keys";

import {
  deleteRecipe,
  updateRecipe,
  type RecipePayload,
} from "@/lib/api";
import { AddRecipeModal } from "@/components/recipes/AddRecipeModal";
import { Button } from "@/components/ui/button";

import { CookingMode } from "./CookingMode";
import { IngredientRow } from "./IngredientRow";
import { ServingsScaler } from "./ServingsScaler";
import { SourceBadge } from "./SourceBadge";

type RecipeDetailProps = {
  recipe: RecipePayload;
  defaultView: "basic" | "detailed" | "cooking";
  defaultUnitMode: UnitMode;
};

const VIEW_LABELS = {
  basic: "Basic",
  detailed: "Annotated",
  cooking: "Cooking",
  print: "Print",
} as const;

export function RecipeDetail({
  recipe,
  defaultView,
  defaultUnitMode,
}: RecipeDetailProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"basic" | "detailed" | "cooking" | "print">(
    defaultView
  );
  const [servings, setServings] = useState(recipe.servings);
  const [unitMode, setUnitMode] = useState<UnitMode>(defaultUnitMode);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setServings(recipe.servings);
  }, [recipe]);

  const scale = servings / Math.max(1, recipe.servings);
  const recipeQueryKey = recipeKeys.detail(recipe.id);

  const ingredientDisplays = useMemo(
    () =>
      recipe.ingredients.map((ingredient) => {
        const scaledQuantity =
          ingredient.quantity == null ? null : ingredient.quantity * scale;
        const converted = convertIngredient(
          scaledQuantity,
          ingredient.unit,
          ingredient.name,
          unitMode
        );
        const quantityPart =
          converted.quantity != null
            ? `${converted.approximate ? "~" : ""}${formatFraction(converted.quantity)}`
            : "";
        const amountText = quantityPart
          ? [quantityPart, converted.unit ?? ""].filter(Boolean).join(" ")
          : null;
        const display = [quantityPart, converted.unit ?? "", ingredient.name]
          .filter(Boolean)
          .join(" ");

        return {
          id: ingredient.id,
          name: ingredient.name,
          amountText,
          display,
          notes: ingredient.notes,
          group: ingredient.group?.trim() ?? "",
        };
      }),
    [recipe.ingredients, scale, unitMode]
  );

  const detailedInstructionSteps = useMemo(
    () =>
      annotateInstructionSteps(
        recipe.instructions,
        ingredientDisplays.map((ingredient) => ({
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          amountText: ingredient.amountText,
        }))
      ),
    [ingredientDisplays, recipe.instructions]
  );

  async function handleSaveEdit(
    input: Parameters<typeof updateRecipe>[1]
  ): Promise<void> {
    setIsSavingEdit(true);
    try {
      const updated = await updateRecipe(recipe.id, input);
      queryClient.setQueryData(recipeQueryKey, updated);
      setServings(updated.servings);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: recipeQueryKey,
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: recipeKeys.all,
          refetchType: "active",
        }),
      ]);

      setShowEditModal(false);
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(): Promise<void> {
    const confirmed = window.confirm(
      "Delete this recipe? This action cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteRecipe(recipe.id);
      navigate("/recipes");
    } finally {
      setIsDeleting(false);
    }
  }

  if (view === "cooking") {
    return (
      <CookingMode
        onClose={() => setView("basic")}
        steps={recipe.instructions}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="rounded-[18px] border border-[rgba(59,94,69,0.1)] bg-white p-5 shadow-card md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">
              Recipe Library
            </p>
            <h1 className="font-serif text-[2rem] font-bold leading-[1.12] text-text sm:text-[2.35rem]">
              {recipe.title}
            </h1>
            {recipe.description ? (
              <p className="mt-2 text-sm text-text-muted">{recipe.description}</p>
            ) : (
              <p className="mt-2 text-sm text-text-muted">
                Review ingredients, adjust servings, and cook with confidence.
              </p>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button asChild size="sm" type="button" variant="outline">
              <Link to="/recipes">Back to Recipes</Link>
            </Button>
            <Button
              onClick={() => setShowEditModal(true)}
              size="sm"
              type="button"
              variant="default"
            >
              Edit
            </Button>
            <Button
              disabled={isDeleting}
              onClick={() => void handleDelete()}
              size="sm"
              type="button"
              variant="accent"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem] font-semibold text-text-muted">
          <SourceBadge
            origin={recipe.origin}
            sourceLabel={recipe.sourceLabel}
          />
          {recipe.difficulty ? (
            <span className="rounded-chip border border-cream-dark bg-cream px-2 py-0.5 text-[0.72rem] font-bold uppercase tracking-[0.06em]">
              {recipe.difficulty}
            </span>
          ) : null}
          {recipe.prepTime != null ? (
            <span>Prep {recipe.prepTime}m</span>
          ) : null}
          {recipe.cookTime != null ? (
            <span>Cook {recipe.cookTime}m</span>
          ) : null}
          <span>&#9733; {recipe.rating ?? "-"}</span>
          <span>
            Last made: {recipe.lastMadeAt ? new Date(recipe.lastMadeAt).toLocaleDateString() : "Never"}
          </span>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 rounded-[14px] border border-[rgba(59,94,69,0.08)] bg-white p-2 shadow-card">
        {(["basic", "detailed", "cooking", "print"] as const).map((mode) => (
          <button
            key={mode}
            className={`rounded-[10px] border px-3 py-1.5 text-[0.82rem] font-bold capitalize transition-colors ${
              view === mode
                ? "border-green bg-green text-white"
                : "border-cream-dark bg-cream text-text-muted hover:border-green-light hover:text-green"
            }`}
            onClick={() => {
              if (mode === "print") {
                window.print();
              }
              setView(mode);
            }}
            type="button"
          >
            {VIEW_LABELS[mode]}
          </button>
        ))}
      </div>

      <ServingsScaler
        baseServings={recipe.servings}
        onServingsChange={setServings}
        onUnitModeChange={setUnitMode}
        servings={servings}
        unitMode={unitMode}
      />

      <section className="rounded-[18px] border border-[rgba(59,94,69,0.1)] bg-white p-5 shadow-card md:p-6">
        <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted">
          Ingredients
        </p>
        <div className="mt-2 space-y-3">
          {Array.from(
            ingredientDisplays.reduce((acc, ingredient) => {
              const key = ingredient.group;
              const items = acc.get(key) ?? [];
              items.push(ingredient);
              acc.set(key, items);
              return acc;
            }, new Map<string, typeof ingredientDisplays>())
          ).map(([groupName, groupIngredients]) => (
            <div key={groupName || "ungrouped"}>
              {groupName ? (
                <h4 className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
                  {groupName}
                </h4>
              ) : null}
              <ul className="divide-y divide-cream-dark">
                {groupIngredients.map((ingredient) => (
                  <IngredientRow
                    key={ingredient.id}
                    display={ingredient.display}
                    notes={ingredient.notes}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-[rgba(59,94,69,0.1)] bg-white p-5 shadow-card md:p-6">
        <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted">
          {view === "detailed" ? "Annotated Instructions" : "Instructions"}
        </p>
        {view === "detailed" ? (
          <p className="mt-2 text-[0.8rem] leading-relaxed text-text-muted">
            Matching ingredients show scaled amounts inline when the step text
            directly references them.
          </p>
        ) : null}
        <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[0.92rem] leading-relaxed text-text">
          {(view === "detailed" ? detailedInstructionSteps : recipe.instructions).map(
            (step, index) => (
              <li
                key={
                  view === "detailed"
                    ? `${index}-${step.parts.map((part) => part.type === "text" ? part.value : part.text).join("")}`
                    : `${index}-${step}`
                }
              >
                {view === "detailed"
                  ? step.parts.map((part, partIndex) => {
                      if (part.type === "text") {
                        return (
                          <span key={`text-${partIndex}`}>{part.value}</span>
                        );
                      }

                      return (
                        <span key={`${part.ingredientId}-${partIndex}`}>
                          {part.text}
                          <span className="ml-1 rounded-full bg-green/10 px-1.5 py-0.5 text-[0.76rem] font-semibold text-green">
                            {part.amountText}
                          </span>
                        </span>
                      );
                    })
                  : step}
              </li>
            )
          )}
        </ol>
      </section>

      {recipe.cookNotes ? (
        <section className="rounded-[18px] border border-[rgba(59,94,69,0.1)] bg-white p-5 shadow-card md:p-6">
          <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted">
            Cook Notes
          </p>
          <p className="mt-2 whitespace-pre-line text-[0.92rem] leading-relaxed text-text">
            {recipe.cookNotes}
          </p>
        </section>
      ) : null}

      <AddRecipeModal
        key={recipe.id}
        initialRecipe={recipe}
        isSaving={isSavingEdit}
        onClose={() => {
          if (!isSavingEdit) {
            setShowEditModal(false);
          }
        }}
        onSave={handleSaveEdit}
        open={showEditModal}
      />
    </div>
  );
}
