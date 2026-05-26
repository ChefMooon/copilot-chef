import { Suspense, lazy, useEffect, useMemo, useState } from "react";
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
import { isServerConfigReady } from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";
import { recipeKeys } from "@/lib/query-keys";

import { RecipeDeleteDialog } from "@/components/recipes/RecipeDeleteDialog";
import { RecipeFilterSidebar } from "@/components/recipes/RecipeFilterSidebar";
import { RecipeGrid } from "@/components/recipes/RecipeGrid";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { useChatPageContext } from "@/context/chat-context";
import { getPlatform } from "@/lib/platform";
import {
  RECIPE_SEARCH_SORT_MODE_VALUES,
  RECIPE_SORT_BY_OPTIONS,
  RECIPE_SORT_BY_VALUES,
  RECIPE_SORT_ORDER_VALUES,
  type RecipeSearchSortModeValue,
  type RecipeSortByValue,
  type RecipeSortOrderValue,
} from "@shared/api/constants";

const recipesKey = recipeKeys.all;

const AddRecipeModal = lazy(async () => {
  const module = await import("@/components/recipes/AddRecipeModal");
  return { default: module.AddRecipeModal };
});

const IngestModal = lazy(async () => {
  const module = await import("@/components/recipes/IngestModal");
  return { default: module.IngestModal };
});

const RecipeExportModal = lazy(async () => {
  const module = await import("@/components/recipes/RecipeExportModal");
  return { default: module.RecipeExportModal };
});

const RECIPE_SORT_SESSION_KEY = "recipes.sort.v1";
const RECIPE_DEFAULT_SORT_SETTING_KEY = "recipe_default_sort";
const FALLBACK_SORT_BY: RecipeSortByValue = "updated";
const FALLBACK_SORT_ORDER: RecipeSortOrderValue = "desc";
const FALLBACK_SEARCH_SORT_MODE: RecipeSearchSortModeValue = "relevance";

function getDefaultOrderForSort(sortBy: RecipeSortByValue): RecipeSortOrderValue {
  return sortBy === "title" || sortBy === "cookTime" ? "asc" : "desc";
}

function parseSortPreset(value: unknown): {
  sortBy: RecipeSortByValue;
  sortOrder: RecipeSortOrderValue;
} | null {
  if (typeof value !== "string") {
    return null;
  }

  const [rawSortBy, rawSortOrder] = value.split("_");
  if (
    !rawSortBy ||
    !rawSortOrder ||
    !(RECIPE_SORT_BY_VALUES as readonly string[]).includes(rawSortBy) ||
    !(RECIPE_SORT_ORDER_VALUES as readonly string[]).includes(rawSortOrder)
  ) {
    return null;
  }

  return {
    sortBy: rawSortBy as RecipeSortByValue,
    sortOrder: rawSortOrder as RecipeSortOrderValue,
  };
}

function parseSortSessionState(value: unknown): {
  sortBy: RecipeSortByValue;
  sortOrder: RecipeSortOrderValue;
  searchSortMode: RecipeSearchSortModeValue;
} | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    sortBy?: string;
    sortOrder?: string;
    searchSortMode?: string;
  };

  if (
    !candidate.sortBy ||
    !candidate.sortOrder ||
    !candidate.searchSortMode ||
    !(RECIPE_SORT_BY_VALUES as readonly string[]).includes(candidate.sortBy) ||
    !(RECIPE_SORT_ORDER_VALUES as readonly string[]).includes(candidate.sortOrder) ||
    !(RECIPE_SEARCH_SORT_MODE_VALUES as readonly string[]).includes(
      candidate.searchSortMode
    )
  ) {
    return null;
  }

  return {
    sortBy: candidate.sortBy as RecipeSortByValue,
    sortOrder: candidate.sortOrder as RecipeSortOrderValue,
    searchSortMode: candidate.searchSortMode as RecipeSearchSortModeValue,
  };
}

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
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<RecipeSortByValue>(FALLBACK_SORT_BY);
  const [sortOrder, setSortOrder] = useState<RecipeSortOrderValue>(
    FALLBACK_SORT_ORDER
  );
  const [searchSortMode, setSearchSortMode] =
    useState<RecipeSearchSortModeValue>(FALLBACK_SEARCH_SORT_MODE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [showIngest, setShowIngest] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipePayload | null>(
    null
  );
  const [recipePendingDelete, setRecipePendingDelete] =
    useState<RecipePayload | null>(null);
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

  useEffect(() => {
    let cancelled = false;

    const rawSession = window.sessionStorage.getItem(RECIPE_SORT_SESSION_KEY);
    if (rawSession) {
      try {
        const parsed = parseSortSessionState(JSON.parse(rawSession));
        if (parsed) {
          setSortBy(parsed.sortBy);
          setSortOrder(parsed.sortOrder);
          setSearchSortMode(parsed.searchSortMode);
          return () => {
            cancelled = true;
          };
        }
      } catch {
        // Ignore invalid session payloads.
      }
    }

    void getPlatform()
      .getSetting(RECIPE_DEFAULT_SORT_SETTING_KEY)
      .then((value) => {
        if (cancelled) {
          return;
        }

        const parsed = parseSortPreset(value);
        if (!parsed) {
          return;
        }

        setSortBy(parsed.sortBy);
        setSortOrder(parsed.sortOrder);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(
      RECIPE_SORT_SESSION_KEY,
      JSON.stringify({ sortBy, sortOrder, searchSortMode })
    );
  }, [searchSortMode, sortBy, sortOrder]);

  const recipeFilters = useMemo(
    () => ({
      query: search.trim() || undefined,
      origin: origin || undefined,
      cuisine: cuisine || undefined,
      favourite: favouritesOnly || undefined,
      sortBy,
      sortOrder,
      searchSortMode: search.trim() ? searchSortMode : undefined,
    }),
    [cuisine, favouritesOnly, origin, search, searchSortMode, sortBy, sortOrder]
  );

  const recipesQuery = useQuery({
    queryKey: [...recipesKey, recipeFilters],
    enabled: apiReady,
    queryFn: () => listRecipes(recipeFilters),
  });

  const allRecipesQuery = useQuery({
    queryKey: [...recipesKey, "all"],
    enabled: apiReady,
    queryFn: () => listRecipes(),
  });

  const createMutation = useMutation({
    mutationFn: createRecipe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recipesKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      recipe,
    }: {
      id: string;
      recipe: Parameters<typeof createRecipe>[0];
    }) => updateRecipe(id, recipe),
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

  const visibleRecipes = recipesQuery.data ?? [];
  const totalRecipes = allRecipesQuery.data?.length ?? visibleRecipes.length;
  const favouriteCount =
    allRecipesQuery.data?.filter((recipe) => recipe.favourite).length ??
    visibleRecipes.filter((recipe) => recipe.favourite).length;
  const selectedCount = selectedIds.size;
  const isInitialRecipeLoad = !recipesQuery.data && recipesQuery.isLoading;

  useChatPageContext({
    page: "recipes",
    search,
    origin: origin || "all",
    cuisine: cuisine || "all",
    sortBy,
    sortOrder,
    searchSortMode,
    totalRecipes,
    favouriteCount,
    filteredRecipes: visibleRecipes.length,
    showingFavouritesOnly: favouritesOnly,
    visibleRecipes: visibleRecipes.slice(0, 10).map((recipe) => ({
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
      queryClient.setQueryData(
        recipesKey,
        (current: RecipePayload[] | undefined) =>
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

  function handleSortByChange(value: string) {
    if (!(RECIPE_SORT_BY_VALUES as readonly string[]).includes(value)) {
      return;
    }

    const nextSortBy = value as RecipeSortByValue;
    setSortBy(nextSortBy);
    setSortOrder(getDefaultOrderForSort(nextSortBy));
  }

  function toggleSortOrder() {
    setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
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
        <div className="mt-1 flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
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

          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-[10px] border border-cream-dark bg-white px-2 py-1.5">
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text-muted">
              Sort
            </span>
            <select
              className="h-8 min-w-[150px] rounded-btn border border-cream-dark bg-cream px-2 py-1 font-sans text-xs text-text outline-none transition focus:border-green-light focus:ring-2 focus:ring-green/10"
              onChange={(event) => handleSortByChange(event.target.value)}
              value={sortBy}
            >
              {RECIPE_SORT_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              className="h-8 w-[64px] px-0 text-xs"
              onClick={toggleSortOrder}
              size="sm"
              type="button"
              variant="outline"
            >
              {sortOrder === "asc" ? "Asc" : "Desc"}
            </Button>
            {search.trim().length > 0 ? (
              <>
                <span className="ml-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-text-muted">
                  Search
                </span>
                <select
                  className="h-8 min-w-[128px] rounded-btn border border-cream-dark bg-cream px-2 py-1 font-sans text-xs text-text outline-none transition focus:border-green-light focus:ring-2 focus:ring-green/10"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      (RECIPE_SEARCH_SORT_MODE_VALUES as readonly string[]).includes(
                        value
                      )
                    ) {
                      setSearchSortMode(value as RecipeSearchSortModeValue);
                    }
                  }}
                  value={searchSortMode}
                >
                  <option value="relevance">Relevance</option>
                  <option value="selected">Selected sort</option>
                </select>
              </>
            ) : null}
          </div>
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

        {isInitialRecipeLoad ? (
          <div className="rounded-card border border-cream-dark bg-white p-8 text-center text-sm text-text-muted">
            Loading recipes...
          </div>
        ) : (
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
            recipes={visibleRecipes as RecipePayload[]}
            selectedIds={selectedIds}
          />
        )}
      </div>

      {showAddModal ? (
        <Suspense fallback={null}>
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
        </Suspense>
      ) : null}

      {showIngest ? (
        <Suspense fallback={null}>
          <IngestModal
            onClose={() => setShowIngest(false)}
            onDraft={async (draft) => {
              if (!draft.duplicate) {
                await confirmIngestMutation.mutateAsync(draft.recipe);
              }
              setShowIngest(false);
            }}
          />
        </Suspense>
      ) : null}

      {showExportModal ? (
        <Suspense fallback={null}>
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
        </Suspense>
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
