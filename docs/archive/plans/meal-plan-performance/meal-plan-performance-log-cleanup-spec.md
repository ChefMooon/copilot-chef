# Meal Plan Performance Log Cleanup Specification

## Status

Proposed. Run only after Meal Plan route splitting and navigation preloading have been implemented and verified.

## Purpose

Remove temporary renderer performance diagnostics that were added to investigate the first-load delay on the Meal Plan page. The cleanup must remove the diagnostic output without reverting or weakening the performance improvements that were validated using those logs.

## Problem Statement

The renderer currently emits `[meal-plan:perf]` console messages for route import timing, scheduled meal requests, unscheduled meal requests, and calendar readiness. These messages are useful during investigation but should not remain as unconditional console output after the performance work is complete because:

- Query timing logs can repeat whenever the Meal Plan queries refetch.
- Routine performance output makes the renderer console noisy.
- Production users should not receive internal diagnostic messages by default.
- The temporary instrumentation is not an application feature or user-facing observability contract.

## Preconditions

Do not execute this cleanup until all of the following are true:

- [ ] Route splitting has been implemented and reviewed.
- [ ] Navigation preloading has been implemented and reviewed, if retained as part of the performance work.
- [ ] Cold first-navigation measurements have been captured after the improvements.
- [ ] The improved route import and calendar-ready timings meet the agreed success threshold, or the remaining tradeoff has been explicitly accepted.
- [ ] Deferred views and workflows have been verified on first use.
- [ ] The final implementation no longer needs the temporary logs for comparison.

## Goals

- Remove all temporary `[meal-plan:perf]` console messages.
- Remove diagnostic-only timing state and helpers that become unused.
- Preserve route splitting, preloading, loading fallbacks, query behavior, and user-facing functionality.
- Preserve unrelated operational and error logs, including existing `[meal-plan]` error messages.
- Leave the repository without stale documentation that instructs developers to collect the removed log messages.

## Non-Goals

- Reverting route splitting or navigation preloading.
- Changing Meal Plan API calls, query keys, refetch intervals, or caching behavior.
- Removing the route loading skeleton or deferred-component fallbacks.
- Removing existing error logging that is useful for diagnosing failed user actions.
- Introducing a replacement telemetry system.
- Changing the development-only Electron DevTools switch unless it is separately determined to be temporary.

## Affected Surfaces

- [src/renderer/router.tsx](../../../src/renderer/router.tsx): route import timing messages around the Meal Plan lazy import.
- [src/renderer/pages/meal-plan.tsx](../../../src/renderer/pages/meal-plan.tsx): performance helper, query timing messages, and calendar readiness timing state.
- [docs/plans/meal-plan-performance/](.): performance specifications and any later measurement notes that reference the temporary logs.

## Functional Requirements

1. No source file in `src/renderer/` may emit a `[meal-plan:perf]` message after cleanup.
2. The Meal Plan route must still load through the verified route-splitting implementation.
3. Navigation preloading must continue to use the verified implementation, if it was accepted.
4. Scheduled and unscheduled meal queries must continue to execute and render their data as before.
5. Existing route, query, and component error handling must remain intact.
6. Existing non-diagnostic Meal Plan error logs must remain unless separately documented as temporary.
7. Removing the logs must not add a new network request, alter query timing behavior, or change visible UI behavior.
8. The cleanup must work in Electron and browser/LAN renderer builds.

## Cleanup Requirements

- Remove the route import `console.info` calls added solely for `[meal-plan:perf]` timing.
- Remove the Meal Plan performance logging helper if it has no remaining callers.
- Remove query `startedAt` values, timing calculations, and diagnostic-only `try/catch` blocks if they are no longer needed for functional error propagation.
- Remove `pageStartedAt` and `hasLoggedCalendarReady` state if they are only used by the readiness diagnostic.
- Remove or update documentation that tells developers to look for `[meal-plan:perf]` messages.
- Do not remove existing `console.error` calls for failed user workflows unless they are explicitly identified as part of this cleanup.

## Validation Plan

1. Search the repository for `meal-plan:perf` and confirm there are no remaining source or active documentation references.
2. Search the touched renderer files for `console.info` and confirm no diagnostic-only messages remain.
3. Run the focused Meal Plan tests.
4. Run the full test suite with `npm run test`.
5. Run `npm run lint`.
6. Run `npm run build:web` and the normal production build if the route implementation changed since the previous verification.
7. Confirm the production build still contains the route-split and preload behavior.
8. Manually navigate to Meal Plan in Electron and browser/LAN mode where supported.
9. Confirm the Meal Plan page, Day/Week/Month views, Meal Bank, and deferred workflows remain functional.
10. Confirm the renderer console no longer receives `[meal-plan:perf]` messages during initial navigation or query refetch.

## Acceptance Criteria

- [ ] No `[meal-plan:perf]` references remain in active source or operational documentation.
- [ ] Diagnostic-only timing helpers and state have been removed.
- [ ] Route splitting and navigation preloading remain present and functional.
- [ ] Meal Plan data loading and refetch behavior are unchanged.
- [ ] Existing user-action error logging remains intact.
- [ ] Focused tests pass.
- [ ] Full tests pass.
- [ ] Lint passes.
- [ ] Required production builds pass.
- [ ] Manual verification confirms no performance diagnostic messages are emitted.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Cleanup accidentally removes functional error handling | Review each removed `try/catch` and preserve error propagation and existing user-facing errors. |
| Performance improvements are reverted with the diagnostics | Compare the diff against the route-splitting and preload specifications before merging cleanup. |
| Documentation continues to reference removed logs | Run a repository-wide search for `[meal-plan:perf]`. |
| A future regression becomes harder to diagnose | Keep the performance specifications and before/after measurements as historical engineering evidence; add new diagnostics only when a new investigation requires them. |
| Browser and Electron builds diverge | Run both relevant renderer build paths and manually verify supported runtime modes. |

## Handoff Notes

This is a cleanup task, not a performance implementation task. It should be executed after the implementation and verification work described in:

- [meal-plan-route-splitting-spec.md](meal-plan-route-splitting-spec.md)
- [meal-plan-hover-preload-spec.md](meal-plan-hover-preload-spec.md)

The cleanup should be a small, reviewable change limited to temporary diagnostics and references to them. Do not use this specification as justification for unrelated logging or renderer refactoring.
