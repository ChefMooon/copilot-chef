import {
  CreateRecipeInputSchema,
  RecipeService,
  type RecipeFilters,
} from "@copilot-chef/core";
import { NextRequest, NextResponse } from "next/server";

const recipeService = new RecipeService();

function parseFilters(request: NextRequest): RecipeFilters {
  const origin = request.nextUrl.searchParams.get("origin");
  const difficulty = request.nextUrl.searchParams.get("difficulty");
  const maxCookTime = request.nextUrl.searchParams.get("maxCookTime");
  const rating = request.nextUrl.searchParams.get("rating");
  const tags = request.nextUrl.searchParams
    .get("tags")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    origin:
      origin === "manual" || origin === "imported" || origin === "ai_generated"
        ? origin
        : undefined,
    difficulty: difficulty ?? undefined,
    maxCookTime: maxCookTime ? Number.parseInt(maxCookTime, 10) : undefined,
    rating: rating ? Number.parseInt(rating, 10) : undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query")?.trim();
    const data = query
      ? await recipeService.searchRecipes(query)
      : await recipeService.listRecipes(parseFilters(request));

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to list recipes",
        code: "RECIPE_LIST_FAILED",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = CreateRecipeInputSchema.parse(body);
    const data = await recipeService.createRecipe(input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create recipe",
        code: "RECIPE_CREATE_FAILED",
      },
      { status: 400 }
    );
  }
}
