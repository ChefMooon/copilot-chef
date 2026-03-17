import { RecipeService, UpdateRecipeInputSchema } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const recipeService = new RecipeService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await recipeService.getRecipe(id);
    if (!data) {
      return NextResponse.json(
        { error: "Recipe not found", code: "RECIPE_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch recipe",
        code: "RECIPE_GET_FAILED",
      },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = UpdateRecipeInputSchema.parse(body);
    const data = await recipeService.updateRecipe(id, input);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update recipe",
        code: "RECIPE_UPDATE_FAILED",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await recipeService.deleteRecipe(id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete recipe";
    const isConflict = message.toLowerCase().includes("sub-recipe");

    return NextResponse.json(
      {
        error: message,
        code: isConflict ? "RECIPE_DELETE_BLOCKED" : "RECIPE_DELETE_FAILED",
      },
      { status: isConflict ? 409 : 400 }
    );
  }
}
