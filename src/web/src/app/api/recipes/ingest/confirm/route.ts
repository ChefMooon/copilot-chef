import { CreateRecipeInputSchema, RecipeService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const recipeService = new RecipeService();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = CreateRecipeInputSchema.parse(body);
    const data = await recipeService.createRecipe(input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save ingest draft",
        code: "RECIPE_INGEST_CONFIRM_FAILED",
      },
      { status: 400 }
    );
  }
}
