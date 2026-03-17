import { RecipeExportJsonSchema, RecipeService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const recipeService = new RecipeService();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = RecipeExportJsonSchema.parse(body);
    const data = await recipeService.importRecipes(input);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to import recipes",
        code: "RECIPE_IMPORT_FAILED",
      },
      { status: 400 }
    );
  }
}
