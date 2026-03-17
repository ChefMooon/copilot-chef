import { RecipeService } from "@copilot-chef/core";
import { z } from "zod";
import { NextResponse } from "next/server";

const recipeService = new RecipeService();

const createSchema = z.object({
  recipeIds: z.array(z.string().min(1)).min(1),
  name: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createSchema.parse(body);
    const data = await recipeService.generateGroceryList(input.recipeIds, input.name);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate grocery list from recipes",
        code: "RECIPE_GROCERY_GENERATE_FAILED",
      },
      { status: 400 }
    );
  }
}
