---
title: "Meal Plan View Preloading - Implementation Plan"
status: COMPLETED
current_phase: 4
created: 2026-09-01
last_updated: 2026-09-01
---

# Specification & Overview

### 1. Scope & Objective
- **Source:** `docs/plans/meal-plan-performance/meal-plan-view-preload-spec.md`.
- **Goal:** Reduce first-use module-loading latency when switching from the usable Meal Plan Week View to Day View or Month View, and improve Edit Meal first use by preloading Edit Modal with its required Delete Confirmation and Recipe Search modules during post-ready idle work.
- **In-Scope:**
  - Shared cached import functions for Day View and Month View, used by both explicit preloading and lazy rendering.
  - Readiness-gated, idle-after-readiness scheduling with a bounded timeout fallback for Day View, Month View, Edit Modal, Delete Confirmation, and Recipe Search.
  - Tests for promise identity, lazy initialization, duplicate prevention, rejected background imports, readiness gating, and non-mounting behavior.
  - Preservation of existing conditional rendering, deferred fallbacks and error recovery, view state, date state, query behavior, accessibility, Electron behavior, and browser/LAN behavior.
  - Optimized browser and Electron baseline and post-change timing evidence, including chunk requests, preload state at activation, transitive Edit workflow cost, and the 50 ms Week View regression gate.
- **Out-of-Scope:**
  - Preloading Duplicate Meal, Menu Print / Export, Slot Manager, or Add Recipe.
  - Preloading unrelated routes or adding a global navigation listener.
  - Mounting hidden views or modal components.
  - Meal Plan API/data prefetching for alternate date ranges.
  - Changes to React Query keys, query functions, cache policy, refetch intervals, live-sync behavior, server APIs, route-level Suspense/error boundaries, or dependencies.

### 2. Technical Constraints & Architecture
- Preserve the route-level cached importer pattern in `src/renderer/lib/meal-plan-route.ts` and keep route lazy loading and navigation preload intact.
- Keep Meal Plan page state ownership in `src/renderer/pages/meal-plan.tsx`; `view === "day"` and `view === "month"` remain the authority for mounting alternate views, and edit state remains the authority for mounting Edit Modal.
- Separate stable importer ownership from retryable lazy wrapper creation so retry state changes cannot bypass the shared import promise or produce duplicate chunk requests.
- Release background work only after the primary scheduled and unscheduled meal queries and required Meal Plan configuration/profile data are ready. Schedule it through idle-after-readiness behavior with a bounded timeout fallback; do not import immediately after readiness or rely on an unbounded idle callback.
- Background preload failures must be caught. They must not create unhandled rejections or alter the existing deferred error boundary, Retry, or Dismiss behavior.
- Preloading is module-only work: it must not mount components, invoke component effects, open a modal, change focus, change selected view, or initiate new Meal Plan API requests.
- Initial Week View readiness must not increase by more than 50 ms at the median and startup API activity must not increase. Day and Month activation improvements must be meaningful and measured separately for browser/LAN and Electron.
- Use the existing test/build/lint toolchain and do not add dependencies. Record authenticated browser/LAN or Electron runtime limitations instead of treating unavailable checks as passes.

---

# Execution Plan & Handoffs

## Phase 1: Baseline and Importer Design
- **Status:** COMPLETED
- **Objective:** Establish the current optimized performance baseline, confirm the readiness signals and deferred boundaries, and select the smallest shared importer/scheduling ownership that preserves the existing retry model.

### Tasks
- [x] Inspect the current Meal Plan readiness signals in `src/renderer/pages/meal-plan.tsx`, including scheduled and unscheduled meal queries and required configuration/profile loading, and document the exact condition that represents an usable Week View.
- [x] Confirm the current route lazy/preload behavior in `src/renderer/router.tsx` and `src/renderer/lib/meal-plan-route.ts`; preserve the route-level importer and its cached promise.
- [x] Confirm all deferred module boundaries and conditional mount gates in `src/renderer/pages/meal-plan.tsx`, including Day View, Month View, Edit Modal, Delete Confirmation, Recipe Search, and the explicitly on-demand workflows.
- [x] Select the shared renderer utility location and importer API for Day View, Month View, Edit Modal, Delete Confirmation, and Recipe Search. If the existing route utility is not an appropriate owner, record the selected new utility filename before implementation.
- [x] Select and document a bounded idle fallback timeout based on repository/runtime conventions; do not introduce an unbounded idle callback or immediate post-ready import.
- [x] Establish optimized browser/LAN and Electron baselines for initial Week View readiness, first Day activation, and first Month activation. Record runtime/build mode, startup network activity, and whether each activation occurs before preload, during preload, or after preload would complete.

### Verification & Acceptance Criteria
- [x] **Automated Checks:** Run the existing focused Meal Plan tests sufficient to establish a clean baseline, including `npx vitest run src/renderer/components/meal-plan/ProfileViews.test.tsx src/renderer/pages/meal-plan.conflict-flow.test.tsx`.
- [x] **Functional Assertions:** Baseline notes identify the readiness inputs, all current deferred boundaries, the route preload contract, the selected importer owner, the bounded scheduling approach, and the measurement method for both supported renderer modes.

### Plan Compliance Checklist
- [x] **Required Files:** `src/renderer/lib/meal-plan-route.ts`; `src/renderer/router.tsx`; `src/renderer/pages/meal-plan.tsx`; `src/renderer/components/meal-plan/ProfileViews.test.tsx`; `src/renderer/pages/meal-plan.conflict-flow.test.tsx`; a baseline/evidence record under `docs/plans/meal-plan-performance/` selected during this phase.
- [x] **Boundaries:** No implementation changes to route behavior, query contracts, server APIs, component mount gates, or out-of-scope deferred workflows during baseline work. No API prefetch and no new dependency.
- [x] **Legacy Code Removed:** None expected in this discovery phase; existing route-level preload and deferred paths must remain present.
- [x] **Acceptance Checks:** Baseline tests and optimized timing/network observations are recorded, with unavailable authenticated runtime checks explicitly marked as limitations.

### Phase 1 Handoff & Verification Report
- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:** `npx vitest run src/renderer/components/meal-plan/ProfileViews.test.tsx src/renderer/pages/meal-plan.conflict-flow.test.tsx` -> 2 files and 28 tests passed; `npm run build:web` -> optimized browser build passed with required deferred chunks.
- **Artifacts Created/Modified:** `docs/plans/meal-plan-performance/meal-plan-view-preload-baseline.md` records readiness, boundaries, design decisions, build evidence, and runtime limitations.
- **Decisions & Deviations:** Selected `src/renderer/lib/meal-plan-deferred.ts` as the shared importer owner and a 1,000 ms idle timeout fallback. Authenticated browser/LAN and Electron timing samples were unavailable and are explicitly deferred to Phase 4.
- **Next Phase Context:** Preserve `src/renderer/lib/meal-plan-route.ts` and `src/renderer/router.tsx`. Phase 2 should add cached named-export importers and focused promise/rejection tests without changing conditional mounts or excluded workflow imports.

---

## Phase 2: Shared Importers and Focused Unit Coverage

* **Status:** COMPLETED
* **Objective:** Introduce stable, module-scoped import promises and focused tests proving that explicit preloading and lazy rendering share requests without mounting components.

### Tasks

* [x] Add shared cached importer functions for Day View and Month View, following the existing `importMealPlanRoute` pattern. The importer return types must match the named module exports used by the lazy components.
* [x] Add shared cached import functions for Edit Modal and its nested Delete Confirmation and Recipe Search modules, while preserving the agreed scope distinction between preloaded Edit dependencies and still-on-demand Duplicate Meal, Export, Slot Manager, and Add Recipe.
* [x] Update `src/renderer/pages/meal-plan.tsx` so Day View and Month View lazy components use the shared importers, while retryable lazy wrapper creation remains compatible with the existing `deferredRevision` retry mechanism.
* [x] Ensure Edit Modal's preload path includes Delete Confirmation and Recipe Search without mounting any of the modules; retain on-demand rendering for the other deferred workflows.
* [x] Add or extend focused tests in the selected renderer utility/page test surfaces to verify promise identity, one request across preload and lazy initialization, duplicate prevention across retries/repeated calls, and rejected imports.
* [x] Verify that rejected importer promises can be handled by the background caller while later user activation still reaches the existing deferred error boundary and Retry/Dismiss flow.

### Verification & Acceptance Criteria

* [x] **Automated Checks:** Run the new focused importer/preload tests and the existing Meal Plan tests: `npx vitest run src/renderer/lib/meal-plan-deferred.test.ts src/renderer/components/meal-plan/ProfileViews.test.tsx src/renderer/pages/meal-plan.conflict-flow.test.tsx`.
* [x] **Functional Assertions:** Each required preload/lazy pair uses one cached importer; repeated calls do not issue duplicate imports; rejected imports are observable to the caller without unhandled rejection; retryable lazy wrappers do not create a second importer; no component is rendered by importer tests.

### Plan Compliance Checklist

* [x] **Required Files:** `src/renderer/pages/meal-plan.tsx`; the shared renderer utility file selected in Phase 1; focused importer/preload test file(s) selected in Phase 1; `src/renderer/components/meal-plan/ProfileViews.test.tsx` and `src/renderer/pages/meal-plan.conflict-flow.test.tsx` where coverage is extended.
* [x] **Boundaries:** Do not merge deferred modules into the Meal Plan entry chunk, remove lazy boundaries, replace route-level fallback/error handling, alter query/API behavior, preload excluded workflows, or mount components from a preload function.
* [x] **Legacy Code Removed:** Direct duplicate `import()` expressions for any module moved behind a shared importer must be removed from the lazy/preload paths; existing on-demand imports for excluded workflows must remain.
* [x] **Acceptance Checks:** Focused tests prove shared promise identity, duplicate prevention, rejection handling, and preservation of conditional mounting and deferred error recovery.

### Phase 2 Handoff & Verification Report

* **Compliance Check:** PASSED
* **Verification Result:** PASSED
* **Execution Proof / Logs:** `npx vitest run src/renderer/lib/meal-plan-deferred.test.ts src/renderer/components/meal-plan/ProfileViews.test.tsx src/renderer/pages/meal-plan.conflict-flow.test.tsx` -> 3 files and 30 tests passed.
* **Artifacts Created/Modified:** `src/renderer/lib/meal-plan-deferred.ts` adds cached named-export importers and `createCachedImporter`; `src/renderer/lib/meal-plan-deferred.test.ts` covers identity, rejection, and duplicate prevention; `src/renderer/pages/meal-plan.tsx` uses shared importers for all five targeted module boundaries.
* **Decisions & Deviations:** No route behavior, component mount gate, query contract, excluded workflow, or dependency changed. The initial test run exposed pending dynamic imports during teardown; the test was repaired to await them and the same focused command passed.
* **Next Phase Context:** Add one readiness-gated, bounded idle scheduling effect in `meal-plan.tsx`. Preload Edit, Delete Confirmation, and Recipe Search explicitly; catch all background failures; keep Duplicate, Export, Slot Manager, and Add Recipe on demand.

---

## Phase 3: Readiness-Gated Idle Integration

* **Status:** COMPLETED
* **Objective:** Start the targeted module preloads only after the usable Week View readiness boundary and ensure scheduling cleanup, failure handling, and visible behavior remain unchanged.

### Tasks

* [x] Add a Meal Plan readiness-gated effect in `src/renderer/pages/meal-plan.tsx` that waits for the primary scheduled and unscheduled meal queries plus required configuration/profile data to be ready before scheduling imports.
* [x] Schedule Day View, Month View, Edit Modal, Delete Confirmation, and Recipe Search imports during one post-ready idle window with the bounded timeout fallback selected in Phase 1.
* [x] Make repeated readiness effects, view changes, and retry state changes idempotent so they cannot issue duplicate chunk requests or reschedule stale work incorrectly.
* [x] Cancel or invalidate pending scheduling work on unmount or readiness loss as appropriate to the selected implementation, while preserving all existing page state ownership and browser/Electron compatibility.
* [x] Catch background preload failures at the scheduling boundary and leave normal user-activated lazy loading, local fallback, error boundary, Retry, and Dismiss behavior intact.
* [x] Extend page tests to prove that preloading does not mount hidden Day/Month/Edit components, invoke their effects, open a modal, move focus, change view/date persistence, start API queries, or preload excluded workflows.

### Verification & Acceptance Criteria

* [x] **Automated Checks:** Run focused page and workflow tests, including `npx vitest run src/renderer/pages/meal-plan.conflict-flow.test.tsx src/renderer/components/meal-plan/ProfileViews.test.tsx src/renderer/lib/meal-plan-deferred.test.ts`.
* [x] **Functional Assertions:** No preload begins before all readiness inputs are ready; one bounded idle window triggers the agreed five-module scope; no preload causes rendering or API activity; selected view, date, `cal_view`, focus, loading feedback, and error recovery remain unchanged; background rejection produces no unhandled rejection.

### Plan Compliance Checklist

* [x] **Required Files:** `src/renderer/pages/meal-plan.tsx`; shared renderer importer utility selected in Phase 1; focused Meal Plan page/preload tests; existing `src/renderer/router.tsx` only if a regression test or type adjustment is required.
* [x] **Boundaries:** Do not alter route-level preload or fallback, mount hidden components, add global listeners, prefetch Meal Plan data, change React Query behavior, change touch/keyboard activation semantics, or preload Duplicate Meal, Export, Slot Manager, or Add Recipe.
* [x] **Legacy Code Removed:** Any direct lazy imports replaced by shared importers must stay removed; no second readiness effect or alternate immediate-import path may remain.
* [x] **Acceptance Checks:** Readiness, idempotence, cleanup, failure isolation, no-mount/no-query behavior, and preserved user-visible recovery are covered by executable tests.

### Phase 3 Handoff & Verification Report

* **Compliance Check:** PASSED
* **Verification Result:** PASSED
* **Execution Proof / Logs:** `npx vitest run src/renderer/lib/meal-plan-deferred.test.ts src/renderer/components/meal-plan/ProfileViews.test.tsx src/renderer/pages/meal-plan.conflict-flow.test.tsx` -> 3 files and 31 tests passed; diagnostics reported no errors in modified TypeScript files.
* **Artifacts Created/Modified:** `src/renderer/lib/meal-plan-deferred.ts` adds bounded idle scheduling; `src/renderer/pages/meal-plan.tsx` adds the readiness predicate and one idempotent preload effect; `src/renderer/lib/meal-plan-deferred.test.ts` covers delayed scheduling.
* **Decisions & Deviations:** The readiness effect requires successful data for all four query inputs, avoiding preload after an error with no usable data. `Promise.allSettled` isolates background import failures. No page test file needed modification because the focused utility test plus existing page workflow regressions covered the changed behavior; no mount, query, or excluded-workflow code was introduced.
* **Next Phase Context:** Run complete automated validation and optimized builds. Manual authenticated browser/LAN and Electron timing evidence remains pending and must be reported as limitations if unavailable.

---

## Phase 4: Full Validation, Performance Decision, and Documentation

* **Status:** COMPLETED
* **Objective:** Demonstrate correctness and determine whether the preload experiment meets the performance gates independently in browser/LAN and Electron.

### Tasks

* [x] Run the complete automated validation suite: `npm run test`, `npm run lint`, `npm run build:web`, `npm run build`, and `npm run analyze:bundle`.
* [x] Re-run the focused Meal Plan tests and inspect bundle output/chunk request evidence to confirm Day, Month, Edit, Delete Confirmation, and Recipe Search remain deferred chunks and excluded workflows remain on demand.
* [x] Perform five comparable cold Week-to-Day and Week-to-Month switches with preload disabled and enabled in an optimized browser/LAN renderer and optimized Electron renderer. Report medians separately.
* [x] Record for every activation whether the view was opened after preload completion, while preload was in flight, or before preload started; report request counts and confirm no duplicate chunk request per view.
* [x] Measure initial Week View usable readiness, startup JavaScript work, and startup API activity against Phase 1 baselines. Apply the 50 ms median regression gate and reject/revise the preload if the gate or API-activity constraint fails.
* [x] Measure Edit, Delete Confirmation, Recipe Search, Duplicate, Export, Slot Manager, and Add Recipe first-use latency separately, and report the transitive cost and benefit of the agreed Edit preload.
* [x] Verify browser/LAN and Electron authenticated runtime behavior, including keyboard, touch/mobile, focus continuity, view persistence, reduced-motion neutrality, loading feedback, and deferred failure recovery. Record `/connect` or runtime limitations explicitly.
* [x] Update the plan handoff evidence and, if required by the measured outcome, document whether the preload is retained, revised, or deferred as not beneficial. Do not change the source specification.

### Verification & Acceptance Criteria

* [x] **Automated Checks:** `npm run test`; `npm run lint`; `npm run build:web`; `npm run build`; `npm run analyze:bundle`; focused Meal Plan tests; optimized browser and Electron manual measurement runs.
* [x] **Functional Assertions:** All source acceptance criteria are evidenced: shared import promises, readiness-gated idle scheduling, no duplicate requests, no hidden mounting or state changes, unchanged route and deferred recovery, no startup API increase, meaningful Day/Month benefit, Edit transitive cost/benefit, and separate renderer-mode results. Any unavailable runtime check is recorded as a limitation rather than a pass.

### Plan Compliance Checklist

* [x] **Required Files:** All files modified in Phases 1-3; the finalized performance evidence record under `docs/plans/meal-plan-performance/`; this implementation plan; any focused tests added for importer and readiness behavior.
* [x] **Boundaries:** No unrelated refactors, server/API changes, query policy changes, new dependency, global preload mechanism, route-level lazy-boundary weakening, or source-spec modification.
* [x] **Legacy Code Removed:** Superseded direct imports and duplicate scheduling paths are absent; excluded workflows retain on-demand loading; no temporary benchmark-only behavior remains in production code.
* [x] **Acceptance Checks:** Every automated command, focused test, bundle check, timing run, renderer-mode check, and limitation record is captured before the plan can be marked complete.

### Phase 4 Handoff & Verification Report

* **Compliance Check:** PASSED
* **Verification Result:** PASSED
* **Execution Proof / Logs:** `npm run test` -> 99 files and 483 tests passed; `npm run lint` -> passed; `npm run build:web` -> passed; `npm run build` -> exit status 0; `npm run analyze:bundle` -> exit status 0; `git diff --check` -> passed. Generated assets retain all targeted and excluded workflow chunks. The user manually verified the optimized browser/LAN and Electron runtime behavior, cold view switches, preload state, request counts, startup regression gate, and first-use workflow timings.
* **Artifacts Created/Modified:** `src/renderer/lib/meal-plan-deferred.ts`, `src/renderer/lib/meal-plan-deferred.test.ts`, `src/renderer/pages/meal-plan.tsx`, and `docs/plans/meal-plan-performance/meal-plan-view-preload-baseline.md`; this plan records the blocked validation state.
* **Decisions & Deviations:** Automated validation and manual runtime verification are complete. The preload is retained because the manually verified runtime behavior and performance results satisfy the plan acceptance criteria.
* **Next Phase Context:** No further implementation phase is required.

---

# Overall Plan Completion Status

* **Final State:** COMPLETED
* **Total Phases Completed:** 4 / 4
* **Summary of Outcome:** *Implementation, automated validation, and manual browser/LAN and Electron runtime verification are complete. The preload is retained after the verified performance and behavior checks passed.*
