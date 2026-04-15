import { describe, expect, it } from "vitest";

import { chatRequestSchema } from "./chat";

describe("chatRequestSchema", () => {
  it("accepts recipes page context payloads", () => {
    const parsed = chatRequestSchema.parse({
      message: "Tell me about this recipe",
      pageContextData: {
        page: "recipes",
        search: "taco",
        origin: "imported",
        totalRecipes: 12,
        filteredRecipes: 2,
        visibleRecipes: [
          {
            id: "recipe-1",
            title: "Easy Taco Salad",
            origin: "imported",
          },
        ],
      },
    });

    expect(parsed.responseMode).toBe("auto");
    expect(parsed.pageContextData).toEqual({
      page: "recipes",
      search: "taco",
      origin: "imported",
      totalRecipes: 12,
      filteredRecipes: 2,
      visibleRecipes: [
        {
          id: "recipe-1",
          title: "Easy Taco Salad",
          origin: "imported",
        },
      ],
    });
  });

  it("rejects unsupported page context discriminators", () => {
    const result = chatRequestSchema.safeParse({
      message: "hello",
      pageContextData: {
        page: "calendar",
      },
    });

    expect(result.success).toBe(false);
  });
});