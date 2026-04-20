import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";

import { fetchJson } from "@/lib/api";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
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
}: {
  recipe: RecipePayload;
  defaultUnitMode: "cup" | "grams";
  defaultView: "basic" | "detailed" | "cooking";
}) {
  useChatPageContext({
    page: "recipe-detail",
    recipeId: recipe.id,
    title: recipe.title,
    description: recipe.description,
    difficulty: recipe.difficulty,
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
  });

  return (
    <RecipeDetail
      defaultUnitMode={defaultUnitMode}
      defaultView={defaultView}
      recipe={recipe}
    />
  );
}

export default function RecipeDetailPage() {
  const { recipeId } = useParams<{ recipeId: string }>();

  const recipeQuery = useQuery({
    queryKey: recipeId ? recipeKeys.detail(recipeId) : recipeKeys.detail(""),
    queryFn: () =>
      fetchJson<RecipeDetailResponse>(`/api/recipes/${recipeId}`).then(
        (response) => response.data
      ),
    enabled: Boolean(recipeId),
  });

  const preferencesQuery = useQuery({
    queryKey: ["preferences"],
    queryFn: () =>
      fetchJson<PreferencesResponse>("/api/preferences").then(
        (response) => response.data
      ),
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
        recipe={recipeQuery.data}
      />
    </div>
  );
}
