import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  MEAL_TYPES,
  toDateInputValue,
  type EditableMeal,
  TYPE_CONFIG,
} from "@/lib/calendar";

import { DeleteConfirmationModal } from "./DeleteConfirmationModal";

import styles from "../meal-plan.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type EditModalProps = {
  meal: EditableMeal;
  onClose: () => void;
  onSave: (meal: EditableMeal) => Promise<void>;
  onDelete: (mealId: string) => Promise<void>;
  onResuggest: (meal: EditableMeal) => Promise<Partial<EditableMeal> | void>;
};

export function EditModal({
  meal,
  onClose,
  onSave,
  onDelete,
  onResuggest,
}: EditModalProps) {
  const [form, setForm] = useState<EditableMeal>({ ...meal });
  const [ingredientInput, setIngredientInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
  }, [onClose, showDeleteConfirmation]);

  useEffect(() => {
    if (!portalRoot || showDeleteConfirmation) {
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
  }, [portalRoot, showDeleteConfirmation]);

  const setField = <K extends keyof EditableMeal>(
    key: K,
    value: EditableMeal[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addIngredient = () => {
    if (!ingredientInput.trim()) {
      return;
    }

    setField("ingredients", [...form.ingredients, ingredientInput.trim()]);
    setIngredientInput("");
  };

  const removeIngredient = (index: number) => {
    setField(
      "ingredients",
      form.ingredients.filter((_, currentIndex) => currentIndex !== index)
    );
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
                <div className={styles.ingredientsList}>
                  {form.ingredients.map((ingredient, index) => (
                    <span
                      className={styles.ingredientChip}
                      key={`${ingredient}-${index}`}
                    >
                      {ingredient}
                      <button
                        className={styles.ingredientRemove}
                        onClick={() => removeIngredient(index)}
                        type="button"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <div className={styles.ingredientAddRow}>
                  <input
                    className={`${styles.formInput} ${styles.ingredientInput}`}
                    onChange={(event) => setIngredientInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addIngredient();
                      }
                    }}
                    placeholder="Add ingredient..."
                    value={ingredientInput}
                  />
                  <button
                    className={styles.btnAddIngredient}
                    onClick={addIngredient}
                    type="button"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.btnAiSuggest}
                disabled={isSuggesting}
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
              <div className={styles.modalFooterRight}>
                {form.id ? (
                  <button
                    className={styles.btnDelete}
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
                <button
                  className={styles.btnGhost}
                  onClick={onClose}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={styles.btnSave}
                  disabled={isSaving || !form.name.trim()}
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      await onSave({ ...form, name: form.name.trim() });
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
    </>
  );
}
