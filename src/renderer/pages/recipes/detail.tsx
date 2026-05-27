import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router";

import {
  deleteRecipe,
  fetchJson,
  getRecipeIterations,
} from "@/lib/api";
import { isServerConfigReady } from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { RecipeDeleteDialog } from "@/components/recipes/RecipeDeleteDialog";
import {
  type RecipeIterationPayload,
  type RecipeMadeHistoryPayload,
  type RecipePayload,
} from "@/lib/api";
import { recipeKeys } from "@/lib/query-keys";

type RecipeDetailResponse = {
  data: RecipePayload;
};

type RecipeMadeHistoryResponse = {
  data: RecipeMadeHistoryPayload;
};

type PreferencesResponse = {
  data: {
    defaultUnitMode?: string;
    defaultRecipeView?: string;
  };
};

function RecipeDetailContent({
  recipe,
  iterations,
  isIterationsLoading,
  initiallyEditing,
  defaultUnitMode,
  defaultView,
  isDeleting,
  onDeleteRequest,
  madeHistory,
  isMadeHistoryLoading,
}: {
  recipe: RecipePayload;
  iterations: RecipeIterationPayload[];
  isIterationsLoading: boolean;
  initiallyEditing: boolean;
  defaultUnitMode: "cup" | "grams";
  defaultView: "basic" | "detailed" | "cooking";
  isDeleting: boolean;
  onDeleteRequest: () => void;
  madeHistory: RecipeMadeHistoryPayload | null;
  isMadeHistoryLoading: boolean;
}) {
  const [, setLiveState] = useState<{
    activeView: "basic" | "detailed" | "cooking";
    activeUnitMode: "cup" | "grams";
    cookingStepNumber: number | null;
  }>({
    activeView: defaultView,
    activeUnitMode: defaultUnitMode,
    cookingStepNumber: defaultView === "cooking" ? 1 : null,
  });

  return (
    <RecipeDetail
      defaultUnitMode={defaultUnitMode}
      defaultView={defaultView}
      initiallyEditing={initiallyEditing}
      isMadeHistoryLoading={isMadeHistoryLoading}
      isIterationsLoading={isIterationsLoading}
      isDeleting={isDeleting}
      iterations={iterations}
      madeHistory={madeHistory}
      onContextStateChange={setLiveState}
      onDeleteRequest={onDeleteRequest}
      recipe={recipe}
    />
  );
}

export default function RecipeDetailPage() {
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { recipeId } = useParams<{ recipeId: string }>();
  const initiallyEditing = new URLSearchParams(location.search).get("edit") === "1";
  const [recipePendingDelete, setRecipePendingDelete] =
    useState<RecipePayload | null>(null);

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

  const iterationsQuery = useQuery({
    queryKey: recipeId ? recipeKeys.iterations(recipeId) : recipeKeys.iterations(""),
    queryFn: () => getRecipeIterations(recipeId ?? ""),
    enabled: apiReady && Boolean(recipeId),
  });

  const madeHistoryQuery = useQuery({
    queryKey: recipeId ? recipeKeys.madeHistory(recipeId) : recipeKeys.madeHistory(""),
    queryFn: () =>
      fetchJson<RecipeMadeHistoryResponse>(`/api/recipes/${recipeId}/made-history`).then(
        (response) => response.data
      ),
    enabled: apiReady && Boolean(recipeId),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: async (_, deletedRecipeId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
        queryClient.removeQueries({
          queryKey: recipeKeys.detail(deletedRecipeId),
        }),
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
        initiallyEditing={initiallyEditing}
        isMadeHistoryLoading={madeHistoryQuery.isLoading}
        isIterationsLoading={iterationsQuery.isLoading}
        isDeleting={deleteMutation.isPending}
        madeHistory={madeHistoryQuery.data ?? null}
        onDeleteRequest={() => setRecipePendingDelete(recipeQuery.data)}
        iterations={iterationsQuery.data ?? []}
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
