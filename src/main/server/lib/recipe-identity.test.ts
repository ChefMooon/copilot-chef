import { describe, expect, it } from "vitest";

import {
  cleanRecipeSourceUrl,
  normalizeRecipeSourceUrl,
} from "./recipe-identity";

describe("recipe source URL identity", () => {
  it("keeps a cleaned display URL while removing tracking parameters", () => {
    expect(
      cleanRecipeSourceUrl(
        " https://www.example.com/recipe/?utm_source=newsletter&servings=6#top "
      )
    ).toBe("https://www.example.com/recipe/?servings=6");
  });

  it("normalizes equivalent host, fragment, and trailing-slash variants", () => {
    expect(
      normalizeRecipeSourceUrl(
        "https://www.Example.com/recipe/?utm_medium=email#instructions"
      )
    ).toBe("https://example.com/recipe");
  });

  it("preserves unknown query parameters and path case", () => {
    expect(
      normalizeRecipeSourceUrl(
        "example.com/Recipe?servings=6&variant=family&utm_campaign=summer"
      )
    ).toBe("https://example.com/Recipe?servings=6&variant=family");
  });

  it("removes the approved non-utm analytics parameters case-insensitively", () => {
    expect(
      normalizeRecipeSourceUrl(
        "https://example.com/recipe?FBCLID=abc&gclid=def&mc_cid=ghi&keep=yes"
      )
    ).toBe("https://example.com/recipe?keep=yes");
  });

  it("returns null for an empty source URL", () => {
    expect(normalizeRecipeSourceUrl("  ")).toBeNull();
    expect(cleanRecipeSourceUrl(null)).toBeNull();
  });
});
