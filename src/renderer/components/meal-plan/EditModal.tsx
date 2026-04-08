import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  formatMealIngredient,
  MEAL_TYPES,
  toDateInputValue,
  type EditableMeal,
  type LinkedRecipeSummary,
  TYPE_CONFIG,
} from "@/lib/calendar";
import { type RecipePayload } from "@/lib/api";
import { RECIPE_INGREDIENT_UNITS } from "@/lib/ingredient-units";
import type { MealIngredient } from "@shared/types";

import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { RecipeSearchModal } from "./RecipeSearchModal";

import styles from "./meal-plan.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type EditModalProps = {
  meal: EditableMeal;
  onClose: () => void;
  onSave: (meal: EditableMeal) => Promise<void>;
  onDelete: (mealId: string) => Promise<void>;
  onResuggest: (meal: EditableMeal) => Promise<Partial<EditableMeal> | void>;
  onSaveAsRecipe?: (meal: EditableMeal) => void;
  onUnlinkRecipe?: (meal: EditableMeal) => Promise<void>;
};

export function EditModal({
  meal,
  onClose,
  onSave,
  onDelete,
  onResuggest,
  onSaveAsRecipe,
  onUnlinkRecipe,
}: EditModalProps) {
  const [form, setForm] = useState<EditableMeal>({ ...meal });
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showRecipeSearchModal, setShowRecipeSearchModal] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const isLinked = form.recipeId !== null && form.linkedRecipe !== null;
  const linkedRecipe = form.linkedRecipe;

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!portalRoot) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [portalRoot]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showRecipeSearchModal) {
          setShowRecipeSearchModal(false);
          return;
        }

        if (showDeleteConfirmation) {
          setShowDeleteConfirmation(false);
          return;
        }

        onClose();
      }
    };

    window.addEventListener("keydown", keyHandler);

    return () => {
      window.removeEventListener("keydown", keyHandler);
    };
  }, [onClose, showDeleteConfirmation, showRecipeSearchModal]);

  useEffect(() => {
    if (!portalRoot || showDeleteConfirmation || showRecipeSearchModal) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const initialTarget =
      panel.querySelector<HTMLElement>("[autofocus]") ?? getFocusable()[0] ?? panel;
    initialTarget.focus();

    const tabHandler = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === panel) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", tabHandler);

    return () => {
      window.removeEventListener("keydown", tabHandler);
      previousFocus?.focus();
    };
  }, [portalRoot, showDeleteConfirmation, showRecipeSearchModal]);

  const setField = <K extends keyof EditableMeal>(
    key: K,
    value: EditableMeal[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const normalizeIngredientOrder = (ingredients: MealIngredient[]) =>
    ingredients.map((ingredient, index) => ({ ...ingredient, order: index }));

  const createEmptyIngredient = (order: number): MealIngredient => ({
    name: "",
    quantity: null,
    unit: null,
    group: null,
    notes: null,
    order,
  });

  // ── Ingredient row management ───────────────────────────────────────────
  const addIngredient = () => {
    setField("ingredients", [
      ...normalizeIngredientOrder(form.ingredients),
      createEmptyIngredient(form.ingredients.length),
    ]);
  };

  const removeIngredient = (index: number) => {
    setField(
      "ingredients",
      normalizeIngredientOrder(
        form.ingredients.filter((_, currentIndex) => currentIndex !== index)
      )
    );
  };

  const updateIngredient = (
    index: number,
    key: keyof Omit<MealIngredient, "order">,
    value: string | null
  ) => {
    const next = [...form.ingredients];
    next[index] = {
      ...next[index],
      [key]: value,
    };
    setField("ingredients", normalizeIngredientOrder(next));
  };

  // ── Instructions management ─────────────────────────────────────────────
  const addInstruction = () => {
    setField("instructions", [...form.instructions, ""]);
  };

  const updateInstruction = (index: number, value: string) => {
    const next = [...form.instructions];
    next[index] = value;
    setField("instructions", next);
  };

  const removeInstruction = (index: number) => {
    setField(
      "instructions",
      form.instructions.filter((_, i) => i !== index)
    );
  };

  const moveInstruction = (index: number, direction: "up" | "down") => {
    const next = [...form.instructions];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setField("instructions", next);
  };

  const buildLinkedMeal = (
    currentMeal: EditableMeal,
    recipe: RecipePayload,
    options?: { servings?: number; personalNote?: string }
  ): EditableMeal => {
    const summary: LinkedRecipeSummary = {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      instructions: recipe.instructions,
      cookNotes: recipe.cookNotes,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      ingredients: recipe.ingredients.map((ingredient, index) => ({
        name: ingredient.name,
        quantity:
          ingredient.quantity === null || ingredient.quantity === undefined
            ? null
            : `${ingredient.quantity}`,
        unit: ingredient.unit,
        group: ingredient.group ?? null,
        notes: ingredient.notes,
        order: ingredient.order ?? index,
      })),
    };

    const metadataLines: string[] = [];
    if (options?.personalNote) {
      metadataLines.push(options.personalNote.trim());
    }

    return {
      ...currentMeal,
      name: recipe.title,
      servingsOverride:
        options?.servings && options.servings !== recipe.servings
          ? options.servings
          : null,
      recipeId: recipe.id,
      linkedRecipe: summary,
      notes:
        metadataLines.length > 0
          ? [currentMeal.notes.trim(), ...metadataLines]
              .filter((line) => line.length > 0)
              .join("\n")
          : currentMeal.notes,
    };
  };

  const typeConfig = TYPE_CONFIG[form.type];

  const handleDeleteConfirm = async () => {
    if (!form.id) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(undefined);

    try {
      await onDelete(form.id);
      setShowDeleteConfirmation(false);
      onClose();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Unable to delete meal. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!portalRoot) {
    return null;
  }

  return (
    <>
      {createPortal(
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
          ref={overlayRef}
        >
          <div
            className={styles.modalPanel}
            onClick={(event) => event.stopPropagation()}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Edit meal"
            tabIndex={-1}
          >
            <div
              className={styles.modalHeader}
              style={{ borderColor: typeConfig.dot }}
            >
              <div className={styles.modalHeaderLeft}>
                <span
                  className={styles.modalTypeBadge}
                  style={{ background: typeConfig.bg, color: typeConfig.text }}
                >
                  {typeConfig.label}
                </span>
                <span className={styles.modalDateLabel}>
                  {form.date.toLocaleDateString("default", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <button
                className={styles.modalClose}
                onClick={onClose}
                type="button"
              >
                x
              </button>
            </div>

            <div className={styles.modalBody}>

              {/* ── Mode B: Recipe-linked header ─────────────────────── */}
              {isLinked && linkedRecipe ? (
                <div className={styles.linkedRecipeBanner}>
                  <span className={styles.linkedRecipeIcon}>📖</span>
                  <div className={styles.linkedRecipeBannerContent}>
                    <span className={styles.linkedRecipeLabel}>
                      Linked to <strong>{linkedRecipe.title}</strong>
                    </span>
                    <span className={styles.linkedRecipeMeta}>
                      Recipe serves {linkedRecipe.servings}
                      {form.servingsOverride &&
                      form.servingsOverride !== linkedRecipe.servings
                        ? ` · This meal plans ${form.servingsOverride}`
                        : " · Using recipe servings"}
                    </span>
                  </div>
                  <button
                    className={styles.btnUnlink}
                    disabled={isUnlinking}
                    onClick={async () => {
                      if (!onUnlinkRecipe) return;
                      setIsUnlinking(true);
                      try {
                        await onUnlinkRecipe(form);
                      } finally {
                        setIsUnlinking(false);
                      }
                    }}
                    type="button"
                  >
                    {isUnlinking ? "Unlinking..." : "Unlink"}
                  </button>
                </div>
              ) : null}

              {/* ── Shared: Meal Type + Date ─────────────────────────── */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="meal-type-select">
                    Meal Type
                  </label>
                  <select
                    className={styles.formInput}
                    id="meal-type-select"
                    onChange={(event) =>
                      setField(
                        "type",
                        MEAL_TYPES.find((type) => type === event.target.value) ??
                          "breakfast"
                      )
                    }
                    value={form.type}
                  >
                    {MEAL_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="meal-day-input">
                    Day
                  </label>
                  <input
                    className={styles.formInput}
                    id="meal-day-input"
                    onChange={(event) => {
                      const nextDate = new Date(`${event.target.value}T12:00:00`);
                      if (!Number.isNaN(nextDate.getTime())) {
                        setField("date", nextDate);
                      }
                    }}
                    type="date"
                    value={toDateInputValue(form.date)}
                  />
                </div>
              </div>

              {/* ── Mode B: Read-only recipe display ────────────────── */}
              {isLinked && linkedRecipe ? (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Meal Name</label>
                    <div className={styles.readOnlyValue}>{linkedRecipe.title}</div>
                  </div>

                  {linkedRecipe.description ? (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Description</label>
                      <div className={styles.readOnlyValue}>{linkedRecipe.description}</div>
                    </div>
                  ) : null}

                  <div className={styles.linkedRecipeStatsRow}>
                    <div className={styles.linkedRecipeStatCard}>
                      <span className={styles.linkedRecipeStatLabel}>Recipe Servings</span>
                      <span className={styles.linkedRecipeStatValue}>{linkedRecipe.servings}</span>
                    </div>
                    <div className={styles.linkedRecipeStatCard}>
                      <span className={styles.linkedRecipeStatLabel}>Prep</span>
                      <span className={styles.linkedRecipeStatValue}>
                        {linkedRecipe.prepTime ? `${linkedRecipe.prepTime} min` : "—"}
                      </span>
                    </div>
                    <div className={styles.linkedRecipeStatCard}>
                      <span className={styles.linkedRecipeStatLabel}>Cook</span>
                      <span className={styles.linkedRecipeStatValue}>
                        {linkedRecipe.cookTime ? `${linkedRecipe.cookTime} min` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="meal-servings-override-input">
                        Planned Servings
                      </label>
                      <input
                        className={styles.formInput}
                        id="meal-servings-override-input"
                        min={1}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          const parsed =
                            nextValue === ""
                              ? linkedRecipe.servings
                              : Math.max(1, Math.floor(Number(nextValue) || 1));
                          setField(
                            "servingsOverride",
                            parsed === linkedRecipe.servings ? null : parsed
                          );
                        }}
                        type="number"
                        value={form.servingsOverride ?? linkedRecipe.servings}
                      />
                      <span className={styles.formHint}>
                        Set a custom serving count for this meal. Matching the recipe default resets the override.
                      </span>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Effective Servings</label>
                      <div className={styles.readOnlyValue}>
                        {form.servingsOverride ?? linkedRecipe.servings}
                      </div>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Ingredients</label>
                    <div className={styles.ingredientsList}>
                      {linkedRecipe.ingredients.map((ing, i) => (
                        <span className={styles.ingredientChip} key={`linked-ing-${i}`}>
                          {formatMealIngredient(ing)}
                        </span>
                      ))}
                      {linkedRecipe.ingredients.length === 0 ? (
                        <span className={styles.readOnlyEmpty}>No ingredients listed</span>
                      ) : null}
                    </div>
                  </div>

                  {linkedRecipe.instructions.length > 0 ? (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Instructions</label>
                      <ol className={styles.instructionsList}>
                        {linkedRecipe.instructions.map((step, i) => (
                          <li className={styles.instructionReadOnly} key={`linked-step-${i}`}>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {linkedRecipe.cookNotes ? (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Recipe Notes</label>
                      <div className={styles.readOnlyValue}>{linkedRecipe.cookNotes}</div>
                    </div>
                  ) : null}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="meal-notes-input">
                      Personal Note
                    </label>
                    <textarea
                      className={`${styles.formInput} ${styles.formTextarea}`}
                      id="meal-notes-input"
                      onChange={(event) => setField("notes", event.target.value)}
                      placeholder="Your own notes for this meal..."
                      value={form.notes}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* ── Mode A: Full standalone editing ─────────────── */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="meal-name-input">
                      Meal Name
                    </label>
                    <input
                      autoFocus
                      className={styles.formInput}
                      id="meal-name-input"
                      onChange={(event) => setField("name", event.target.value)}
                      placeholder="e.g. Lemon Ricotta Pancakes"
                      value={form.name}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="meal-description-input">
                      Description
                    </label>
                    <textarea
                      className={`${styles.formInput} ${styles.formTextarea}`}
                      id="meal-description-input"
                      onChange={(event) => setField("description", event.target.value)}
                      placeholder="A short description of this meal..."
                      rows={2}
                      value={form.description}
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="meal-servings-input">
                        Servings
                      </label>
                      <input
                        className={styles.formInput}
                        id="meal-servings-input"
                        min={1}
                        onChange={(event) =>
                          setField("servings", Math.max(1, Number(event.target.value) || 1))
                        }
                        type="number"
                        value={form.servings}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="meal-prep-time-input">
                        Prep Time
                      </label>
                      <input
                        className={styles.formInput}
                        id="meal-prep-time-input"
                        min={0}
                        onChange={(event) =>
                          setField(
                            "prepTime",
                            event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0)
                          )
                        }
                        placeholder="min"
                        type="number"
                        value={form.prepTime ?? ""}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="meal-cook-time-input">
                        Cook Time
                      </label>
                      <input
                        className={styles.formInput}
                        id="meal-cook-time-input"
                        min={0}
                        onChange={(event) =>
                          setField(
                            "cookTime",
                            event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0)
                          )
                        }
                        placeholder="min"
                        type="number"
                        value={form.cookTime ?? ""}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="meal-notes-input">
                      Notes
                    </label>
                    <textarea
                      className={`${styles.formInput} ${styles.formTextarea}`}
                      id="meal-notes-input"
                      onChange={(event) => setField("notes", event.target.value)}
                      placeholder="Prep tips, variations, substitutions..."
                      value={form.notes}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Ingredients</label>
                    <div className={styles.ingredientEditorGrid}>
                      {form.ingredients.length > 0 ? (
                        <>
                          <div className={styles.ingredientEditorHeader}>Qty</div>
                          <div className={styles.ingredientEditorHeader}>Unit</div>
                          <div className={styles.ingredientEditorHeader}>Ingredient</div>
                          <div className={styles.ingredientEditorHeader}>Notes</div>
                          <div className={styles.ingredientEditorHeader} />
                        </>
                      ) : null}
                      {form.ingredients.map((ingredient, index) => (
                        <>
                          <input
                            className={`${styles.formInput} ${styles.ingredientEditorInput}`}
                            key={`ingredient-qty-${index}`}
                            onChange={(event) =>
                              updateIngredient(index, "quantity", event.target.value.trim() || null)
                            }
                            placeholder="1"
                            value={ingredient.quantity ?? ""}
                          />
                          <select
                            className={`${styles.formInput} ${styles.ingredientEditorInput}`}
                            key={`ingredient-unit-${index}`}
                            onChange={(event) =>
                              updateIngredient(index, "unit", event.target.value || null)
                            }
                            value={ingredient.unit ?? ""}
                          >
                            <option value="">No unit</option>
                            {RECIPE_INGREDIENT_UNITS.map((unit) => (
                              <option key={unit.value} value={unit.value}>
                                {unit.label}
                              </option>
                            ))}
                          </select>
                          <input
                            className={`${styles.formInput} ${styles.ingredientEditorInput}`}
                            key={`ingredient-name-${index}`}
                            onChange={(event) => updateIngredient(index, "name", event.target.value)}
                            placeholder="Ingredient name"
                            value={ingredient.name}
                          />
                          <input
                            className={`${styles.formInput} ${styles.ingredientEditorInput}`}
                            key={`ingredient-notes-${index}`}
                            onChange={(event) =>
                              updateIngredient(index, "notes", event.target.value.trim() || null)
                            }
                            placeholder="optional"
                            value={ingredient.notes ?? ""}
                          />
                          <button
                            className={styles.btnInstructionRemove}
                            key={`ingredient-remove-${index}`}
                            onClick={() => removeIngredient(index)}
                            title="Remove ingredient"
                            type="button"
                          >
                            ×
                          </button>
                        </>
                      ))}
                    </div>
                    {form.ingredients.length === 0 ? (
                      <span className={styles.readOnlyEmpty}>No ingredients yet.</span>
                    ) : null}
                    <button
                      className={styles.btnAddStep}
                      onClick={addIngredient}
                      type="button"
                    >
                      + Add Ingredient
                    </button>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Instructions</label>
                    {form.instructions.length > 0 ? (
                      <ol className={styles.instructionEditorList}>
                        {form.instructions.map((step, index) => (
                          <li className={styles.instructionEditorRow} key={`step-${index}`}>
                            <span className={styles.instructionStepNum}>{index + 1}</span>
                            <input
                              className={`${styles.formInput} ${styles.instructionInput}`}
                              onChange={(e) => updateInstruction(index, e.target.value)}
                              placeholder={`Step ${index + 1}...`}
                              value={step}
                            />
                            <div className={styles.instructionActions}>
                              <button
                                className={styles.btnInstructionOrder}
                                disabled={index === 0}
                                onClick={() => moveInstruction(index, "up")}
                                title="Move up"
                                type="button"
                              >↑</button>
                              <button
                                className={styles.btnInstructionOrder}
                                disabled={index === form.instructions.length - 1}
                                onClick={() => moveInstruction(index, "down")}
                                title="Move down"
                                type="button"
                              >↓</button>
                              <button
                                className={styles.btnInstructionRemove}
                                onClick={() => removeInstruction(index)}
                                title="Remove step"
                                type="button"
                              >×</button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    <button
                      className={styles.btnAddStep}
                      onClick={addInstruction}
                      type="button"
                    >
                      + Add Step
                    </button>
                  </div>

                </>
              )}
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.modalFooterTop}>
                <div className={styles.modalFooterSecondary}>
                  {form.id && onSaveAsRecipe && !isLinked ? (
                    <button
                      className={`${styles.btnSaveAsRecipe} ${styles.footerActionButton}`}
                      disabled={isSaving || !form.name.trim()}
                      onClick={() => onSaveAsRecipe({ ...form, name: form.name.trim() })}
                      type="button"
                    >
                      Save as Recipe
                    </button>
                  ) : null}
                  {form.id ? (
                    <button
                      className={`${styles.btnDelete} ${styles.footerActionButton}`}
                      disabled={isSaving || isDeleting || isSuggesting}
                      onClick={() => {
                        setDeleteError(undefined);
                        setShowDeleteConfirmation(true);
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  ) : null}
                  {!isLinked ? (
                    <button
                      className={`${styles.btnLinkRecipe} ${styles.footerActionButton}`}
                      disabled={isSaving || isDeleting || isSuggesting}
                      onClick={() => setShowRecipeSearchModal(true)}
                      type="button"
                    >
                      Link Recipe
                    </button>
                  ) : null}
                </div>
              </div>
              <div className={styles.modalFooterBottom}>
                <div className={styles.modalFooterAux}>
                  <button
                    className={`${styles.btnAiSuggest} ${styles.footerActionButton}`}
                    disabled={isSuggesting || isLinked}
                    onClick={async () => {
                      setIsSuggesting(true);
                      try {
                        const nextValues = await onResuggest(form);
                        if (nextValues) {
                          setForm((current) => ({ ...current, ...nextValues }));
                        }
                      } finally {
                        setIsSuggesting(false);
                      }
                    }}
                    type="button"
                  >
                    {isSuggesting ? "Thinking..." : "AI Re-suggest"}
                  </button>
                </div>
                <div className={styles.modalFooterPrimary}>
                  <button
                    className={`${styles.btnGhost} ${styles.footerActionButton}`}
                    onClick={onClose}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className={`${styles.btnSave} ${styles.footerActionButton}`}
                    disabled={isSaving || (!isLinked && !form.name.trim())}
                    onClick={async () => {
                      setIsSaving(true);
                      try {
                        await onSave({ ...form, name: isLinked ? (form.linkedRecipe?.title ?? form.name) : form.name.trim() });
                        onClose();
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    type="button"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        portalRoot
      )}

      <DeleteConfirmationModal
        error={deleteError}
        isLoading={isDeleting}
        isOpen={showDeleteConfirmation}
        mealName={form.name.trim()}
        onCancel={() => setShowDeleteConfirmation(false)}
        onConfirm={handleDeleteConfirm}
      />

      <RecipeSearchModal
        currentMealName={form.name}
        onClose={() => setShowRecipeSearchModal(false)}
        onSelectRecipe={async (recipe, servings, personalNote) => {
          const linkedMeal = buildLinkedMeal(form, recipe, {
            servings,
            personalNote,
          });

          setForm(linkedMeal);
          setIsSaving(true);
          try {
            await onSave(linkedMeal);
          } finally {
            setIsSaving(false);
          }
          setShowRecipeSearchModal(false);
          onClose();
        }}
        open={showRecipeSearchModal}
      />
    </>
  );
}
