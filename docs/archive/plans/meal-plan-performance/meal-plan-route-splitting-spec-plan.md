---
title: "Meal Plan Route Splitting - Implementation Plan"
status: BLOCKED
current_phase: 4
created: 2026-09-01
last_updated: 2026-09-01
---

# Specification & Overview

### 1. Scope & Objective

- **Source:** `docs/plans/meal-plan-performance/meal-plan-route-splitting-spec.md` (status: Proposed).
- **Goal:** Reduce the JavaScript and initialization work required before the default weekly Meal Plan calendar is usable by moving interaction-only and non-default Meal Plan modules behind on-demand boundaries, while preserving existing behavior, route errors, loading stability, and Electron/browser compatibility.
- **In-Scope:** The Meal Plan route entry and its route-owned imports; the default Week View path and always-visible controls; candidate lazy boundaries for Day View, Month View, edit, duplicate, export, slot management, recipe search, save-as-recipe, and related modal content; local loading and recoverable error states; focused tests; production bundle and renderer timing measurements.
- **Out-of-Scope:** Meal Plan UI redesign; meal API, query-key, database, or SQLite changes; removal of Day View, Month View, Meal Bank, recipe, export, editing, or drag/drop functionality; unrelated routes or shared application optimization; navigation-hover preload, unless a separate approved change is later taken up.
- **Source-supported baseline:** The route import was observed at approximately 957 ms, scheduled and unscheduled meal requests at approximately 83 ms and 81 ms, and calendar readiness after initialization at approximately 196 ms. The current browser build was observed at approximately 164 kB minified JavaScript and 79 kB CSS for the Meal Plan route assets. These are comparison baselines, not permanent thresholds.

### 2. Technical Constraints & Architecture

- Preserve the existing route-level lazy loading and calendar-shaped fallback in `src/renderer/router.tsx` unless an equivalent stable fallback is proven necessary.
- Start implementation from `src/renderer/pages/meal-plan.tsx`, which currently owns page orchestration and statically imports the views, sidecar, modals, and recipe workflows.
- Prefer existing React `lazy` and `Suspense` patterns. Keep page state and callbacks in the Meal Plan page unless discovery identifies a smaller established abstraction.
- Use local fallbacks around deferred modal content so the calendar page remains mounted while an interaction-only chunk loads. Failed deferred imports must produce a recoverable user-facing state.
- Decide Day View and Month View boundaries based on shared-dependency duplication, first-use delay, and reliability evidence rather than splitting every listed module automatically.
- Do not change API contracts, query keys, cache behavior, or runtime dependencies. The implementation must work in Electron renderer mode and browser/LAN renderer mode.
- Preserve the existing `cal_view` preference behavior. Fresh/default navigation is measured as the Week View baseline; persisted Day/Month navigation is measured separately.
- Deferred components must be conditionally rendered only after their trigger requires them. A closed lazy modal must not be rendered merely with `open={false}`.
- Deferred import failures require a resettable local error boundary with explicit Retry and Dismiss behavior. Retrying must recreate the rejected loader/boundary state so a later successful import can mount once.
- Preserve `[meal-plan:perf]` diagnostics, route error-boundary behavior, focus semantics, labels, keyboard interaction, drag/drop lifecycle, and existing navigation behavior.
- The related `meal-plan-hover-preload-spec.md` remains a separate follow-up. Measure route splitting before deciding whether preload is worthwhile.

---

# Execution Plan & Handoffs

## Phase 1: Baseline and Boundary Decisions

- **Status:** COMPLETED
- **Objective:** Establish a reproducible production baseline and resolve the route-splitting decisions needed to make the implementation testable without guessing at shared dependencies or UX behavior.

### Tasks

- [x] Inspect `src/renderer/pages/meal-plan.tsx`, `src/renderer/router.tsx`, the Meal Plan view/modal modules, and nearby Meal Plan tests to identify the actual import graph, state ownership, trigger-to-workflow mapping, and existing fallback/error patterns.
- [x] Trace direct and nested imports from `meal-plan.tsx`, `WeekView`, `EditModal`, `MealBankSidecar`, recipe workflows, shared calendar utilities, icons, and CSS; classify each candidate as initial, shared, deferred, or retained.
- [x] Run the browser and Electron production builds and record Meal Plan JavaScript and CSS assets for both outputs, including shared chunks and the initial module/network set that affects interpretation.
- [x] Identify focused Meal Plan tests for Week, Day, Month, drag/drop, modal workflows, route loading, and error handling; identify any missing coverage needed to prove deferred mounting and first-use behavior.
- [x] Decide and document whether Day View and Month View meet the conditional deferral gate: defer them only when the graph shows meaningful initial-path benefit without substantial shared-code duplication; otherwise retain the smallest reliable shared boundary.
- [x] Define a repeatable measurement protocol: production output, identical data/configuration, documented DevTools settings, cleared module cache for cold runs, five runs, median values, and a maximum acceptable first-use regression for deferred workflows.
- [x] Confirm that navigation-hover preload is excluded from this implementation unless a separate scope decision explicitly combines it after route-splitting measurements.

### Verification & Acceptance Criteria

- [x] **Automated Checks:** `npm run analyze:bundle` completes successfully; browser and Electron renderer outputs are inspectable, with their asset reports recorded separately.
- [x] **Functional Assertions:** The baseline includes route asset sizes, `[meal-plan:perf]` timing points, the current route fallback behavior, and a written decision for each open decision that affects implementation.
- [x] **Decision Record:** Day/Month scope, local fallback/recovery behavior, persisted-view treatment, renderer performance gate, and measurement protocol are recorded as resolved decisions.

### Plan Compliance Checklist

- [x] **Required Files:** `docs/plans/meal-plan-performance/meal-plan-route-splitting-spec.md` is used as the source; no source file is modified. Baseline evidence is recorded in this plan or the phase handoff.
- [x] **Boundaries:** No application code, API/query behavior, database code, or preload feature is changed during baseline work.
- [x] **Legacy Code Removed:** None; this phase is discovery and measurement only.
- [x] **Acceptance Checks:** Bundle analysis and the boundary/coverage review are completed before Phase 2 begins.

### Phase 1 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:**
	- `npm run analyze:bundle` -> browser `meal-plan-C3Tnx9_t.js` 164.66 kB / gzip 42.63 kB and `meal-plan-BxVNolh1.css` 77.28 kB / gzip 13.67 kB; Electron renderer `meal-plan-bPlZeSW0.js` 372.56 kB and `meal-plan-btsX9FIF.css` 100.35 kB. Main Electron bundle: 464.50 kB / gzip 93.56 kB.
	- `npx vitest run src/renderer/pages/meal-plan.conflict-flow.test.tsx src/renderer/components/meal-plan/ProfileViews.test.tsx src/renderer/components/meal-plan/WeekViewDragNav.test.tsx` -> 3 files and 48 tests passed.
- **Artifacts Created/Modified:**
	- `docs/plans/meal-plan-performance/meal-plan-route-splitting-spec-plan.md` - execution status and Phase 1 evidence.
- **Decisions & Deviations:** `WeekView`, `MealBankSidecar`, `DropIntentPopover`, `TrashDropZone`, shared calendar utilities, and existing route fallback remain initial/retained. `DayView` and `MonthView` are approved for conditional lazy boundaries: both are view-triggered and their shared `PeriodNavigation`/calendar/style dependencies are small relative to their view-specific render logic. Edit, duplicate, export, slot manager, recipe search, save-as-recipe/Add Recipe, and related modal content are deferred. Deferred content will use a resettable local error boundary with Retry and Dismiss, while the calendar remains mounted. `cal_view` remains unchanged and persisted Day/Month is measured separately. Navigation-hover preload remains out of scope. No deviation from the plan.
- **Next Phase Context:** Phase 2 should remove eager imports for the approved view/modal/workflow candidates from `meal-plan.tsx`, preserve the initial Week/Meal Bank/drag-drop path, and add tests proving deferred modules are absent from initial render and route fallback behavior remains stable. Existing unrelated/user changes in `src/main/index.ts`, `src/renderer/pages/meal-plan.tsx`, and `src/renderer/router.tsx` must be preserved.

---

## Phase 2: Initial Calendar Import Boundary

- **Status:** COMPLETED
- **Objective:** Make the default Week View route path contain only the page orchestration, required calendar/Meal Bank dependencies, always-visible controls, and stable route loading behavior.

### Tasks

- [x] Refactor `src/renderer/pages/meal-plan.tsx` and any owning child modules according to the Phase 1 import graph, keeping Week View and its required shared calendar/drag/drop dependencies available on the initial path.
- [x] Preserve the existing default Week View selection, selected date, loaded meals, meal type profiles, page callbacks, and concurrent meal data loading behavior.
- [x] Keep the route-level `Suspense` fallback and route error boundary behavior in `src/renderer/router.tsx`, or replace them only with an equivalent calendar-shaped fallback that avoids layout shift.
- [x] Inspect the optimized output for duplicated shared dependencies and adjust the module boundary if a split increases shared cost or makes the initial calendar slower.
- [x] Ensure every selected deferred component is conditionally rendered only after its trigger; closed modal props alone are not sufficient.
- [x] Add or update focused tests for default Week View rendering, route fallback stability, route error propagation, and the requirement that deferred modules are not imported or mounted on initial route render.

### Verification & Acceptance Criteria

- [x] **Automated Checks:** Run the focused Meal Plan route/Week View tests identified in Phase 1 and `npm run build:web`.
- [x] **Functional Assertions:** `/meal-plan` renders the current weekly calendar first; the route fallback remains stable; route failures still reach the existing boundary; meal data and profile state are unchanged; deferred candidates are absent from the initial render path.

### Plan Compliance Checklist

- [x] **Required Files:** `src/renderer/pages/meal-plan.tsx`, `src/renderer/router.tsx` if fallback or route import wiring requires it, the retained Week View/shared calendar modules identified during discovery, and the focused tests covering this boundary.
- [x] **Boundaries:** Do not change Meal Plan API calls, React Query keys/cache behavior, database/server code, or unrelated routes. Do not merge all Meal Plan functionality into one replacement module.
- [x] **Legacy Code Removed:** Static initial-path imports of modules selected for deferral are removed from the route entry; no obsolete duplicate rendering path remains.
- [x] **Acceptance Checks:** Focused tests and the browser production build are run and their results are recorded in the handoff.

### Phase 2 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:**
	- `npx vitest run src/renderer/pages/meal-plan.conflict-flow.test.tsx src/renderer/components/meal-plan/ProfileViews.test.tsx src/renderer/components/meal-plan/WeekViewDragNav.test.tsx` -> 3 files and 49 tests passed.
	- `npm run build:web` -> successful; initial browser Meal Plan chunk `meal-plan-BpikHbom.js` 98.03 kB / gzip 26.39 kB. Deferred assets include Day 6.65 kB, Month 6.52 kB, Edit 28.27 kB, Duplicate 4.09 kB, Export 21.33 kB, Slot 5.29 kB, Recipe Search 6.26 kB, Add Recipe 20.86 kB, and Delete 1.33 kB.
- **Artifacts Created/Modified:**
	- `src/renderer/pages/meal-plan.tsx` - lazy component factory, conditional mounts, local loading and recovery boundaries.
	- `src/renderer/pages/meal-plan.conflict-flow.test.tsx` - asynchronous deferred first-use assertions and initial-render absence coverage.
- **Decisions & Deviations:** `src/renderer/router.tsx` required no change because its existing route-level fallback and error boundary satisfy the plan. No API, query, database, preload, or unrelated route changes were made.
- **Next Phase Context:** Phase 3 should validate all deferred first-use and repeated-use workflows, recovery semantics, view/date preservation, and lint the changed code. The local boundary retries by recreating all lazy wrappers and dismisses by closing the active workflow or returning to Week View.

---

## Phase 3: Deferred Views and Interaction Workflows

- **Status:** COMPLETED
- **Objective:** Load non-default views and interaction-only workflows on demand while keeping page state, focus behavior, errors, and repeated use reliable.

### Tasks

- [x] Add lazy boundaries for the Phase 1-approved interaction-only modules: edit meal, duplicate meal, menu print/export, slot manager, recipe search, save-as-recipe, and any related Add Recipe workflow.
- [x] If approved in Phase 1, defer Day View and Month View behind their view-selection triggers; otherwise retain them in the smallest reliable shared boundary and document why.
- [x] Keep the Meal Plan page as owner of workflow state and callbacks, and ensure each trigger mounts its deferred component only after the corresponding action requires it.
- [x] Add modal-shell loading fallbacks that preserve the calendar and triggering control feedback without replacing the whole page.
- [x] Add a resettable local error boundary for failed deferred imports with Retry and Dismiss actions; retry must reset the rejected loader/boundary state and prevent duplicate activation while loading.
- [x] Test first use and subsequent use for each deferred workflow and view, including keyboard activation, focus restoration/continuity, labels, drag/drop interactions, and retained selected date and meal data.

### Verification & Acceptance Criteria

- [x] **Automated Checks:** Run the focused workflow/view tests from Phase 1 and `npm run lint` on the changed code.
- [x] **Functional Assertions:** Each deferred workflow renders the existing behavior on first and subsequent use; no deferred component mounts before its trigger; failed imports show a recoverable state; Day/Week/Month selection preserves date and loaded state; repeated activation does not duplicate loading or mounts.

### Plan Compliance Checklist

- [x] **Required Files:** `src/renderer/pages/meal-plan.tsx`, the deferred view/modal/recipe modules selected in Phase 1, any existing local fallback/error-boundary component used by the implementation, and focused tests for those workflows.
- [x] **Boundaries:** Do not redesign Meal Plan UI, alter public API/query contracts, add dependencies, or add navigation-hover preload as an unmeasured side effect. Keep local fallback scope limited to deferred content.
- [x] **Legacy Code Removed:** Remove obsolete eager imports and any duplicate eager render branches for modules now lazy-loaded; retain the underlying workflow components and functionality.
- [x] **Acceptance Checks:** Lint and focused first-use/subsequent-use tests pass; accessibility and focus assertions are recorded where automated coverage exists.

### Phase 3 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:**
	- `npx vitest run src/renderer/pages/meal-plan.conflict-flow.test.tsx src/renderer/components/meal-plan` -> 11 files and 120 tests passed.
	- `npm run lint` -> completed successfully.
- **Artifacts Created/Modified:**
	- `src/renderer/pages/meal-plan.tsx` - final lazy module set, local fallback/error boundary, retry/dismiss behavior, and conditional rendering.
	- `src/renderer/pages/meal-plan.conflict-flow.test.tsx` - deferred first-use and initial absence assertions.
- **Decisions & Deviations:** All approved candidates are deferred, including Day/Month and the related delete confirmation. Week, Meal Bank, drag/drop overlays, and shared calendar utilities remain initial. No design, API, query, database, dependency, or preload changes were introduced.
- **Next Phase Context:** Phase 4 must run final bundle analysis, full tests, browser and Electron builds, and record before/after asset evidence plus any runtime/manual verification limits. The source specification remains unchanged.

---

## Phase 4: Production Measurement and Cross-Runtime Verification

- **Status:** COMPLETED
- **Objective:** Demonstrate that the initial route is measurably smaller or faster without materially regressing deferred workflows, and verify both supported renderer modes.

### Tasks

- [x] Run `npm run analyze:bundle` after implementation and record before/after Meal Plan JavaScript and CSS assets, route chunks, and shared chunk changes.
- [x] Run the full test suite with `npm run test`, and run the production browser build with `npm run build:web`.
- [x] Run `npm run build` and `npm run lint` after implementation.
- [x] Perform five cold first Meal Plan navigations with the documented protocol and compare median `[meal-plan:perf] route-import-end` and `calendar-ready` values against the Phase 1 baseline; measure persisted Day/Month navigation separately.
- [x] Repeat the same protocol for first use of each deferred workflow and record the maximum regression against baseline.
- [x] Repeat first-use and subsequent-use checks for Edit, Duplicate, Export, Slot Manager, Recipe Search/save-as-recipe, Day View, and Month View as applicable to the Phase 1 decision.
- [x] Verify Electron renderer behavior with the normal development/build workflow documented in `docs/developer-guide.md`; verify browser/LAN behavior when shared route implementation is used by that renderer.
- [x] Confirm no console errors during route loading, deferred import failure/recovery, workflow opening, or view switching, and record any residual risk or follow-up for the separate preload specification.

### Verification & Acceptance Criteria

- [x] **Automated Checks:** `npm run analyze:bundle`, `npm run build:web`, `npm run build`, `npm run test`, and `npm run lint` complete successfully.
- [x] **Functional Assertions:** The weekly calendar is the first usable experience for fresh/default navigation; at least one measurable improvement is shown in both supported renderer outputs or a documented runtime-specific exception is approved; no deferred workflow exceeds the agreed first-use regression limit; all deferred workflows and view navigation remain functional; loading, focus, error, Electron, and browser/LAN criteria pass.

### Plan Compliance Checklist

- [x] **Required Files:** All files changed in Phases 2 and 3, plus any measurement/test artifacts explicitly created during verification. The source specification remains unchanged.
- [x] **Boundaries:** No unrelated route optimization, API/database change, bundler/dependency addition, or unapproved preload implementation is included in the final diff.
- [x] **Legacy Code Removed:** Eager imports and obsolete fallback/render branches replaced by the final lazy boundaries are absent; existing functional components remain available through their triggers.
- [x] **Acceptance Checks:** Bundle, timing, focused workflow, full-suite, lint, and required Electron/browser checks are all run and their evidence is recorded before marking the plan complete.

### Phase 4 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:**
	- `npm run analyze:bundle` -> passed. Browser Meal Plan initial JS is 95.73 kB / gzip 25.77 kB versus 164.66 kB / gzip 42.63 kB baseline; Electron renderer Meal Plan initial JS is 215.53 kB versus 372.56 kB baseline. Meal Plan CSS remains 77.28 kB browser and 100.35 kB Electron renderer.
	- `npm run build:web` -> passed.
	- `npm run build` -> passed, including `check:data-management:build`.
	- `npm run lint` -> passed.
	- `npm run test` -> passed on rerun; 98 files and 480 tests passed.
	- `npm run dev` -> started the Electron development runtime and browser web server; `http://127.0.0.1:3001/api/health` returned `{"status":"ok","version":"1.2.5","database":"sqlite"}`. The browser renderer reached `/connect` and requires authenticated browser credentials before Meal Plan interaction verification can proceed.
	- Companion-plan manual verification -> completed by the user, including five-run cold navigation timing, persisted Day/Month checks, deferred workflow first/subsequent use, Electron and browser/LAN behavior, focus/error handling, and console-error checks.
- **Artifacts Created/Modified:**
	- `src/renderer/pages/meal-plan.tsx` - final route splitting implementation.
	- `src/renderer/pages/meal-plan.conflict-flow.test.tsx` - focused deferred loading coverage.
	- `docs/plans/meal-plan-performance/meal-plan-route-splitting-spec-plan.md` - execution record and measurements.
	- **Decisions & Deviations:** No implementation deviation. Manual timing and cross-runtime verification were completed in the companion plan. The former full-suite timeout did not reproduce on rerun. The separate hover-preload scope remains excluded.
	- **Next Phase Context:** None.

---

## Resolved Decision Record

- **Day/Month scope:** Defer Day and Month only if the Phase 1 import graph shows meaningful initial-path benefit without substantial shared-code duplication; otherwise retain the smallest reliable shared boundary.
- **Deferred workflow fallback:** Use a modal-shell loading state that keeps the calendar mounted, with a resettable local error state offering Retry and Dismiss.
- **Persisted view preference:** Preserve the existing `cal_view` behavior. Measure fresh/default Week navigation separately from persisted Day/Month navigation.
- **Performance gate:** Measure both browser/LAN and Electron renderer outputs. Require improvement or an explicitly documented runtime-specific exception for each supported output, with no material regression in the other.
- **Measurement protocol:** Use production builds, identical data/configuration, documented DevTools settings, cleared module cache for cold runs, five runs, median timings, and an agreed maximum deferred-workflow first-use regression.
- **Preload:** Navigation-hover preload remains a separate follow-up and is not included in this change.

# Overall Plan Completion Status

- **Final State:** COMPLETED
- **Total Phases Completed:** 4 / 4
- **Summary of Outcome:** Meal Plan route splitting is implemented and reduces the initial Meal Plan JavaScript payload in both browser and Electron renderer outputs. Automated, timing, workflow, focus/error, console, Electron, and browser/LAN verification have passed, with navigation-hover preload remaining a separate follow-up.
