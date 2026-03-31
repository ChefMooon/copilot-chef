"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { type CreateRecipeInput } from "@shared/types";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type RecipePayload } from "@/lib/api";
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
  unit: "g" | "ml" | "cups" | "tbsp" | "tsp" | "oz" | "lb" | "count";
};

type FormState = {
  title: string;
  description: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  difficulty: string;
  rating: string;
  cookNotes: string;
  instructions: InstructionDraft[];
  tagsText: string;
  ingredients: IngredientDraft[];
};

type AddRecipeModalProps = {
  open: boolean;
  initialRecipe?: RecipePayload | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (input: CreateRecipeInput) => Promise<void>;
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

function toIngredientDrafts(recipe?: RecipePayload | null): IngredientDraft[] {
  if (!recipe || recipe.ingredients.length === 0) {
    return [createEmptyIngredient()];
  }

  return recipe.ingredients.map((ingredient) => {
    const normalized = ingredient.unit?.toLowerCase();
    const validUnits: IngredientDraft["unit"][] = ["g", "ml", "cups", "tbsp", "tsp", "oz", "lb", "count"];
    const unit = validUnits.includes(normalized as IngredientDraft["unit"])
      ? (normalized as IngredientDraft["unit"])
      : "g";

    return {
      id: ingredient.id,
      name: ingredient.name,
      amount:
        typeof ingredient.quantity === "number" && Number.isFinite(ingredient.quantity)
          ? String(ingredient.quantity)
          : "",
      notes: ingredient.notes ?? "",
      unit,
    };
  });
}

export function AddRecipeModal({
  open,
  initialRecipe,
  isSaving,
  onClose,
  onSave,
}: AddRecipeModalProps) {
  const { toast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    servings: "2",
    prepTime: "",
    cookTime: "",
    difficulty: "",
    rating: "",
    cookNotes: "",
    instructions: [],
    tagsText: "",
    ingredients: [createEmptyIngredient()],
  });

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm({
      title: initialRecipe?.title ?? "",
      description: initialRecipe?.description ?? "",
      servings: String(initialRecipe?.servings ?? 2),
      prepTime: initialRecipe?.prepTime != null ? String(initialRecipe.prepTime) : "",
      cookTime: initialRecipe?.cookTime != null ? String(initialRecipe.cookTime) : "",
      difficulty: initialRecipe?.difficulty ?? "",
      rating: initialRecipe?.rating != null ? String(initialRecipe.rating) : "",
      cookNotes: initialRecipe?.cookNotes ?? "",
      instructions:
        initialRecipe?.instructions && initialRecipe.instructions.length > 0
          ? payloadToInstructionDrafts(initialRecipe.instructions)
          : [],
      tagsText: initialRecipe?.tags.join(", ") ?? "",
      ingredients: toIngredientDrafts(initialRecipe),
    });
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

  const hasAtLeastOneIngredient = form.ingredients.some(
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
      ingredients: form.ingredients
        .map((ingredient, index) => ({
          name: ingredient.name.trim(),
          quantity:
            ingredient.amount.trim().length > 0
              ? Number.parseFloat(ingredient.amount.trim())
              : null,
          unit: ingredient.unit,
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
      rating: form.rating.trim() ? Number.parseInt(form.rating.trim(), 10) : null,
      cookNotes: form.cookNotes.trim() || null,
    };

    try {
      await onSave(input);
    } catch {
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

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:normal-case sm:tracking-normal">
                Instructions
              </label>
              <div className="rounded-card border border-cream-dark bg-cream/70 p-3 sm:p-4">
                <div className="mb-2.5 flex items-center justify-between sm:mb-3">
                  <p className="text-xs font-medium text-text-muted">Steps</p>
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
            <div className="mb-2.5 flex items-center justify-between sm:mb-3">
              <h3 className="font-serif text-lg font-semibold text-text sm:text-xl">Ingredients</h3>
              <Button
                className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                onClick={() =>
                  setField("ingredients", [...form.ingredients, createEmptyIngredient()])
                }
                size="sm"
                type="button"
                variant="outline"
              >
                + Add Ingredient
              </Button>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              {form.ingredients.map((ingredient, index) => (
                <div
                  className="grid gap-2 rounded-btn border border-cream-dark bg-white p-2.5 md:grid-cols-[1fr_110px_160px_auto] sm:p-3"
                  key={ingredient.id}
                >
                  <Input
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setField(
                        "ingredients",
                        form.ingredients.map((item) =>
                          item.id === ingredient.id ? { ...item, name: nextValue } : item
                        )
                      );
                    }}
                    placeholder="Ingredient name"
                    value={ingredient.name}
                  />
                  <Input
                    min={0}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setField(
                        "ingredients",
                        form.ingredients.map((item) =>
                          item.id === ingredient.id ? { ...item, amount: nextValue } : item
                        )
                      );
                    }}
                    placeholder="Amount"
                    step="any"
                    type="number"
                    value={ingredient.amount}
                  />
                  <select
                    className="h-10 rounded-btn border border-cream-dark bg-cream px-2.5 py-2 font-sans text-sm text-text outline-none transition focus:border-green-light focus:ring-2 focus:ring-green/10"
                    onChange={(event) => {
                      const nextValue = event.target.value as IngredientDraft["unit"];
                      setField(
                        "ingredients",
                        form.ingredients.map((item) =>
                          item.id === ingredient.id ? { ...item, unit: nextValue } : item
                        )
                      );
                    }}
                    value={ingredient.unit}
                  >
                    <option value="g">Grams (g)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="cups">Cups</option>
                    <option value="tbsp">Tablespoons (tbsp)</option>
                    <option value="tsp">Teaspoons (tsp)</option>
                    <option value="oz">Ounces (oz)</option>
                    <option value="lb">Pounds (lb)</option>
                    <option value="count">Count (items)</option>
                  </select>
                  <Button
                    className="h-8 self-center px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                    disabled={form.ingredients.length === 1 && index === 0}
                    onClick={() => {
                      setField(
                        "ingredients",
                        form.ingredients.length > 1
                          ? form.ingredients.filter((item) => item.id !== ingredient.id)
                          : form.ingredients
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
                          "ingredients",
                          form.ingredients.map((item) =>
                            item.id === ingredient.id ? { ...item, notes: nextValue } : item
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