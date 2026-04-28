"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { type CreateRecipeInput, type RecipeConflict } from "@shared/types";
import { CUISINE_OPTIONS } from "@shared/api/constants";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isRecipeConflictError, type RecipePayload } from "@/lib/api";
import { formatFraction, parseFraction } from "@/lib/fractions";
import {
  isRecipeIngredientUnit,
  RECIPE_INGREDIENT_UNITS,
  type RecipeIngredientUnit,
} from "@/lib/ingredient-units";
import {
  type InstructionDraft,
  createEmptyInstructionDraft,
  instructionDraftsToPayload,
  payloadToInstructionDrafts,
} from "@/lib/recipe-instructions";

type IngredientDraft = {
  id: string;
  name: string;
  amount: string;
  notes: string;
  unit: RecipeIngredientUnit;
};

type IngredientGroupDraft = {
  id: string;
  name: string;
  ingredients: IngredientDraft[];
};

type FormState = {
  title: string;
  description: string;
  sourceUrl: string;
  sourceLabel: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  difficulty: string;
  cuisine: string;
  rating: string;
  cookNotes: string;
  instructions: InstructionDraft[];
  tagsText: string;
  ingredientGroups: IngredientGroupDraft[];
};

type AddRecipeModalProps = {
  open: boolean;
  initialRecipe?: RecipePayload | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (input: CreateRecipeInput) => Promise<void>;
  onConflict?: (conflict: RecipeConflict) => void;
  onDraftContextChange?: (draft: {
    title: string;
    description: string | null;
    servings: number | null;
    ingredientCount: number;
    instructionCount: number;
    cuisine: string | null;
    difficulty: string | null;
    tagsCount: number;
  } | null) => void;
};

function createEmptyIngredient(): IngredientDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: "",
    notes: "",
    unit: "g",
  };
}

function createEmptyIngredientGroup(name = ""): IngredientGroupDraft {
  return {
    id: crypto.randomUUID(),
    name,
    ingredients: [createEmptyIngredient()],
  };
}

function toIngredientGroups(recipe?: RecipePayload | null): IngredientGroupDraft[] {
  if (!recipe || recipe.ingredients.length === 0) {
    return [createEmptyIngredientGroup()];
  }

  const groupsByName = new Map<string, IngredientGroupDraft>();

  for (const ingredient of recipe.ingredients) {
    const normalized = ingredient.unit?.toLowerCase();
    const unit = isRecipeIngredientUnit(normalized) ? normalized : "g";

    const groupName = (ingredient.group ?? "").trim();
    const groupKey = groupName.toLowerCase();
    const existingGroup = groupsByName.get(groupKey);

    if (existingGroup) {
      existingGroup.ingredients.push({
        id: ingredient.id,
        name: ingredient.name,
        amount:
          typeof ingredient.quantity === "number" && Number.isFinite(ingredient.quantity)
            ? formatFraction(ingredient.quantity)
            : "",
        notes: ingredient.notes ?? "",
        unit,
      });
      continue;
    }

    groupsByName.set(groupKey, {
      id: crypto.randomUUID(),
      name: groupName,
      ingredients: [
        {
          id: ingredient.id,
          name: ingredient.name,
          amount:
            typeof ingredient.quantity === "number" && Number.isFinite(ingredient.quantity)
              ? formatFraction(ingredient.quantity)
              : "",
          notes: ingredient.notes ?? "",
          unit,
        },
      ],
    });
  }

  const groups = Array.from(groupsByName.values());
  return groups.length > 0 ? groups : [createEmptyIngredientGroup()];
}

function flattenIngredientGroups(groups: IngredientGroupDraft[]) {
  return groups.flatMap((group) =>
    group.ingredients.map((ingredient) => ({
      ...ingredient,
      group: group.name.trim() || null,
    }))
  );
}

export function AddRecipeModal({
  open,
  initialRecipe,
  isSaving,
  onClose,
  onSave,
  onConflict,
  onDraftContextChange,
}: AddRecipeModalProps) {
  const { toast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousOpenRef = useRef(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    sourceUrl: "",
    sourceLabel: "",
    servings: "2",
    prepTime: "",
    cookTime: "",
    difficulty: "",
    cuisine: "",
    rating: "",
    cookNotes: "",
    instructions: [],
    tagsText: "",
    ingredientGroups: [createEmptyIngredientGroup()],
  });

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    const openingNow = open && !previousOpenRef.current;

    if (openingNow) {
      setForm({
        title: initialRecipe?.title ?? "",
        description: initialRecipe?.description ?? "",
        sourceUrl: initialRecipe?.sourceUrl ?? "",
        sourceLabel: initialRecipe?.sourceLabel ?? "",
        servings: String(initialRecipe?.servings ?? 2),
        prepTime: initialRecipe?.prepTime != null ? String(initialRecipe.prepTime) : "",
        cookTime: initialRecipe?.cookTime != null ? String(initialRecipe.cookTime) : "",
        difficulty: initialRecipe?.difficulty ?? "",
        cuisine: initialRecipe?.cuisine ?? "",
        rating: initialRecipe?.rating != null ? String(initialRecipe.rating) : "",
        cookNotes: initialRecipe?.cookNotes ?? "",
        instructions:
          initialRecipe?.instructions && initialRecipe.instructions.length > 0
            ? payloadToInstructionDrafts(initialRecipe.instructions)
            : [],
        tagsText: initialRecipe?.tags.join(", ") ?? "",
        ingredientGroups: toIngredientGroups(initialRecipe),
      });
    }

    previousOpenRef.current = open;
  }, [open, initialRecipe]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const clickHandler = (event: MouseEvent) => {
      if (event.target === overlayRef.current) {
        onClose();
      }
    };

    window.addEventListener("keydown", keyHandler);
    overlayRef.current?.addEventListener("mousedown", clickHandler);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keyHandler);
      overlayRef.current?.removeEventListener("mousedown", clickHandler);
    };
  }, [open, onClose]);

  const instructionList = useMemo(
    () => instructionDraftsToPayload(form.instructions),
    [form.instructions]
  );

  const flattenedIngredients = useMemo(
    () => flattenIngredientGroups(form.ingredientGroups),
    [form.ingredientGroups]
  );

  useEffect(() => {
    if (!onDraftContextChange) {
      return;
    }

    if (!open) {
      onDraftContextChange(null);
      return;
    }

    const parsedServings = Number.parseInt(form.servings, 10);
    const instructionCount = instructionList.filter(
      (step) => step.trim().length > 0
    ).length;
    const ingredientCount = flattenedIngredients.filter(
      (ingredient) => ingredient.name.trim().length > 0
    ).length;
    const tagsCount = form.tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean).length;

    onDraftContextChange({
      title: form.title.trim(),
      description: form.description.trim() || null,
      servings:
        Number.isFinite(parsedServings) && parsedServings > 0
          ? parsedServings
          : null,
      ingredientCount,
      instructionCount,
      cuisine: form.cuisine.trim() || null,
      difficulty: form.difficulty.trim() || null,
      tagsCount,
    });
  }, [
    flattenedIngredients,
    form.cuisine,
    form.description,
    form.difficulty,
    form.servings,
    form.tagsText,
    form.title,
    instructionList,
    onDraftContextChange,
    open,
  ]);

  const hasAtLeastOneIngredient = flattenedIngredients.some(
    (ingredient) => ingredient.name.trim().length > 0
  );

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: "Recipe title is required.", variant: "error" });
      return;
    }

    if (instructionList.length === 0) {
      toast({ title: "Add at least one instruction step.", variant: "error" });
      return;
    }

    if (!hasAtLeastOneIngredient) {
      toast({ title: "Add at least one ingredient.", variant: "error" });
      return;
    }

    const parsedServings = Number.parseInt(form.servings, 10);
    const input: CreateRecipeInput = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      servings: Number.isFinite(parsedServings) && parsedServings > 0 ? parsedServings : 2,
      instructions: instructionList,
      sourceUrl: form.sourceUrl.trim() || null,
      sourceLabel: form.sourceLabel.trim() || null,
      ingredients: flattenedIngredients
        .map((ingredient, index) => ({
          name: ingredient.name.trim(),
          quantity:
            ingredient.amount.trim().length > 0
              ? parseFraction(ingredient.amount.trim())
              : null,
          unit: ingredient.unit,
          group: ingredient.group,
          notes: ingredient.notes.trim() || null,
          order: index,
        }))
        .filter((ingredient) => ingredient.name.length > 0),
      tags: form.tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      origin: initialRecipe?.origin === "imported" || initialRecipe?.origin === "ai_generated"
        ? initialRecipe.origin
        : "manual",
      prepTime: form.prepTime.trim() ? Number.parseInt(form.prepTime.trim(), 10) : null,
      cookTime: form.cookTime.trim() ? Number.parseInt(form.cookTime.trim(), 10) : null,
      difficulty: form.difficulty.trim() || null,
      cuisine: form.cuisine.trim() || null,
      rating: form.rating.trim() ? Number.parseInt(form.rating.trim(), 10) : null,
      cookNotes: form.cookNotes.trim() || null,
    };

    try {
      await onSave(input);
    } catch (error) {
      if (isRecipeConflictError(error) && error.data) {
        if (onConflict) {
          onConflict(error.data);
          return;
        }

        toast({
          title: "Duplicate recipe found.",
          description:
            error.code === "RECIPE_DUPLICATE_SOURCE_URL"
              ? "A recipe from this source URL already exists in your Recipe Book."
              : `A recipe named "${error.data.existing.title}" already exists in your Recipe Book.`,
          variant: "error",
        });
        return;
      }

      toast({
        title: "Could not save recipe.",
        description: "Please try again in a moment.",
        variant: "error",
      });
    }
  }

  if (!open || !portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-2.5 backdrop-blur-[3px] sm:p-4"
      ref={overlayRef}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-cream-dark bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={initialRecipe ? "Edit recipe" : "Add recipe"}
      >
        <div className="flex items-start justify-between gap-3 border-b border-cream-dark px-3.5 py-3 sm:px-5 sm:py-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-orange sm:text-xs">
              Recipe Editor
            </p>
            <h2 className="font-serif text-xl font-semibold text-text sm:text-2xl">
              {initialRecipe ? "Edit Recipe" : "Add Recipe"}
            </h2>
          </div>
          <Button className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" onClick={onClose} size="sm" type="button" variant="ghost">
            Close
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 py-3 sm:px-5 sm:py-4">
          <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Recipe Name
              </label>
              <Input
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Weeknight Lemon Pasta"
                value={form.title}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Servings
              </label>
              <Input
                min={1}
                onChange={(event) => setField("servings", event.target.value)}
                type="number"
                value={form.servings}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Tags
              </label>
              <Input
                onChange={(event) => setField("tagsText", event.target.value)}
                placeholder="quick, dinner, vegetarian"
                value={form.tagsText}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Prep Time (min)
              </label>
              <Input
                min={0}
                onChange={(event) => setField("prepTime", event.target.value)}
                placeholder="15"
                type="number"
                value={form.prepTime}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Cook Time (min)
              </label>
              <Input
                min={0}
                onChange={(event) => setField("cookTime", event.target.value)}
                placeholder="30"
                type="number"
                value={form.cookTime}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Difficulty
              </label>
              <select
                className="h-10 w-full rounded-btn border border-cream-dark bg-cream px-2.5 py-2 font-sans text-sm text-text outline-none transition focus:border-green-light focus:ring-2 focus:ring-green/10"
                onChange={(event) => setField("difficulty", event.target.value)}
                value={form.difficulty}
              >
                <option value="">Any level</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Cuisine
              </label>
              <select
                className="h-10 w-full rounded-btn border border-cream-dark bg-cream px-2.5 py-2 font-sans text-sm text-text outline-none transition focus:border-green-light focus:ring-2 focus:ring-green/10"
                onChange={(event) => setField("cuisine", event.target.value)}
                value={form.cuisine}
              >
                <option value="">No cuisine</option>
                {CUISINE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Rating
              </label>
              <select
                className="h-10 w-full rounded-btn border border-cream-dark bg-cream px-2.5 py-2 font-sans text-sm text-text outline-none transition focus:border-green-light focus:ring-2 focus:ring-green/10"
                onChange={(event) => setField("rating", event.target.value)}
                value={form.rating}
              >
                <option value="">No rating</option>
                <option value="1">&#9733; 1</option>
                <option value="2">&#9733;&#9733; 2</option>
                <option value="3">&#9733;&#9733;&#9733; 3</option>
                <option value="4">&#9733;&#9733;&#9733;&#9733; 4</option>
                <option value="5">&#9733;&#9733;&#9733;&#9733;&#9733; 5</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Description
              </label>
              <Input
                onChange={(event) => setField("description", event.target.value)}
                placeholder="A bright and fast weeknight pasta with spinach and parmesan."
                value={form.description}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Source URL
              </label>
              <Input
                onChange={(event) => setField("sourceUrl", event.target.value)}
                placeholder="https://example.com/recipe"
                value={form.sourceUrl}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Source Label
              </label>
              <Input
                onChange={(event) => setField("sourceLabel", event.target.value)}
                placeholder="example.com"
                value={form.sourceLabel}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Instructions
              </label>
              <div className="rounded-card border border-cream-dark bg-cream/70 p-3 sm:p-4">
                <div className="mb-2.5 flex items-center justify-between sm:mb-3">
                  <p className="text-xs font-medium text-text-muted">Steps</p>
                </div>

                {form.instructions.length === 0 ? (
                  <div className="rounded-btn border border-dashed border-cream-dark bg-white p-3 text-center">
                    <p className="text-xs text-text-muted">No steps yet. Click "Add Step" to begin.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 sm:space-y-2">
                    {form.instructions.map((instruction, index) => (
                      <div
                        className={`group relative flex gap-1.5 rounded-btn border transition ${
                          draggedIndex === index
                            ? "border-green-light bg-green/10"
                            : "border-cream-dark bg-white"
                        } p-2.5 sm:p-3`}
                        key={instruction.id}
                        onDragOver={(e) => {
                          if (draggedIndex !== null && draggedIndex !== index) {
                            e.preventDefault();
                            e.currentTarget.style.borderTop = "2px solid #3b5e45";
                          }
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.style.borderTop = "";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderTop = "";
                          if (draggedIndex !== null && draggedIndex !== index) {
                            const next = [...form.instructions];
                            const [moved] = next.splice(draggedIndex, 1);
                            next.splice(index, 0, moved);
                            setField("instructions", next);
                          }
                          setDraggedIndex(null);
                        }}
                      >
                        <div
                          className="flex cursor-grab flex-col gap-1 active:cursor-grabbing sm:gap-1.5"
                          draggable
                          onDragStart={() => setDraggedIndex(index)}
                          onDragEnd={() => setDraggedIndex(null)}
                          title="Drag to reorder step"
                        >
                          <div className="flex h-7 w-7 items-center justify-center text-xs text-text-muted">⋮⋮</div>
                          <Button
                            className="h-7 w-7 p-0 text-xs opacity-0 transition group-hover:opacity-100"
                            disabled={index === 0}
                            onClick={() => {
                              const next = [...form.instructions];
                              [next[index - 1], next[index]] = [next[index], next[index - 1]];
                              setField("instructions", next);
                            }}
                            size="sm"
                            title="Move step up"
                            type="button"
                            variant="ghost"
                          >
                            ▲
                          </Button>
                          <Button
                            className="h-7 w-7 p-0 text-xs opacity-0 transition group-hover:opacity-100"
                            disabled={index === form.instructions.length - 1}
                            onClick={() => {
                              const next = [...form.instructions];
                              [next[index], next[index + 1]] = [next[index + 1], next[index]];
                              setField("instructions", next);
                            }}
                            size="sm"
                            title="Move step down"
                            type="button"
                            variant="ghost"
                          >
                            ▼
                          </Button>
                        </div>
                        <div className="flex-1">
                          <p className="mb-1.5 text-xs font-medium text-text-muted">Step {index + 1}</p>
                          <Textarea
                            className="resize-none min-h-16"
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setField(
                                "instructions",
                                form.instructions.map((item) =>
                                  item.id === instruction.id ? { ...item, text: nextValue } : item
                                )
                              );
                            }}
                            placeholder="Describe this step"
                            value={instruction.text}
                          />
                        </div>
                        <Button
                          className="h-8 self-start px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                          disabled={form.instructions.length === 1}
                          onClick={() => {
                            setField(
                              "instructions",
                              form.instructions.filter((item) => item.id !== instruction.id)
                            );
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2.5 sm:mt-3">
                  <Button
                    className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                    onClick={() =>
                      setField("instructions", [
                        ...form.instructions,
                        createEmptyInstructionDraft(),
                      ])
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    + Add Step
                  </Button>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Cook Notes
              </label>
              <Textarea
                onChange={(event) => setField("cookNotes", event.target.value)}
                placeholder="Personal notes from cooking this recipe — substitutions, tips, variations."
                rows={3}
                value={form.cookNotes}
              />
            </div>
          </div>

          <div className="mt-4 rounded-card border border-cream-dark bg-cream/70 p-3 sm:mt-5 sm:p-4">
            <div className="mb-2.5">
              <h3 className="font-serif text-lg font-semibold text-text sm:text-xl">Ingredients</h3>
            </div>

            <div className="space-y-3">
              {form.ingredientGroups.map((group, groupIndex) => {
                const totalIngredients = form.ingredientGroups.reduce(
                  (count, entry) => count + entry.ingredients.length,
                  0
                );
                const showGroupHeader =
                  form.ingredientGroups.length > 1 || group.name.trim().length > 0;

                return (
                  <div className="rounded-btn border border-cream-dark bg-white p-2.5 sm:p-3" key={group.id}>
                    {showGroupHeader ? (
                      <div className="mb-2 flex items-center gap-2">
                        <Input
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setField(
                              "ingredientGroups",
                              form.ingredientGroups.map((entry) =>
                                entry.id === group.id ? { ...entry, name: nextValue } : entry
                              )
                            );
                          }}
                          placeholder="Group name (optional)"
                          value={group.name}
                        />
                        <Button
                          className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                          disabled={form.ingredientGroups.length === 1}
                          onClick={() => {
                            if (form.ingredientGroups.length === 1) {
                              return;
                            }

                            const targetIndex = groupIndex === 0 ? 1 : 0;
                            const nextGroups = form.ingredientGroups
                              .map((entry, index) => {
                                if (index === targetIndex) {
                                  return {
                                    ...entry,
                                    ingredients: [...group.ingredients, ...entry.ingredients],
                                  };
                                }
                                return entry;
                              })
                              .filter((entry) => entry.id !== group.id);

                            setField("ingredientGroups", nextGroups);
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Remove Group
                        </Button>
                      </div>
                    ) : null}

                    <div className="space-y-1.5 sm:space-y-2">
                      {group.ingredients.map((ingredient) => (
                        <div
                          className="grid gap-2 rounded-btn border border-cream-dark bg-cream p-2.5 md:grid-cols-[1fr_110px_160px_auto] sm:p-3"
                          key={ingredient.id}
                        >
                          <Input
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setField(
                                "ingredientGroups",
                                form.ingredientGroups.map((entry) =>
                                  entry.id !== group.id
                                    ? entry
                                    : {
                                        ...entry,
                                        ingredients: entry.ingredients.map((item) =>
                                          item.id === ingredient.id
                                            ? { ...item, name: nextValue }
                                            : item
                                        ),
                                      }
                                )
                              );
                            }}
                            placeholder="Ingredient name"
                            value={ingredient.name}
                          />
                          <Input
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setField(
                                "ingredientGroups",
                                form.ingredientGroups.map((entry) =>
                                  entry.id !== group.id
                                    ? entry
                                    : {
                                        ...entry,
                                        ingredients: entry.ingredients.map((item) =>
                                          item.id === ingredient.id
                                            ? { ...item, amount: nextValue }
                                            : item
                                        ),
                                      }
                                )
                              );
                            }}
                            placeholder="Amount (e.g. 1/8)"
                            type="text"
                            value={ingredient.amount}
                          />
                          <select
                            className="h-10 rounded-btn border border-cream-dark bg-white px-2.5 py-2 font-sans text-sm text-text outline-none transition focus:border-green-light focus:ring-2 focus:ring-green/10"
                            onChange={(event) => {
                              const nextValue = event.target.value as RecipeIngredientUnit;
                              setField(
                                "ingredientGroups",
                                form.ingredientGroups.map((entry) =>
                                  entry.id !== group.id
                                    ? entry
                                    : {
                                        ...entry,
                                        ingredients: entry.ingredients.map((item) =>
                                          item.id === ingredient.id
                                            ? { ...item, unit: nextValue }
                                            : item
                                        ),
                                      }
                                )
                              );
                            }}
                            value={ingredient.unit}
                          >
                            {RECIPE_INGREDIENT_UNITS.map((unit) => (
                              <option key={unit.value} value={unit.value}>
                                {unit.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            className="h-8 self-center px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                            disabled={totalIngredients === 1}
                            onClick={() => {
                              if (totalIngredients === 1) {
                                return;
                              }

                              const nextGroups = form.ingredientGroups
                                .map((entry) =>
                                  entry.id !== group.id
                                    ? entry
                                    : {
                                        ...entry,
                                        ingredients: entry.ingredients.filter(
                                          (item) => item.id !== ingredient.id
                                        ),
                                      }
                                )
                                .filter((entry) => entry.ingredients.length > 0);

                              setField(
                                "ingredientGroups",
                                nextGroups.length > 0
                                  ? nextGroups
                                  : [createEmptyIngredientGroup()]
                              );
                            }}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Remove
                          </Button>

                          <div className="md:col-span-4">
                            <Input
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setField(
                                  "ingredientGroups",
                                  form.ingredientGroups.map((entry) =>
                                    entry.id !== group.id
                                      ? entry
                                      : {
                                          ...entry,
                                          ingredients: entry.ingredients.map((item) =>
                                            item.id === ingredient.id
                                              ? { ...item, notes: nextValue }
                                              : item
                                          ),
                                        }
                                  )
                                );
                              }}
                              placeholder="Notes (optional)"
                              value={ingredient.notes}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2">
                      <Button
                        className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                        onClick={() => {
                          setField(
                            "ingredientGroups",
                            form.ingredientGroups.map((entry) =>
                              entry.id === group.id
                                ? {
                                    ...entry,
                                    ingredients: [...entry.ingredients, createEmptyIngredient()],
                                  }
                                : entry
                            )
                          );
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        + Add Ingredient
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3">
              <Button
                className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                onClick={() => {
                  setField("ingredientGroups", [
                    ...form.ingredientGroups,
                    createEmptyIngredientGroup(),
                  ]);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                + Add Group
              </Button>
            </div>
          </div>

        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-cream-dark px-3.5 py-3 sm:px-5 sm:py-4">
          <Button className="h-9 px-3 text-sm" onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className="h-9 px-3 text-sm"
            disabled={Boolean(isSaving)}
            onClick={() => void handleSave()}
            type="button"
            variant="default"
          >
            {isSaving ? "Saving..." : initialRecipe ? "Save Changes" : "Save Recipe"}
          </Button>
        </div>
      </div>
    </div>,
    portalRoot
  );
}