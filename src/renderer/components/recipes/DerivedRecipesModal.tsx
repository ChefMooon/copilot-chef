import { useEffect } from "react";
import { Link } from "react-router";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { type RecipeIterationPayload } from "@/lib/api";

type DerivedRecipesModalProps = {
  open: boolean;
  iterations: RecipeIterationPayload[];
  onClose: () => void;
};

export function DerivedRecipesModal({
  open,
  iterations,
  onClose,
}: DerivedRecipesModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || iterations.length <= 1) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-2.5 backdrop-blur-[3px] sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-cream-dark bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Derived recipes"
      >
        <div className="flex items-start justify-between gap-3 border-b border-cream-dark px-3.5 py-3 sm:px-5 sm:py-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-orange sm:text-xs">
              Recipe Lineage
            </p>
            <h2 className="font-serif text-xl font-semibold text-text sm:text-2xl">
              Derived Recipes
            </h2>
          </div>
          <Button
            className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            Close
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 py-3 sm:px-5 sm:py-4">
          <ul className="space-y-2">
            {iterations.map((iteration) => (
              <li key={iteration.id}>
                <Link
                  className="block rounded-[10px] border border-cream-dark bg-cream px-3 py-2 text-[0.92rem] font-semibold text-green transition-colors hover:border-green-light hover:bg-green-pale"
                  onClick={onClose}
                  style={{ paddingLeft: `${0.75 + Math.max(0, iteration.depth - 1) * 1.1}rem` }}
                  to={`/recipes/${iteration.id}`}
                >
                  {iteration.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
}