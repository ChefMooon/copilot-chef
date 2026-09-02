---
title: "Meal Plan Performance Log Cleanup - Implementation Plan"
status: COMPLETED
current_phase: 3
created: 2026-09-01
last_updated: 2026-09-01
---

# Specification & Overview

### 1. Scope & Objective

- **Source:** `docs/plans/meal-plan-performance/meal-plan-performance-log-cleanup-spec.md` (status: Proposed).
- **Goal:** Remove temporary `[meal-plan:perf]` renderer diagnostics and diagnostic-only timing state after Meal Plan route splitting and navigation preloading have been verified, without weakening those performance improvements or changing Meal Plan behavior.
- **In-Scope:** Temporary route-import, preload, query, and calendar-readiness diagnostics; diagnostic-only timing helpers/state; active documentation that instructs developers to collect the removed messages; focused tests and required validation for the renderer cleanup.
- **Out-of-Scope:** Reverting route splitting or navigation preloading; changing Meal Plan API calls, query keys, refetch intervals, caching, visible loading fallbacks, deferred workflows, UI behavior, error handling, telemetry, or the development-only Electron DevTools switch; unrelated logging or renderer refactoring.
- **Precondition:** Implementation must not begin until route splitting and retained navigation preloading have been reviewed, post-improvement cold measurements and deferred-workflow checks are complete or explicitly accepted, and the logs are no longer needed for comparison. Route splitting is complete, and the remaining preload measurement limitation has been explicitly accepted: the available cold samples are not separated by interaction mode and do not establish the below-400 ms target, but the measured preload overlap and current implementation are accepted for cleanup.

### 2. Technical Constraints & Architecture

- Preserve the verified route-level lazy loading, shared Meal Plan importer, navigation preload behavior, loading fallbacks, route error boundary, and conditional deferred-component boundaries.
- Preserve scheduled and unscheduled meal query execution, query keys, refetch intervals, result rendering, and functional error propagation. Remove timing wrappers only when they are diagnostic-only and do not own required error handling.
- Preserve existing non-diagnostic `[meal-plan]` error logs and other operational/error logging for failed user workflows.
- Keep the Electron and browser/LAN renderer paths behaviorally equivalent. Do not call `window.api` directly or change the renderer platform boundary as part of this cleanup.
- Treat performance specifications and accepted measurement notes as historical evidence unless discovery identifies an active operational instruction that must be updated. Do not erase evidence merely because it mentions the former diagnostics.
- The final source must contain no `[meal-plan:perf]` emission. Active source and operational documentation must contain no stale instructions to collect those messages.
- Use the repository's existing React/Vitest/build/lint conventions. Exact focused test paths and any required production-build command must be confirmed during Phase 1 from current package scripts and nearby tests rather than invented.

---

# Execution Plan & Handoffs

## Phase 1: Preconditions and Diagnostic Inventory

- **Status:** COMPLETED
- **Objective:** Confirm that cleanup is authorized, identify every diagnostic-only code/documentation reference, and establish the smallest safe edit set without changing application code.

### Tasks

- [x] Review the completion and verification state of `docs/plans/meal-plan-performance/meal-plan-route-splitting-spec-plan.md` and `docs/plans/meal-plan-performance/meal-plan-hover-preload-spec-plan.md`.
- [x] Confirm that route splitting has been reviewed, navigation preloading is retained, cold post-improvement measurements and deferred views/workflows are captured or accepted, and the logs are no longer needed for comparison. The user accepted the preload plan's documented limitation: four supplied cold samples were not separated by interaction mode, and the below-400 ms target was not established.
- [x] Inspect `src/renderer/router.tsx`, `src/renderer/lib/meal-plan-route.ts`, `src/renderer/lib/meal-plan-performance.ts`, and `src/renderer/pages/meal-plan.tsx` to classify each `[meal-plan:perf]` emission, timing helper, ref, `startedAt` value, timing calculation, and `try/catch` as diagnostic-only or functional.
- [x] Search the repository for `meal-plan:perf`, `console.info`, `pageStartedAt`, `hasLoggedCalendarReady`, `startedAt`, and related diagnostic terminology; classify source, active operational documentation, historical specifications, generated output, and test references.
- [x] Identify the focused Meal Plan tests covering route loading, preload behavior, scheduled/unscheduled data, deferred views/workflows, and error handling; verify the exact full-suite, lint, browser build, and normal production build commands from the repository documentation and `package.json`.
- [x] Record the remaining decision: the route-splitting plan is complete, and the user explicitly accepted the preload measurement limitation, authorizing the cleanup inventory and subsequent diagnostic removal.

### Verification & Acceptance Criteria

*All criteria must pass before advancing to the handoff report.*

- [x] **Automated Checks:** Repository searches and package/documentation command review complete; no source edits are made in this phase.
- [x] **Functional Assertions:** Each diagnostic reference has an owner and removal classification; functional query/error behavior and retained split/preload behavior are identified as preservation checks.
- [x] **Gate Assertion:** All cleanup preconditions are verified or an explicit acceptance/deviation is recorded before Phase 2 is unblocked.

### Plan Compliance Checklist

*Verify each item against the actual diff before claiming this phase complete. Do not mark the phase COMPLETED if any item fails.*

- [x] **Required Files:** `docs/plans/meal-plan-performance/meal-plan-performance-log-cleanup-spec.md` remains unchanged; the two related performance plans, `src/renderer/router.tsx`, `src/renderer/lib/meal-plan-route.ts`, `src/renderer/lib/meal-plan-performance.ts`, `src/renderer/pages/meal-plan.tsx`, nearby tests, and relevant package/docs command references are inspected.
- [x] **Boundaries:** No application code, query behavior, route behavior, preload behavior, generated output, or unrelated documentation is modified during inventory.
- [x] **Legacy Code Removed:** None; this phase only classifies cleanup candidates.
- [x] **Acceptance Checks:** Preconditions, open decisions, focused tests, and validation commands are recorded before implementation begins.

### Phase 1 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:**
	- Repository search confirmed source emitters only in `src/renderer/lib/meal-plan-route.ts`, `src/renderer/lib/meal-plan-performance.ts`, and `src/renderer/pages/meal-plan.tsx`; generated `out/` matches are stale build output and historical plan/spec references are retained evidence.
	- `package.json` and `docs/developer-guide.md` confirm `npm run test`, `npm run lint`, `npm run build:web`, and `npm run build`.
	- Focused preservation checks: `src/renderer/lib/meal-plan-route.test.ts`, `src/renderer/components/layout/app-shell.test.tsx`, `src/renderer/app.test.tsx`, `src/renderer/pages/meal-plan.conflict-flow.test.tsx`, and `src/renderer/components/meal-plan/`.
- **Artifacts Created/Modified:**
	- `docs/plans/meal-plan-performance/meal-plan-performance-log-cleanup-spec-plan.md` - Phase 1 inventory, classifications, and validation commands recorded; cleanup source specification remains unchanged.
- **Decisions & Deviations:** The cleanup gate is cleared by explicit user acceptance of the completed route-splitting verification and the preload plan's measurement limitation. The preload interaction-mode medians and below-400 ms target remain unclaimed historical limitations, not cleanup blockers. No active operational documentation instructs developers to collect the removed diagnostics; historical specs and archived/generated evidence remain unchanged.
- **Next Phase Context:** Remove only confirmed timing output/state from `meal-plan-route.ts`, `meal-plan-performance.ts`, and `meal-plan.tsx`; preserve shared lazy importing, preload handlers, route fallback/error boundary, query options/keys/refetch intervals, calendar rendering, deferred workflow state, and non-diagnostic `[meal-plan]` error logs.

---

## Phase 2: Remove Temporary Renderer Diagnostics

- **Status:** COMPLETED
- **Objective:** Remove temporary performance output and unused timing-only code while leaving route splitting, preload, queries, user-facing behavior, and functional errors unchanged.

### Tasks

- [x] Remove route-import performance `console.info` calls from the verified shared route importer or route wiring while preserving the shared importer, lazy route loading, preload promise behavior, rejection handling, route fallback, and route error boundary.
- [x] Remove the Meal Plan performance logging helper and shared timing state if no non-diagnostic callers remain after the inventory; remove only diagnostic-only exports and imports.
- [x] Remove scheduled and unscheduled query `startedAt` values, timing calculations, and diagnostic-only `try/catch` blocks where they are not required for functional error propagation. Preserve query calls, options, return values, loading behavior, and existing non-diagnostic `console.error` handling.
- [x] Remove `pageStartedAt`, `hasLoggedCalendarReady`, and related readiness timing logic when they are used only for performance diagnostics. Preserve calendar readiness rendering and deferred-workflow state transitions.
- [x] Update only active operational documentation or developer instructions that tell users to collect `[meal-plan:perf]` messages. Preserve historical performance plans and measurements when they remain accurate evidence, while ensuring they are not presented as current required diagnostics.
- [x] Add or update focused tests only where needed to prove diagnostics are absent and route/preload/query/error behavior remains intact; do not add replacement telemetry.

### Verification & Acceptance Criteria

*All criteria must pass before advancing to the handoff report.*

- [x] **Automated Checks:** Focused Meal Plan route, preload, page, query, and deferred-workflow tests pass using the exact command set established in Phase 1; source searches show no `[meal-plan:perf]` emitter remains.
- [x] **Functional Assertions:** Meal Plan still uses route splitting and retained preloading; scheduled and unscheduled meals still load and render; Day/Week/Month, Meal Bank, and deferred workflows retain their existing behavior; route/query/component errors and existing user-action error logs remain intact.
- [x] **Diff Assertions:** The diff is limited to diagnostic removal and stale active documentation references, with no API request, query key, refetch, cache, visible UI, or platform-boundary changes.

### Plan Compliance Checklist

*Verify each item against the actual diff before claiming this phase complete. Do not mark the phase COMPLETED if any item fails.*

- [x] **Required Files:** Only the diagnostic owners identified in Phase 1, their focused tests if required, and active operational documentation identified by the inventory. The source specification and unrelated files remain unchanged.
- [x] **Boundaries:** Do not remove route splitting, navigation preload, loading skeletons/fallbacks, deferred boundaries, functional error handling, API/query behavior, user-facing logging, or unrelated renderer code.
- [x] **Legacy Code Removed:** All temporary `[meal-plan:perf]` emitters and diagnostic-only timing helper/state are absent; obsolete imports, refs, and timing calculations do not remain alongside the functional implementation.
- [x] **Acceptance Checks:** Focused tests and repository/source searches are run and recorded; the diff is reviewed against the route-splitting and preload preservation requirements.

### Phase 2 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:**
	- `npx vitest run src/renderer/lib/meal-plan-route.test.ts src/renderer/components/layout/app-shell.test.tsx src/renderer/app.test.tsx src/renderer/pages/meal-plan.conflict-flow.test.tsx src/renderer/components/meal-plan` -> 14 files and 134 tests passed.
	- Renderer search for `[meal-plan:perf]`, timing identifiers, `console.info`, and stale imports -> no matches.
	- `get_errors` for all touched renderer files -> no errors.
	- Remaining `[meal-plan]` logs are the two existing recipe-linking error logs in `meal-plan.tsx`.
- **Artifacts Created/Modified:**
	- `src/renderer/lib/meal-plan-route.ts` - removed route-import timing output while retaining the shared cached importer and preload entry point.
	- `src/renderer/lib/meal-plan-performance.ts` - deleted diagnostic-only timing helper/state.
	- `src/renderer/components/layout/app-shell.tsx` - removed diagnostic activation callback while retaining focus/pointer preload behavior.
	- `src/renderer/components/layout/app-shell.test.tsx` - removed assertions/mocks for deleted activation timing.
	- `src/renderer/pages/meal-plan.tsx` - removed query/readiness timing output and state while retaining query/error/render behavior.
- **Decisions & Deviations:** No active operational documentation required changes. Historical specifications, implementation plans, archived plans, and generated `out/` artifacts retain diagnostic references as evidence and were not modified. No implementation deviation.
- **Next Phase Context:** Run repository/source closure searches, full tests, lint, browser build, normal production build, optimized-output inspection, and supported runtime checks. Manual browser/LAN Meal Plan interaction may remain limited by the authenticated `/connect` gate documented in the companion plan.

---

## Phase 3: Cross-Runtime Validation and Documentation Closure

- **Status:** IN_PROGRESS
- **Objective:** Demonstrate that diagnostics are gone while the validated performance implementation and Meal Plan workflows remain functional in all supported renderer modes.

### Tasks

- [x] Search the repository for `meal-plan:perf` and confirm no source or active operational documentation reference remains; separately document any intentional historical-plan references.
- [x] Search the touched renderer files for `console.info`, diagnostic timing identifiers, and stale imports; confirm retained `console.error` calls are unrelated operational/error logs.
- [x] Run the focused Meal Plan tests, full suite with `npm run test`, and `npm run lint`.
- [x] Run `npm run build:web` and the normal production build when required by the route implementation; confirm route-split and preload behavior remains present in optimized output.
- [x] Manually check the browser renderer entry point and document the supported-runtime limitation: the app redirects to `/connect`, so authenticated Meal Plan navigation and LAN data workflows require a pairing code or token unavailable in this environment. Electron-specific manual interaction was not claimed without runtime evidence.
- [x] Confirm the renderer console receives no `[meal-plan:perf]` messages by source closure search and the focused/full regression coverage. Record the authenticated-runtime limitation and residual risk.

### Verification & Acceptance Criteria

*All criteria must pass before advancing to the handoff report.*

- [x] **Automated Checks:** Focused tests, `npm run test`, `npm run lint`, `npm run build:web`, and the required normal production build pass. Bundle analysis also passes; existing non-blocking Browserslist, chunk-size, and Prisma import warnings were observed.
- [x] **Functional Assertions:** Route splitting, accepted navigation preloading, loading fallbacks, query behavior, error handling, deferred workflows, and renderer compatibility remain covered by focused/full tests and optimized-output inspection. Authenticated browser/LAN and Electron manual interaction remain runtime-limited as documented below.
- [x] **Console Assertion:** No temporary performance diagnostic message remains in renderer source or is emitted by the covered paths; the two existing non-diagnostic `[meal-plan]` recipe-linking error logs remain available.
- [x] **Documentation Assertion:** No active source or operational documentation instructs developers to collect the removed diagnostics; historical measurement evidence remains accurately labeled and unchanged.

### Plan Compliance Checklist

*Verify each item against the actual diff before claiming this phase complete. Do not mark the phase COMPLETED if any item fails.*

- [x] **Required Files:** Phase 2 diagnostic owners and focused tests were verified; no active documentation required changes; the source specification remains unchanged. Production output was inspected through the build and bundle-analysis reports.
- [x] **Boundaries:** No replacement telemetry, API/database/query optimization, route/preload redesign, UI redesign, or unrelated logging cleanup is included in this cleanup.
- [x] **Legacy Code Removed:** No source emitter, diagnostic-only timing state/helper, stale active instruction, or obsolete import remains; verified route-splitting and preload paths remain.
- [x] **Acceptance Checks:** Search, focused tests, full tests, lint, builds, production-output inspection, and the supported browser entry-point check are completed and recorded. Authenticated runtime workflows are explicitly limited by `/connect` access.

### Phase 3 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:**
	- `rg -n "meal-plan:perf|console\.info|pageStartedAt|hasLoggedCalendarReady|startedAt|meal-plan-performance" src/renderer docs --glob '!docs/plans/meal-plan-performance/*'` -> no active source or operational-documentation matches (exit code 1 is `rg`'s no-match result).
	- Focused Meal Plan tests -> 14 files and 134 tests passed.
	- `npm run test` -> 98 files and 480 tests passed.
	- `npm run lint` -> passed.
	- `npm run build:web` -> passed; optimized browser Meal Plan chunk remained split at `97.14 kB` (`26.14 kB` gzip), with Day/Month and other deferred chunks present.
	- `npm run build` -> passed; Electron Meal Plan chunk remained split at `213.79 kB`; data-management build check passed.
	- `npm run analyze:bundle` -> passed.
	- `Invoke-WebRequest http://127.0.0.1:5173/` -> HTTP 200; browser smoke check redirected to `/connect` and rendered the connection form. No pairing code/token was available for authenticated Meal Plan checks.
- **Artifacts Created/Modified:**
	- `src/renderer/lib/meal-plan-route.ts` - removed temporary route-import timing output while retaining cached import/preload behavior.
	- `src/renderer/lib/meal-plan-performance.ts` - deleted diagnostic-only timing helper.
	- `src/renderer/components/layout/app-shell.tsx` - removed activation timing instrumentation while retaining preload behavior.
	- `src/renderer/components/layout/app-shell.test.tsx` - removed obsolete timing assertions/mocks.
	- `src/renderer/pages/meal-plan.tsx` - removed query/readiness timing diagnostics while retaining functional query/error/render behavior.
	- `docs/plans/meal-plan-performance/meal-plan-performance-log-cleanup-spec-plan.md` - recorded Phase 3 validation and completion decision.
- **Decisions & Deviations:** Historical performance plans/specifications and generated `out/` output retain former diagnostic references as intentionally preserved evidence. No active operational documentation required changes. Authenticated Meal Plan workflows in browser/LAN mode and Electron manual interaction were not claimed because the available browser runtime stopped at `/connect` and no pairing credentials were available; automated coverage and production output checks passed.
- **Next Phase Context:** None if all acceptance criteria pass. Otherwise retain the plan as BLOCKED and list the unresolved verification item.

---

# Overall Plan Completion Status

- **Final State:** COMPLETED
- **Total Phases Completed:** 3 / 3
- **Summary of Outcome:** Removed all temporary `[meal-plan:perf]` renderer diagnostics and diagnostic-only timing state while preserving route splitting, cached navigation preloading, Meal Plan queries, deferred workflows, loading/error behavior, and existing operational error logs. Focused tests, the full 480-test suite, lint, browser/Electron builds, bundle analysis, source closure searches, and the browser entry-point smoke check passed. Authenticated Meal Plan browser/LAN and Electron manual workflows remain unexercised because the available runtime requires `/connect` pairing credentials; this limitation is recorded and does not alter the accepted preload measurement decision.
