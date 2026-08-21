import { useEffect, useMemo, useRef, useState } from "react";

import { listRecipes } from "@/lib/api";
import { getCuisineLabel } from "@shared/api/constants";
import { type RecipePayload } from "@shared/types";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/button";

import styles from "./meal-plan.module.css";

type RecipeSearchModalProps = {
  open: boolean;
  currentMealName: string;
  errorMessage?: string | null;
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
  errorMessage,
  onClose,
  onSelectRecipe,
}: RecipeSearchModalProps) {
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState("all");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [results, setResults] = useState<RecipePayload[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipePayload | null>(null);
  const [previewServings, setPreviewServings] = useState(1);
  const [previewNote, setPreviewNote] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setOriginFilter("all");
    setFavouritesOnly(false);
    setSelectedRecipe(null);
    setPreviewServings(1);
    setPreviewNote("");
    setLoadError(null);
  }, [open]);

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
    return results.filter((recipe) => {
      if (originFilter !== "all" && recipe.origin !== originFilter) {
        return false;
      }

      if (favouritesOnly && !recipe.favourite) {
        return false;
      }

      return true;
    });
  }, [favouritesOnly, originFilter, results]);

  return (
    <ModalShell
      ariaLabel="Find and link recipe"
      bodyClassName={`${styles.recipeSearchModalBody} ${selectedRecipe ? "" : styles.recipeSearchModalBodyBrowse}`}
      className={`${styles.recipeSearchModalPanel} ${selectedRecipe ? "" : styles.recipeSearchModalPanelBrowse}`}
      closeLabel="Close recipe search dialog"
      onClose={() => {
        if (selectedRecipe) {
          setSelectedRecipe(null);
          return;
        }
        onClose();
      }}
      open={open}
      title="Link a recipe"
      footerLeft={selectedRecipe ? <Button onClick={() => setSelectedRecipe(null)} type="button" variant="outline">Back to results</Button> : undefined}
      footerRight={
        selectedRecipe ? (
          <>
            <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
            <Button
              disabled={isConfirming}
              onClick={async () => {
                if (!selectedRecipe) return;
                setIsConfirming(true);
                try {
                  await onSelectRecipe(selectedRecipe, previewServings, previewNote.trim());
                } finally {
                  setIsConfirming(false);
                }
              }}
              type="button"
              variant="accent"
            >
              {isConfirming ? "Linking..." : "Confirm Link"}
            </Button>
          </>
        ) : (
          <Button onClick={onClose} type="button" variant="outline">Close</Button>
        )
      }
    >
          {selectedRecipe ? (
            <>
              <div className={styles.recipePreviewPanel}>
                <h4 className={styles.recipePreviewTitle}>{selectedRecipe.title}</h4>

                {getCuisineLabel(selectedRecipe.cuisine) ? (
                  <div className={styles.recipePreviewSection}>
                    <label className={styles.formLabel}>Cuisine</label>
                    <div className={styles.readOnlyValue}>
                      {getCuisineLabel(selectedRecipe.cuisine)}
                    </div>
                  </div>
                ) : null}

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
                      selectedRecipe.ingredients.map(
                        (ingredient: RecipePayload["ingredients"][number]) => (
                        <span className={styles.recipePreviewChip} key={ingredient.id}>
                          {ingredient.name}
                        </span>
                        )
                      )
                    ) : (
                      <span className={styles.readOnlyEmpty}>No ingredients listed</span>
                    )}
                  </div>
                </div>

                <div className={styles.recipePreviewSection}>
                  <label className={styles.formLabel}>Instructions</label>
                  {selectedRecipe.instructions.length > 0 ? (
                    <ol className={styles.instructionsList}>
                      {selectedRecipe.instructions.map((step: string, index: number) => (
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
            <div className={styles.recipeSearchBrowseState}>
              <div className={styles.recipeSearchFilterRow}>
                <input
                  autoFocus
                  autoComplete="off"
                  className={styles.formInput}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search recipe book..."
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
                <label className={styles.recipeSearchCheckbox}>
                  <input
                    checked={favouritesOnly}
                    onChange={(event) => setFavouritesOnly(event.target.checked)}
                    type="checkbox"
                  />
                  <span className={styles.recipeSearchCheckboxMark} aria-hidden="true" />
                  <span className={styles.recipeSearchCheckboxLabel}>Favourites only</span>
                </label>
              </div>

              <div className={styles.recipeSearchStatusText}>
                {isLoading
                  ? "Loading recipes..."
                  : `${filteredResults.length} ${
                      favouritesOnly ? "favourite recipe" : "recipe"
                    }${filteredResults.length === 1 ? "" : "s"}`}
              </div>

              {loadError ? (
                <p className={styles.confirmationError}>{loadError}</p>
              ) : null}

              {errorMessage ? (
                <p className={styles.confirmationError}>{errorMessage}</p>
              ) : null}

              <div className={styles.recipeSearchResultsArea}>
                <ul className={styles.recipeSearchList}>
                  {filteredResults.map((recipe) => {
                    const duplicateName =
                      normalizedMealName.length > 0 &&
                      recipe.title.trim().toLowerCase() === normalizedMealName;

                    return (
                      <li className={styles.recipeSearchListItem} key={recipe.id}>
                        <button
                          className={styles.recipeSearchListBtn}
                          onClick={() => {
                            setSelectedRecipe(recipe);
                            setPreviewServings(Math.max(1, recipe.servings || 1));
                            setPreviewNote("");
                          }}
                          type="button"
                        >
                          <span className={styles.recipeSearchTitle}>{recipe.title}</span>
                          <span className={styles.recipeSearchListMeta}>
                            {recipe.favourite ? "★ " : ""}
                            {[
                              getCuisineLabel(recipe.cuisine),
                              recipe.origin,
                              `${recipe.ingredients.length} ingredients`,
                              duplicateName ? "same as meal name" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {!isLoading && !loadError && filteredResults.length === 0 ? (
                  <p className={styles.recipeSearchEmptyState}>No recipes found.</p>
                ) : null}
              </div>
            </div>
          )}
    </ModalShell>
  );
}
