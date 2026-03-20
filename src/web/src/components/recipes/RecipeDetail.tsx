"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { convertIngredient, type UnitMode } from "@/lib/recipe-units";

import {
  deleteRecipe,
  updateRecipe,
  type RecipePayload,
  type RecipePayload as Recipe,
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

export function RecipeDetail({
  recipe,
  defaultView,
  defaultUnitMode,
}: RecipeDetailProps) {
  const router = useRouter();
  const [recipeData, setRecipeData] = useState<Recipe>(recipe);
  const [view, setView] = useState<"basic" | "detailed" | "cooking" | "print">(
    defaultView
  );
  const [servings, setServings] = useState(recipeData.servings);
  const [unitMode, setUnitMode] = useState<UnitMode>(defaultUnitMode);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const scale = servings / Math.max(1, recipeData.servings);

  const ingredientDisplays = useMemo(
    () =>
      recipeData.ingredients.map((ingredient) => {
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
            ? `${converted.approximate ? "~" : ""}${converted.quantity}`
            : "";
        const display = [quantityPart, converted.unit ?? "", ingredient.name]
          .filter(Boolean)
          .join(" ");

        return {
          id: ingredient.id,
          display,
          notes: ingredient.notes,
        };
      }),
    [recipeData.ingredients, scale, unitMode]
  );

  async function handleSaveEdit(
    input: Parameters<typeof updateRecipe>[1]
  ): Promise<void> {
    setIsSavingEdit(true);
    try {
      const updated = await updateRecipe(recipeData.id, input);
      setRecipeData(updated);
      setServings(updated.servings);
      setShowEditModal(false);
      router.refresh();
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
      await deleteRecipe(recipeData.id);
      router.push("/recipes");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  if (view === "cooking") {
    return (
      <CookingMode
        onClose={() => setView("basic")}
        steps={recipeData.instructions}
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
              {recipeData.title}
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Review ingredients, adjust servings, and cook with confidence.
            </p>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button asChild size="sm" type="button" variant="outline">
              <Link href="/recipes">Back to Recipes</Link>
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
            origin={recipeData.origin}
            sourceLabel={recipeData.sourceLabel}
          />
          {recipeData.difficulty ? (
            <span className="rounded-chip border border-cream-dark bg-cream px-2 py-0.5 text-[0.72rem] font-bold uppercase tracking-[0.06em]">
              {recipeData.difficulty}
            </span>
          ) : null}
          {recipeData.prepTime != null ? (
            <span>Prep {recipeData.prepTime}m</span>
          ) : null}
          {recipeData.cookTime != null ? (
            <span>Cook {recipeData.cookTime}m</span>
          ) : null}
          <span>&#9733; {recipeData.rating ?? "-"}</span>
          <span>
            Last made: {recipeData.lastMadeAt ? new Date(recipeData.lastMadeAt).toLocaleDateString() : "Never"}
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
            {mode}
          </button>
        ))}
      </div>

      <ServingsScaler
        baseServings={recipeData.servings}
        onServingsChange={setServings}
        onUnitModeChange={setUnitMode}
        servings={servings}
        unitMode={unitMode}
      />

      <section className="rounded-[18px] border border-[rgba(59,94,69,0.1)] bg-white p-5 shadow-card md:p-6">
        <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted">
          Ingredients
        </p>
        <ul className="mt-2 divide-y divide-cream-dark">
          {ingredientDisplays.map((ingredient) => (
            <IngredientRow
              key={ingredient.id}
              display={ingredient.display}
              notes={ingredient.notes}
            />
          ))}
        </ul>
      </section>

      <section className="rounded-[18px] border border-[rgba(59,94,69,0.1)] bg-white p-5 shadow-card md:p-6">
        <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted">
          Instructions
        </p>
        <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[0.92rem] leading-relaxed text-text">
          {recipeData.instructions.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ol>
      </section>

      {recipeData.cookNotes ? (
        <section className="rounded-[18px] border border-[rgba(59,94,69,0.1)] bg-white p-5 shadow-card md:p-6">
          <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted">
            Cook Notes
          </p>
          <p className="mt-2 whitespace-pre-line text-[0.92rem] leading-relaxed text-text">
            {recipeData.cookNotes}
          </p>
        </section>
      ) : null}

      <AddRecipeModal
        initialRecipe={recipeData}
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
