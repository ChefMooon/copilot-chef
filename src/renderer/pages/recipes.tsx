import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  confirmIngestRecipe,
  createRecipe,
  deleteRecipe,
  exportRecipes,
  importRecipes,
  listRecipes,
  updateRecipe,
  type RecipePayload,
} from "@/lib/api";
import { recipeKeys } from "@/lib/query-keys";

import { AddRecipeModal } from "@/components/recipes/AddRecipeModal";
import { RecipeDeleteDialog } from "@/components/recipes/RecipeDeleteDialog";
import { IngestModal } from "@/components/recipes/IngestModal";
import { RecipeExportModal } from "@/components/recipes/RecipeExportModal";
import { RecipeFilterSidebar } from "@/components/recipes/RecipeFilterSidebar";
import { RecipeGrid } from "@/components/recipes/RecipeGrid";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { useChatPageContext } from "@/context/chat-context";
import { getCuisineLabel } from "@shared/api/constants";

const recipesKey = recipeKeys.all;

function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function RecipesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [showIngest, setShowIngest] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipePayload | null>(null);
  const [recipePendingDelete, setRecipePendingDelete] = useState<RecipePayload | null>(null);
  const [recipeEditorDraft, setRecipeEditorDraft] = useState<{
    title: string;
    description: string | null;
    servings: number | null;
    ingredientCount: number;
    instructionCount: number;
    cuisine: string | null;
    difficulty: string | null;
    tagsCount: number;
  } | null>(null);

  const recipesQuery = useQuery({
    queryKey: recipesKey,
    queryFn: () => listRecipes(),
  });

  const createMutation = useMutation({
    mutationFn: createRecipe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recipesKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, recipe }: { id: string; recipe: Parameters<typeof createRecipe>[0] }) =>
      updateRecipe(id, recipe),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recipesKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recipesKey });
    },
  });

  const confirmIngestMutation = useMutation({
    mutationFn: confirmIngestRecipe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recipesKey });
    },
  });

  const filteredRecipes = useMemo(() => {
    const recipes = recipesQuery.data ?? [];
    return recipes.filter((recipe) => {
      if (origin && recipe.origin !== origin) {
        return false;
      }
      if (cuisine && recipe.cuisine !== cuisine) {
        return false;
      }
      if (favouritesOnly && !recipe.favourite) {
        return false;
      }
      if (!search.trim()) {
        return true;
      }
      const query = search.trim().toLowerCase();
      const cuisineLabel = getCuisineLabel(recipe.cuisine)?.toLowerCase() ?? "";
      return (
        recipe.title.toLowerCase().includes(query) ||
        (recipe.description ?? "").toLowerCase().includes(query) ||
        (recipe.cuisine ?? "").toLowerCase().includes(query) ||
        cuisineLabel.includes(query) ||
        recipe.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        recipe.ingredients.some((ingredient) =>
          ingredient.name.toLowerCase().includes(query)
        )
      );
    });
  }, [cuisine, favouritesOnly, recipesQuery.data, origin, search]);

  const totalRecipes = recipesQuery.data?.length ?? 0;
  const favouriteCount =
    recipesQuery.data?.filter((recipe) => recipe.favourite).length ?? 0;
  const selectedCount = selectedIds.size;

  useChatPageContext({
    page: "recipes",
    search,
    origin: origin || "all",
    cuisine: cuisine || "all",
    totalRecipes: recipesQuery.data?.length ?? 0,
    favouriteCount,
    filteredRecipes: filteredRecipes.length,
    showingFavouritesOnly: favouritesOnly,
    visibleRecipes: filteredRecipes.slice(0, 10).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      origin: recipe.origin,
      cuisine: recipe.cuisine,
      favourite: recipe.favourite,
    })),
    recipeEditor: {
      isOpen: showAddModal,
      mode: editingRecipe ? "edit" : "add",
      draft: recipeEditorDraft,
    },
  });

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleToggleFavourite(
    recipe: RecipePayload,
    nextValue: boolean
  ) {
    const previousRecipes = recipesQuery.data ?? [];
    const nextRecipes = previousRecipes.map((entry) =>
      entry.id === recipe.id ? { ...entry, favourite: nextValue } : entry
    );

    queryClient.setQueryData(recipesKey, nextRecipes);
    queryClient.setQueryData(recipeKeys.detail(recipe.id), {
      ...recipe,
      favourite: nextValue,
    });

    try {
      const updated = await updateRecipe(recipe.id, { favourite: nextValue });
      queryClient.setQueryData(recipesKey, (current: RecipePayload[] | undefined) =>
        (current ?? nextRecipes).map((entry) =>
          entry.id === updated.id ? updated : entry
        )
      );
      queryClient.setQueryData(recipeKeys.detail(recipe.id), updated);
    } catch {
      queryClient.setQueryData(recipesKey, previousRecipes);
      queryClient.setQueryData(recipeKeys.detail(recipe.id), recipe);
      toast({
        title: "Could not update favourite.",
        description: "Try again in a moment.",
        variant: "error",
      });
    }
  }

  async function handleExport(scope: "all" | "selected") {
    setIsExporting(true);
    const ids = scope === "selected" ? Array.from(selectedIds) : undefined;
    try {
      const payload = await exportRecipes(ids);
      const date = new Date().toISOString().slice(0, 10);
      const fileName =
        scope === "selected"
          ? `copilot-chef-recipes-selected-${selectedCount}-${date}.json`
          : `copilot-chef-recipes-all-${date}.json`;

      downloadJson(payload, fileName);
      toast({
        title: "Recipe export started.",
        description:
          scope === "selected"
            ? `Preparing ${selectedCount} selected recipe${selectedCount === 1 ? "" : "s"} as ${fileName}.`
            : `Preparing your full recipe library as ${fileName}.`,
      });
      setShowExportModal(false);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportRequest(scope: "all" | "selected") {
    try {
      await handleExport(scope);
    } catch {
      toast({
        title: "Could not export recipes.",
        description:
          scope === "selected"
            ? "Try again in a moment or export your full library instead."
            : "Try again in a moment.",
        variant: "error",
      });
    }
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const payload = JSON.parse(text) as Parameters<typeof importRecipes>[0];
    await importRecipes(payload);
    await queryClient.invalidateQueries({ queryKey: recipesKey });
  }

  async function handleSaveRecipe(input: Parameters<typeof createRecipe>[0]) {
    if (editingRecipe) {
      await updateMutation.mutateAsync({ id: editingRecipe.id, recipe: input });
      setEditingRecipe(null);
      setShowAddModal(false);
      return;
    }

    await createMutation.mutateAsync(input);
    setShowAddModal(false);
    setRecipeEditorDraft(null);
  }

  function handleClearFilters() {
    setSearch("");
    setOrigin("");
    setCuisine("");
    setFavouritesOnly(false);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">
            Recipe Library
          </p>
          <h1 className="font-serif text-4xl font-bold leading-[1.12] text-text sm:text-[2.75rem]">
            Your Recipes
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted sm:text-[0.95rem]">
            Browse, add, and curate recipes for your household plans.
          </p>
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            className="rounded-[10px] border-[1.5px] border-cream-dark bg-white text-[0.82rem] font-bold text-text-muted shadow-sm hover:border-green hover:bg-white hover:text-green"
            onClick={() => setShowIngest(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            Import from URL
          </Button>
          <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] border-cream-dark bg-white px-3 text-[0.82rem] font-bold text-text-muted shadow-sm transition-all hover:border-green hover:bg-white hover:text-green">
            Import JSON
            <input
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImportFile(file);
                }
              }}
              type="file"
            />
          </label>
          <Button
            onClick={() => {
              setEditingRecipe(null);
              setShowAddModal(true);
            }}
            size="sm"
            type="button"
            variant="default"
          >
            Add Recipe
          </Button>
          <Button
            disabled={recipesQuery.isLoading}
            onClick={() => setShowExportModal(true)}
            size="sm"
            type="button"
            variant="accent"
          >
            Export
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
        <div className="space-y-4">
          <RecipeFilterSidebar
            cuisine={cuisine}
            favouritesOnly={favouritesOnly}
            onClearFilters={handleClearFilters}
            onCuisineChange={setCuisine}
            onFavouritesOnlyChange={setFavouritesOnly}
            onOriginChange={setOrigin}
            onSearchChange={setSearch}
            origin={origin}
            search={search}
          />
        </div>

        <RecipeGrid
          onDelete={(recipe) => setRecipePendingDelete(recipe)}
          onEdit={(recipe) => {
            setEditingRecipe(recipe);
            setShowAddModal(true);
          }}
          onToggleFavourite={(recipe, nextValue) => {
            void handleToggleFavourite(recipe, nextValue);
          }}
          onToggleSelect={toggleSelection}
          recipes={filteredRecipes as RecipePayload[]}
          selectedIds={selectedIds}
        />
      </div>

      <AddRecipeModal
        key={editingRecipe?.id ?? "new-recipe"}
        initialRecipe={editingRecipe}
        isSaving={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          if (createMutation.isPending || updateMutation.isPending) {
            return;
          }
          setShowAddModal(false);
          setEditingRecipe(null);
          setRecipeEditorDraft(null);
        }}
        onDraftContextChange={setRecipeEditorDraft}
        onSave={handleSaveRecipe}
        open={showAddModal}
      />

      {showIngest ? (
        <IngestModal
          onClose={() => setShowIngest(false)}
          onDraft={async (draft) => {
            if (!draft.duplicate) {
              await confirmIngestMutation.mutateAsync(draft.recipe);
            }
            setShowIngest(false);
          }}
        />
      ) : null}

      {showExportModal ? (
        <RecipeExportModal
          isExporting={isExporting}
          onClose={() => {
            if (isExporting) {
              return;
            }
            setShowExportModal(false);
          }}
          onExportAll={() => void handleExportRequest("all")}
          onExportSelected={() => void handleExportRequest("selected")}
          selectedCount={selectedCount}
          totalRecipes={totalRecipes}
        />
      ) : null}

      <RecipeDeleteDialog
        isDeleting={deleteMutation.isPending}
        onConfirm={() => {
          if (!recipePendingDelete) {
            return;
          }

          void deleteMutation.mutateAsync(recipePendingDelete.id).then(() => {
            setRecipePendingDelete(null);
            setSelectedIds((current) => {
              const next = new Set(current);
              next.delete(recipePendingDelete.id);
              return next;
            });
          });
        }}
        onOpenChange={(open) => {
          if (!open) {
            setRecipePendingDelete(null);
          }
        }}
        recipe={recipePendingDelete}
      />
    </div>
  );
}
