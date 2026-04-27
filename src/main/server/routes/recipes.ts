import { Hono, type Context } from "hono";
import {
  CreateRecipeInputSchema,
  UpdateRecipeInputSchema,
  RecipeExportJsonSchema,
  type RecipeFilters,
} from "../core-index";
import { z } from "zod";
import { recipeService } from "../services.js";

export const recipesRoutes = new Hono();

function toRecipeErrorResponse(error: unknown, fallbackMessage: string, fallbackCode: string) {
  if (
    error instanceof Error &&
    "code" in error &&
    "reason" in error &&
    "existing" in error &&
    (error as { code?: unknown }).code &&
    (error as { reason?: unknown }).reason &&
    (error as { existing?: unknown }).existing
  ) {
    return {
      body: {
        error: error.message,
        code: (error as { code: string }).code,
        reason: (error as { reason: string }).reason,
        existing: (error as { existing: unknown }).existing,
      },
      status: 409,
    };
  }

  return {
    body: {
      error: error instanceof Error ? error.message : fallbackMessage,
      code: fallbackCode,
    },
    status: 400,
  };
}

function parseFilters(c: Context): RecipeFilters {
  const origin = c.req.query("origin");
  const cuisine = c.req.query("cuisine");
  const difficulty = c.req.query("difficulty");
  const maxCookTime = c.req.query("maxCookTime");
  const favourite = c.req.query("favourite");
  const rating = c.req.query("rating");
  const tags = c.req.query("tags")
    ?.split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return {
    origin:
      origin === "manual" || origin === "imported" || origin === "ai_generated"
        ? origin
        : undefined,
    cuisine: cuisine?.trim() || undefined,
    difficulty: difficulty ?? undefined,
    maxCookTime: maxCookTime ? Number.parseInt(maxCookTime, 10) : undefined,
    favourite:
      favourite === "true"
        ? true
        : favourite === "false"
          ? false
          : undefined,
    rating: rating ? Number.parseInt(rating, 10) : undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
  };
}

function matchesFilters(
  recipe: Awaited<ReturnType<typeof recipeService.searchRecipes>>[number],
  filters: RecipeFilters
) {
  if (filters.origin && recipe.origin !== filters.origin) {
    return false;
  }
  if (filters.cuisine && recipe.cuisine !== filters.cuisine) {
    return false;
  }
  if (filters.difficulty && recipe.difficulty !== filters.difficulty) {
    return false;
  }
  if (filters.maxCookTime !== undefined) {
    if (recipe.cookTime == null || recipe.cookTime > filters.maxCookTime) {
      return false;
    }
  }
  if (filters.favourite !== undefined && recipe.favourite !== filters.favourite) {
    return false;
  }
  if (filters.rating !== undefined) {
    if (recipe.rating == null || recipe.rating < filters.rating) {
      return false;
    }
  }
  if (filters.tags && filters.tags.length > 0) {
    const recipeTags = new Set(recipe.tags.map((tag) => tag.toLowerCase()));
    return filters.tags.every((tag) => recipeTags.has(tag.toLowerCase()));
  }
  return true;
}

recipesRoutes.get("/recipes", async (c) => {
  try {
    const query = c.req.query("query")?.trim();
    const filters = parseFilters(c);
    const data = query
      ? (await recipeService.searchRecipes(query)).filter((recipe) =>
          matchesFilters(recipe, filters)
        )
      : await recipeService.listRecipes(filters);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to list recipes", code: "RECIPE_LIST_FAILED" },
      400
    );
  }
});

recipesRoutes.post("/recipes", async (c) => {
  try {
    const body = await c.req.json();
    const input = CreateRecipeInputSchema.parse(body);
    const data = await recipeService.createRecipe(input);
    return c.json({ data }, 201);
  } catch (error) {
    const response = toRecipeErrorResponse(
      error,
      "Unable to create recipe",
      "RECIPE_CREATE_FAILED"
    );
    return c.json(response.body, response.status);
  }
});

recipesRoutes.get("/recipes/export", async (c) => {
  try {
    const ids = c.req.query("ids")
      ?.split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const data = await recipeService.exportRecipes(ids && ids.length > 0 ? ids : undefined);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to export recipes", code: "RECIPE_EXPORT_FAILED" },
      400
    );
  }
});

recipesRoutes.post("/recipes/import", async (c) => {
  try {
    const body = await c.req.json();
    const input = RecipeExportJsonSchema.parse(body);
    const data = await recipeService.importRecipes(input);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to import recipes", code: "RECIPE_IMPORT_FAILED" },
      400
    );
  }
});

recipesRoutes.post("/recipes/ingest", async (c) => {
  try {
    const body = await c.req.json();
    const schema = z.object({ url: z.string().url() });
    const input = schema.parse(body);
    const data = await recipeService.ingestFromUrl(input.url);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to ingest recipe", code: "RECIPE_INGEST_FAILED" },
      400
    );
  }
});

recipesRoutes.post("/recipes/ingest/confirm", async (c) => {
  try {
    const body = await c.req.json();
    const input = CreateRecipeInputSchema.parse(body);
    const data = await recipeService.createRecipe(input);
    return c.json({ data }, 201);
  } catch (error) {
    const response = toRecipeErrorResponse(
      error,
      "Unable to save ingest draft",
      "RECIPE_INGEST_CONFIRM_FAILED"
    );
    return c.json(response.body, response.status);
  }
});

recipesRoutes.post("/recipes/grocery", async (c) => {
  try {
    const body = await c.req.json();
    const schema = z.object({
      recipeIds: z.array(z.string().min(1)).min(1),
      groceryListId: z.string().min(1),
    });
    const input = schema.parse(body);
    await recipeService.addToGroceryList(input.recipeIds, input.groceryListId);
    return c.json({ data: { ok: true } });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to add recipe ingredients", code: "RECIPE_GROCERY_ADD_FAILED" },
      400
    );
  }
});

recipesRoutes.post("/recipes/grocery/new", async (c) => {
  try {
    const body = await c.req.json();
    const schema = z.object({
      recipeIds: z.array(z.string().min(1)).min(1),
      name: z.string().min(1),
    });
    const input = schema.parse(body);
    const data = await recipeService.generateGroceryList(input.recipeIds, input.name);
    return c.json({ data }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to generate grocery list from recipes", code: "RECIPE_GROCERY_GENERATE_FAILED" },
      400
    );
  }
});

recipesRoutes.get("/recipes/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await recipeService.getRecipe(id);
    if (!data) {
      return c.json({ error: "Recipe not found", code: "RECIPE_NOT_FOUND" }, 404);
    }
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to fetch recipe", code: "RECIPE_GET_FAILED" },
      400
    );
  }
});

recipesRoutes.put("/recipes/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const input = UpdateRecipeInputSchema.parse(body);
    const data = await recipeService.updateRecipe(id, input);
    return c.json({ data });
  } catch (error) {
    const response = toRecipeErrorResponse(
      error,
      "Unable to update recipe",
      "RECIPE_UPDATE_FAILED"
    );
    return c.json(response.body, response.status);
  }
});

recipesRoutes.delete("/recipes/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await recipeService.deleteRecipe(id);
    return c.json({ data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete recipe";
    const isConflict = message.toLowerCase().includes("sub-recipe");
    return c.json(
      { error: message, code: isConflict ? "RECIPE_DELETE_BLOCKED" : "RECIPE_DELETE_FAILED" },
      isConflict ? 409 : 400
    );
  }
});

recipesRoutes.put("/recipes/:id/rating", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      cookNotes: z.string().optional(),
    });
    const input = schema.parse(body);
    const data = await recipeService.updateRating(id, input.rating, input.cookNotes);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to update rating", code: "RECIPE_RATING_FAILED" },
      400
    );
  }
});

recipesRoutes.post("/recipes/:id/duplicate", async (c) => {
  try {
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await recipeService.duplicateRecipe(id, body);
    return c.json({ data }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to duplicate recipe", code: "RECIPE_DUPLICATE_FAILED" },
      400
    );
  }
});
