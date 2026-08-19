import type { QueryClient } from "@tanstack/react-query";

const DATA_MANAGEMENT_QUERY_KEY_PREFIXES = [
  ["preferences"],
  ["meals"],
  ["meal-types"],
  ["meal-sub-types"],
  ["recipes"],
  ["recipe"],
  ["grocery-lists"],
  ["grocery-list"],
  ["prep-lists"],
  ["prep-list"],
  ["prep-generator-meals"],
  ["stats"],
] as const;

export async function invalidateDataManagementQueries(
  queryClient: QueryClient
): Promise<void> {
  await Promise.all(
    DATA_MANAGEMENT_QUERY_KEY_PREFIXES.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, exact: false })
    )
  );
}