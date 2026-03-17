import { RecipeService } from "@copilot-chef/core";
import { z } from "zod";
import { NextResponse } from "next/server";

const recipeService = new RecipeService();

const ingestSchema = z.object({
  url: z.string().url(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = ingestSchema.parse(body);
    const data = await recipeService.ingestFromUrl(input.url);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to ingest recipe",
        code: "RECIPE_INGEST_FAILED",
      },
      { status: 400 }
    );
  }
}
