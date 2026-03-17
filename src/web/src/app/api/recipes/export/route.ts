import { RecipeService } from "@copilot-chef/core";
import { NextRequest, NextResponse } from "next/server";

const recipeService = new RecipeService();

export async function GET(request: NextRequest) {
  try {
    const ids = request.nextUrl.searchParams
      .get("ids")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const data = await recipeService.exportRecipes(ids && ids.length > 0 ? ids : undefined);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to export recipes",
        code: "RECIPE_EXPORT_FAILED",
      },
      { status: 400 }
    );
  }
}
