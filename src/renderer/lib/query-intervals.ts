/**
 * Conservative default refetch interval (ms) for list-level queries.
 *
 * This is the Phase 1 staleness safety net for multi-client use: an idle client
 * picks up another client's committed writes within one interval. Detail views
 * rely on focus-refetch instead to limit request volume.
 */
export const LIST_REFETCH_INTERVAL_MS = 20_000;
