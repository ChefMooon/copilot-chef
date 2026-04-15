import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type RecipeExportModalProps = {
  totalRecipes: number;
  selectedCount: number;
  isExporting: boolean;
  onClose: () => void;
  onExportAll: () => void;
  onExportSelected: () => void;
};

export function RecipeExportModal({
  totalRecipes,
  selectedCount,
  isExporting,
  onClose,
  onExportAll,
  onExportSelected,
}: RecipeExportModalProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hasRecipes = totalRecipes > 0;
  const hasSelection = selectedCount > 0;

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isExporting) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isExporting, onClose]);

  useEffect(() => {
    if (!portalRoot) {
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
  }, [portalRoot]);

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-2.5 backdrop-blur-[3px] sm:p-4"
      onMouseDown={(event) => {
        if (!isExporting && event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-label="Export recipes"
        aria-modal="true"
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-card border border-cream-dark bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="border-b border-cream-dark px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">
                Recipe Export
              </p>
              <h2 className="font-serif text-2xl font-semibold text-text sm:text-[2rem]">
                Export your recipe library
              </h2>
              <p className="mt-2 max-w-lg text-sm text-text-muted">
                Choose whether to download your full library or just the recipes you have selected.
              </p>
            </div>
            <button
              aria-label="Close export dialog"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream-dark bg-cream text-text-muted transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isExporting}
              onClick={onClose}
              type="button"
            >
              x
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 px-4 py-4 sm:px-5 sm:py-5">
          {!hasRecipes ? (
            <div className="rounded-card border border-dashed border-cream-dark bg-cream px-4 py-6 text-center sm:px-6">
              <h3 className="font-serif text-xl font-semibold text-text">Nothing to export</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
                Add or import recipes first, then come back here to download your recipe library.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-card border border-green/10 bg-green-pale/60 px-4 py-3">
                  <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-green">
                    Selected recipes
                  </p>
                  <p className="mt-2 font-serif text-3xl font-semibold leading-none text-text">
                    {selectedCount}
                  </p>
                  <p className="mt-2 text-sm text-text-muted">
                    {hasSelection
                      ? "These recipes will be included if you export your current selection."
                      : "Select recipes from the grid if you want to export only part of your library."}
                  </p>
                </div>

                <div className="rounded-card border border-cream-dark bg-cream px-4 py-3">
                  <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">
                    Total recipes
                  </p>
                  <p className="mt-2 font-serif text-3xl font-semibold leading-none text-text">
                    {totalRecipes}
                  </p>
                  <p className="mt-2 text-sm text-text-muted">
                    Export all recipes to capture your full library in one JSON file.
                  </p>
                </div>
              </div>

              <div className="rounded-card border border-cream-dark bg-white px-4 py-4">
                <h3 className="font-serif text-lg font-semibold text-text">What do you want to export?</h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  {hasSelection
                    ? `You currently have ${selectedCount} recipe${selectedCount === 1 ? "" : "s"} selected out of ${totalRecipes}.`
                    : `You have ${totalRecipes} recipe${totalRecipes === 1 ? "" : "s"} available to export.`}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-cream-dark px-4 py-3 sm:px-5">
          <Button disabled={isExporting} onClick={onClose} type="button" variant="outline">
            {hasRecipes ? "Cancel" : "Close"}
          </Button>
          {hasRecipes ? (
            <>
              {hasSelection ? (
                <Button
                  disabled={isExporting}
                  onClick={onExportAll}
                  type="button"
                  variant="outline"
                >
                  {isExporting ? "Preparing export..." : `Export all ${totalRecipes}`}
                </Button>
              ) : null}
              <Button
                autoFocus
                disabled={isExporting}
                onClick={hasSelection ? onExportSelected : onExportAll}
                type="button"
                variant="default"
              >
                {isExporting
                  ? "Preparing export..."
                  : hasSelection
                    ? `Export ${selectedCount} selected`
                    : `Export all ${totalRecipes}`}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    portalRoot
  );
}