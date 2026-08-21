import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/ModalShell";

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
  const hasRecipes = totalRecipes > 0;
  const hasSelection = selectedCount > 0;
  return (
    <ModalShell
      open
      ariaLabel="Export recipes"
      bodyClassName="flex-1 space-y-4 px-4 py-4 sm:px-5 sm:py-5"
      className="max-w-xl"
      closeDisabled={isExporting}
      closeLabel="Close export dialog"
      eyebrow="Recipe Export"
      onClose={onClose}
      subtitle="Choose whether to download your full library or just the recipes you have selected."
      title="Export your recipe library"
      footerRight={
        <>
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
                variant="accent"
              >
                {isExporting
                  ? "Preparing export..."
                  : hasSelection
                    ? `Export ${selectedCount} selected`
                    : `Export all ${totalRecipes}`}
              </Button>
            </>
          ) : null}
        </>
      }
    >
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
    </ModalShell>
  );
}