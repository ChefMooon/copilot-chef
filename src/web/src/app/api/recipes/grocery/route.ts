import { RecipeService } from "@copilot-chef/core";
import { z } from "zod";
import { NextResponse } from "next/server";

const recipeService = new RecipeService();

const addSchema = z.object({
  recipeIds: z.array(z.string().min(1)).min(1),
  groceryListId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = addSchema.parse(body);
    await recipeService.addToGroceryList(input.recipeIds, input.groceryListId);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to add recipe ingredients",
        code: "RECIPE_GROCERY_ADD_FAILED",
      },
      { status: 400 }
    );
  }
}
