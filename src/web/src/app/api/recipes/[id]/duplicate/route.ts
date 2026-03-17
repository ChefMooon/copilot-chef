import { RecipeService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const recipeService = new RecipeService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await recipeService.duplicateRecipe(id, body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to duplicate recipe",
        code: "RECIPE_DUPLICATE_FAILED",
      },
      { status: 400 }
    );
  }
}
