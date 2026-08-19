import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { invalidateDataManagementQueries } from "./query-invalidation";

describe("invalidateDataManagementQueries", () => {
  it("invalidates affected content and dashboard families without clearing unrelated cache", async () => {
    const queryClient = new QueryClient();
    const affectedKeys = [
      ["preferences"],
      ["meals", "upcoming", 7],
      ["meal-types", "profiles"],
      ["meal-sub-types"],
      ["recipes", { query: "pasta" }],
      ["recipe", "recipe-1", "iterations"],
      ["grocery-lists"],
      ["grocery-list", "list-1"],
      ["prep-lists"],
      ["prep-list", "prep-1"],
      ["prep-generator-meals", "2026-08-19"],
      ["stats", "meal-summary"],
    ] as const;

    for (const queryKey of affectedKeys) {
      queryClient.setQueryData(queryKey, { cached: true });
    }
    queryClient.setQueryData(["connection-status"], { cached: true });

    await invalidateDataManagementQueries(queryClient);

    for (const queryKey of affectedKeys) {
      expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
    expect(
      queryClient.getQueryState(["connection-status"])?.isInvalidated
    ).toBe(false);
  });
});