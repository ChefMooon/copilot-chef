// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCachedConfigForTests } from "./config";
import { ingestRecipe } from "./api";

describe("ingestRecipe SSE client", () => {
  beforeEach(() => {
    setCachedConfigForTests({
      mode: "remote",
      token: "test-token",
      url: "http://localhost:4173",
    });
  });

  it("processes a terminal result when EOF omits the final blank-line delimiter", async () => {
    const result = {
      duplicate: true as const,
      existing: {
        id: "recipe-1",
        title: "Macaroni Salad",
        description: null,
        servings: 4,
        prepTime: null,
        cookTime: null,
        difficulty: null,
        cuisine: null,
        instructions: ["Mix ingredients."],
        sourceUrl: "https://example.com/macaroni-salad/",
        sourceLabel: null,
        origin: "imported" as const,
        favourite: false,
        rating: null,
        cookNotes: null,
        lastMadeAt: null,
        tags: [],
        ingredients: [],
      },
    };
    const frame = `data: ${JSON.stringify({ type: "result", data: result })}`;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(frame));
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      )
    );

    await expect(ingestRecipe("https://example.com/recipe")).resolves.toEqual(result);
  });

  it("accepts the legacy JSON envelope while an older server is still running", async () => {
    const result = {
      duplicate: false as const,
      recipe: {
        title: "Macaroni Salad",
        instructions: ["Mix ingredients."],
        ingredients: [],
        sourceUrl: "https://example.com/macaroni-salad/",
        sourceLabel: "example.com",
        origin: "imported" as const,
        linkedSubRecipes: [],
        tags: [],
      },
      flaggedIngredients: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(ingestRecipe("https://example.com/recipe")).resolves.toEqual(result);
  });
});
