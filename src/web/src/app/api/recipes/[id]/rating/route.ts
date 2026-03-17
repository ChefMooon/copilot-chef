import { RecipeService } from "@copilot-chef/core";
import { z } from "zod";
import { NextResponse } from "next/server";

const recipeService = new RecipeService();

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  cookNotes: z.string().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = ratingSchema.parse(body);
    const data = await recipeService.updateRating(id, input.rating, input.cookNotes);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update rating",
        code: "RECIPE_RATING_FAILED",
      },
      { status: 400 }
    );
  }
}
