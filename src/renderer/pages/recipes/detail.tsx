import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";

import { deleteRecipe, fetchJson } from "@/lib/api";
import { getCachedConfig, isServerConfigReady } from "@/lib/config";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { RecipeDeleteDialog } from "@/components/recipes/RecipeDeleteDialog";
import { type RecipePayload } from "@/lib/api";
import { recipeKeys } from "@/lib/query-keys";
import { useChatPageContext } from "@/context/chat-context";

type RecipeDetailResponse = {
  data: RecipePayload;
};

type PreferencesResponse = {
  data: {
    defaultUnitMode?: string;
    defaultRecipeView?: string;
  };
};

function RecipeDetailContent({
  recipe,
  defaultUnitMode,
  defaultView,
  isDeleting,
  onDeleteRequest,
}: {
  recipe: RecipePayload;
  defaultUnitMode: "cup" | "grams";
  defaultView: "basic" | "detailed" | "cooking";
  isDeleting: boolean;
  onDeleteRequest: () => void;
}) {
  const [liveState, setLiveState] = useState<{
    activeView: "basic" | "detailed" | "cooking";
    activeUnitMode: "cup" | "grams";
    cookingStepNumber: number | null;
  }>({
    activeView: defaultView,
    activeUnitMode: defaultUnitMode,
    cookingStepNumber: defaultView === "cooking" ? 1 : null,
  });

  useChatPageContext({
    page: "recipe-detail",
    recipeId: recipe.id,
    title: recipe.title,
    description: recipe.description,
    difficulty: recipe.difficulty,
    cuisine: recipe.cuisine,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    rating: recipe.rating,
    origin: recipe.origin,
    favourite: recipe.favourite,
    tags: recipe.tags,
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    })),
    activeView: liveState.activeView,
    activeUnitMode: liveState.activeUnitMode,
    cookingStepNumber: liveState.cookingStepNumber,
  });

  return (
    <RecipeDetail
      defaultUnitMode={defaultUnitMode}
      defaultView={defaultView}
      isDeleting={isDeleting}
      onContextStateChange={setLiveState}
      onDeleteRequest={onDeleteRequest}
      recipe={recipe}
    />
  );
}

export default function RecipeDetailPage() {
  const apiReady = isServerConfigReady(getCachedConfig());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { recipeId } = useParams<{ recipeId: string }>();
  const [recipePendingDelete, setRecipePendingDelete] = useState<RecipePayload | null>(
    null
  );

  const recipeQuery = useQuery({
    queryKey: recipeId ? recipeKeys.detail(recipeId) : recipeKeys.detail(""),
    queryFn: () =>
      fetchJson<RecipeDetailResponse>(`/api/recipes/${recipeId}`).then(
        (response) => response.data
      ),
    enabled: apiReady && Boolean(recipeId),
  });

  const preferencesQuery = useQuery({
    queryKey: ["preferences"],
    enabled: apiReady,
    queryFn: () =>
      fetchJson<PreferencesResponse>("/api/preferences").then(
        (response) => response.data
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: async (_, deletedRecipeId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
        queryClient.removeQueries({ queryKey: recipeKeys.detail(deletedRecipeId) }),
      ]);
      navigate("/recipes", { replace: true });
    },
  });

  if (recipeQuery.isLoading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-text-muted">Loading recipe...</p>
      </div>
    );
  }

  if (!recipeQuery.data) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-[16px] border border-[rgba(59,94,69,0.1)] bg-white p-6 shadow-card">
          <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">
            Recipe Library
          </p>
          <h1 className="mt-2 font-serif text-[2rem] font-bold leading-[1.12] text-text">
            Recipe not found
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            This recipe may have been removed or the link is no longer valid.
          </p>
        </div>
      </div>
    );
  }

  const preferences = preferencesQuery.data;
  const defaultUnitMode =
    preferences?.defaultUnitMode === "grams" ? "grams" : "cup";
  const defaultView =
    preferences?.defaultRecipeView === "detailed"
      ? "detailed"
      : preferences?.defaultRecipeView === "cooking"
        ? "cooking"
        : "basic";

  return (
    <div className="p-4 md:p-6">
      <RecipeDetailContent
        defaultUnitMode={defaultUnitMode}
        defaultView={defaultView}
        isDeleting={deleteMutation.isPending}
        onDeleteRequest={() => setRecipePendingDelete(recipeQuery.data)}
        recipe={recipeQuery.data}
      />
      <RecipeDeleteDialog
        isDeleting={deleteMutation.isPending}
        onConfirm={() => {
          if (!recipePendingDelete) {
            return;
          }

          void deleteMutation.mutateAsync(recipePendingDelete.id).then(() => {
            setRecipePendingDelete(null);
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
