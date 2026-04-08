import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { listRecipes, type RecipePayload } from "@/lib/api";

import styles from "./meal-plan.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type RecipeSearchModalProps = {
  open: boolean;
  currentMealName: string;
  onClose: () => void;
  onSelectRecipe: (
    recipe: RecipePayload,
    servings: number,
    personalNote: string
  ) => Promise<void>;
};

export function RecipeSearchModal({
  open,
  currentMealName,
  onClose,
  onSelectRecipe,
}: RecipeSearchModalProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState("all");
  const [results, setResults] = useState<RecipePayload[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipePayload | null>(null);
  const [previewServings, setPreviewServings] = useState(1);
  const [previewNote, setPreviewNote] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setOriginFilter("all");
    setSelectedRecipe(null);
    setPreviewServings(1);
    setPreviewNote("");
    setLoadError(null);
  }, [open]);

  useEffect(() => {
    if (!open || !portalRoot) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, portalRoot]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await listRecipes(query.trim() || undefined);
        setResults(data);
      } catch {
        setLoadError("Unable to load recipes right now. Please try again.");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [open, query]);

  useEffect(() => {
    if (!open || !portalRoot) {
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

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedRecipe) {
          setSelectedRecipe(null);
          return;
        }

        onClose();
        return;
      }

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

    window.addEventListener("keydown", keyHandler);

    return () => {
      window.removeEventListener("keydown", keyHandler);
      previousFocus?.focus();
    };
  }, [open, onClose, portalRoot, selectedRecipe]);

  const normalizedMealName = currentMealName.trim().toLowerCase();

  const originOptions = useMemo(() => {
    const origins = new Set<string>();
    for (const recipe of results) {
      if (recipe.origin) {
        origins.add(recipe.origin);
      }
    }

    return ["all", ...Array.from(origins).sort()];
  }, [results]);

  const filteredResults = useMemo(() => {
    if (originFilter === "all") {
      return results;
    }

    return results.filter((recipe) => recipe.origin === originFilter);
  }, [originFilter, results]);

  if (!open || !portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className={styles.recipeSearchModalOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.recipeSearchModalPanel}
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Find and link recipe"
        tabIndex={-1}
      >
        <div className={styles.recipeSearchModalHeader}>
          <h3 className={styles.recipeSearchModalTitle}>Link A Recipe</h3>
          <button className={styles.modalClose} onClick={onClose} type="button">
            x
          </button>
        </div>

        <div className={styles.recipeSearchModalBody}>
          {selectedRecipe ? (
            <>
              <div className={styles.recipePreviewPanel}>
                <h4 className={styles.recipePreviewTitle}>{selectedRecipe.title}</h4>

                {selectedRecipe.description ? (
                  <div className={styles.recipePreviewSection}>
                    <label className={styles.formLabel}>Description</label>
                    <div className={styles.readOnlyValue}>{selectedRecipe.description}</div>
                  </div>
                ) : null}

                <div className={styles.recipePreviewSection}>
                  <label className={styles.formLabel}>Ingredients</label>
                  <div className={styles.recipePreviewChips}>
                    {selectedRecipe.ingredients.length > 0 ? (
                      selectedRecipe.ingredients.map((ingredient) => (
                        <span className={styles.recipePreviewChip} key={ingredient.id}>
                          {ingredient.name}
                        </span>
                      ))
                    ) : (
                      <span className={styles.readOnlyEmpty}>No ingredients listed</span>
                    )}
                  </div>
                </div>

                <div className={styles.recipePreviewSection}>
                  <label className={styles.formLabel}>Instructions</label>
                  {selectedRecipe.instructions.length > 0 ? (
                    <ol className={styles.instructionsList}>
                      {selectedRecipe.instructions.map((step, index) => (
                        <li className={styles.instructionReadOnly} key={`preview-step-${index}`}>
                          {step}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <span className={styles.readOnlyEmpty}>No instructions listed</span>
                  )}
                </div>

                {selectedRecipe.cookNotes ? (
                  <div className={styles.recipePreviewSection}>
                    <label className={styles.formLabel}>Recipe Notes</label>
                    <div className={styles.readOnlyValue}>{selectedRecipe.cookNotes}</div>
                  </div>
                ) : null}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="preview-servings-input">
                    Servings
                  </label>
                  <input
                    className={`${styles.formInput} ${styles.servingsInput}`}
                    id="preview-servings-input"
                    min={1}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next)) {
                        setPreviewServings(Math.max(1, Math.floor(next)));
                      }
                    }}
                    type="number"
                    value={previewServings}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="preview-note-input">
                  Personal Note
                </label>
                <textarea
                  className={`${styles.formInput} ${styles.formTextarea} ${styles.previewNoteInput}`}
                  id="preview-note-input"
                  onChange={(event) => setPreviewNote(event.target.value)}
                  placeholder="Optional note for this planned meal"
                  value={previewNote}
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.recipeSearchFilterRow}>
                <input
                  autoFocus
                  autoComplete="off"
                  className={styles.formInput}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search your recipe book..."
                  value={query}
                />
                <select
                  className={styles.formInput}
                  onChange={(event) => setOriginFilter(event.target.value)}
                  value={originFilter}
                >
                  {originOptions.map((origin) => (
                    <option key={origin} value={origin}>
                      {origin === "all" ? "All Origins" : origin}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.recipeSearchStatusText}>
                {isLoading
                  ? "Loading recipes..."
                  : `${filteredResults.length} recipe${filteredResults.length === 1 ? "" : "s"}`}
              </div>

              {loadError ? (
                <p className={styles.confirmationError}>{loadError}</p>
              ) : null}

              <ul className={styles.recipeSearchList}>
                {filteredResults.map((recipe) => {
                  const duplicateName =
                    normalizedMealName.length > 0 &&
                    recipe.title.trim().toLowerCase() === normalizedMealName;

                  return (
                    <li className={styles.recipeSearchListItem} key={recipe.id}>
                      <button
                        className={`${styles.recipeSearchListBtn} ${
                          duplicateName ? styles.recipeSearchListBtnDisabled : ""
                        }`}
                        disabled={duplicateName}
                        onClick={() => {
                          setSelectedRecipe(recipe);
                          setPreviewServings(Math.max(1, recipe.servings || 1));
                          setPreviewNote("");
                        }}
                        title={
                          duplicateName
                            ? "Recipe name matches current meal name"
                            : undefined
                        }
                        type="button"
                      >
                        <span className={styles.recipeSearchTitle}>{recipe.title}</span>
                        <span className={styles.recipeSearchListMeta}>
                          {recipe.origin} · {recipe.ingredients.length} ingredients
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {!isLoading && !loadError && filteredResults.length === 0 ? (
                <p className={styles.readOnlyEmpty}>No recipes found.</p>
              ) : null}
            </>
          )}
        </div>

        <div className={styles.recipeSearchModalFooter}>
          {selectedRecipe ? (
            <>
              <button
                className={styles.btnGhost}
                onClick={() => setSelectedRecipe(null)}
                type="button"
              >
                Back To Results
              </button>
              <div className={styles.recipePreviewActions}>
                <button className={styles.btnGhost} onClick={onClose} type="button">
                  Cancel
                </button>
                <button
                  className={styles.btnConfirmLink}
                  disabled={isConfirming}
                  onClick={async () => {
                    if (!selectedRecipe) {
                      return;
                    }

                    setIsConfirming(true);
                    try {
                      await onSelectRecipe(selectedRecipe, previewServings, previewNote.trim());
                    } finally {
                      setIsConfirming(false);
                    }
                  }}
                  type="button"
                >
                  {isConfirming ? "Linking..." : "Confirm Link"}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.recipePreviewActions}>
              <button className={styles.btnGhost} onClick={onClose} type="button">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    portalRoot
  );
}
