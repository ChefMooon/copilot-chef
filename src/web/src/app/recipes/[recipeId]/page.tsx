import { PreferenceService, RecipeService } from "@copilot-chef/core";

import { RecipeDetail } from "@/components/recipes/RecipeDetail";

const recipeService = new RecipeService();
const preferenceService = new PreferenceService();

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ recipeId: string }>;
}) {
  const { recipeId } = await params;
  const [recipe, preferences] = await Promise.all([
    recipeService.getRecipe(recipeId),
    preferenceService.getPreferences(),
  ]);

  if (!recipe) {
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

  return (
    <div className="p-4 md:p-6">
      <RecipeDetail
        defaultUnitMode={
          preferences.defaultUnitMode === "grams" ? "grams" : "cup"
        }
        defaultView={
          preferences.defaultRecipeView === "detailed"
            ? "detailed"
            : preferences.defaultRecipeView === "cooking"
              ? "cooking"
              : "basic"
        }
        recipe={recipe}
      />
    </div>
  );
}
