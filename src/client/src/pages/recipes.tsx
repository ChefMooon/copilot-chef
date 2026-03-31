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

import { AddRecipeModal } from "@/components/recipes/AddRecipeModal";
import { IngestModal } from "@/components/recipes/IngestModal";
import { RecipeFilterSidebar } from "@/components/recipes/RecipeFilterSidebar";
import { RecipeGrid } from "@/components/recipes/RecipeGrid";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useChatPageContext } from "@/context/chat-context";

const recipesKey = ["recipes"] as const;

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
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showIngest, setShowIngest] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipePayload | null>(null);
  const [recipePendingDelete, setRecipePendingDelete] = useState<RecipePayload | null>(null);

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
      if (!search.trim()) {
        return true;
      }
      const query = search.trim().toLowerCase();
      return (
        recipe.title.toLowerCase().includes(query) ||
        (recipe.description ?? "").toLowerCase().includes(query) ||
        recipe.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        recipe.ingredients.some((ingredient) =>
          ingredient.name.toLowerCase().includes(query)
        )
      );
    });
  }, [recipesQuery.data, origin, search]);

  useChatPageContext({
    page: "recipes",
    search,
    origin: origin || "all",
    totalRecipes: recipesQuery.data?.length ?? 0,
    filteredRecipes: filteredRecipes.length,
    visibleRecipes: filteredRecipes.slice(0, 10).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      origin: recipe.origin,
    })),
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

  async function handleExport() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
    const payload = await exportRecipes(ids);
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(payload, `copilot-chef-recipes-${date}.json`);
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
            onClick={() => void handleExport()}
            size="sm"
            type="button"
            variant="accent"
          >
            Export
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <RecipeFilterSidebar
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
          onToggleSelect={toggleSelection}
          recipes={filteredRecipes as RecipePayload[]}
          selectedIds={selectedIds}
        />
      </div>

      <AddRecipeModal
        initialRecipe={editingRecipe}
        isSaving={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          if (createMutation.isPending || updateMutation.isPending) {
            return;
          }
          setShowAddModal(false);
          setEditingRecipe(null);
        }}
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

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setRecipePendingDelete(null);
          }
        }}
        open={Boolean(recipePendingDelete)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              {recipePendingDelete
                ? `This will permanently delete ${recipePendingDelete.title}.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                disabled={deleteMutation.isPending || !recipePendingDelete}
                onClick={() => {
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
                type="button"
                variant="accent"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
