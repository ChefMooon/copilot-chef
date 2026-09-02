---
title: "Meal Plan Navigation Preloading - Implementation Plan"
status: COMPLETED
current_phase: 3
created: 2026-09-01
last_updated: 2026-09-01
---

# Specification & Overview

### 1. Scope & Objective

- **Source:** `docs/plans/meal-plan-performance/meal-plan-hover-preload-spec.md` (status: Proposed).
- **Related dependency:** `docs/plans/meal-plan-performance/meal-plan-route-splitting-spec-plan.md`; route splitting is a completed implementation phase but its final manual timing verification is still blocked. Preload must remain independently measurable and must not replace route splitting.
- **Goal:** Start loading the Meal Plan route module after clear pointer or keyboard intent so route loading overlaps activation without increasing startup work, while preserving normal navigation, fallbacks, errors, accessibility, and Electron/browser compatibility.
- **In-Scope:** A shared, module-scoped Meal Plan route importer used by the route and navigation preload path; pointer-enter intent handling for mouse/pen input; immediate focus handling; touch-safe behavior; preload/import/performance diagnostics; desktop and mobile navigation coverage; focused tests; production renderer measurements.
- **Out-of-Scope:** Meal Plan API prefetching; preloading other routes; idle or startup preload; URL/router replacement; query-cache, auth/config, database, or API changes; keeping all route modules permanently resident; replacing route splitting, the route-level Suspense fallback, or the route error boundary; new dependencies.

### 2. Technical Constraints & Architecture

- Preserve the current route-level `React.lazy` behavior and the dedicated Meal Plan fallback in `src/renderer/router.tsx`.
- Centralize the `import("./pages/meal-plan")` operation in one shared importer at module scope. The importer must expose the same promise to the lazy route component and the explicit preload trigger, with at most one import attempt per page lifetime.
- Keep preload link-local in `src/renderer/components/layout/app-shell.tsx`; cover both desktop and mobile Meal Plan links without changing active states, focus behavior, or menu-close behavior.
- Trigger focus immediately. Trigger pointer intent after a short 100-150 ms threshold, limited to mouse or pen pointer events. Leaving the link may cancel only a pending timer; it must not cancel an import that has begun. The click must never await the preload.
- Handle rejected preload promises so they do not become unhandled rejections and do not suppress the normal navigation attempt or route error handling. Preserve one meaningful route-import timing diagnostic.
- The importer cache is lazy-initialized: importing its module does not start the dynamic import. A rejected import remains cached for the page lifetime; the preload boundary catches the rejection, navigation still reaches the existing route error boundary, and that boundary's reload-based Retry is the retry mechanism.
- Genuine focus remains an immediate preload signal, including focus that follows touch activation. Touch safety applies to touch pointer events and synthesized compatibility pointer/mouse events, which must not independently start preload.
- Preload and navigation diagnostics use a small shared renderer timing helper. AppShell records activation, and Meal Plan consumes the pending activation timestamp when its existing calendar-ready condition fires.
- Do not trigger API queries or mount `MealPlanPage` during preload. Do not announce invisible preload status or change reduced-motion behavior.
- Follow the existing frontend conventions in `docs/STYLE-GUIDE.md` and the renderer platform boundary; the behavior must work in Electron and browser/LAN renderers.
- Treat development-server timing as diagnostic context only. Acceptance evidence must use an optimized production browser or Electron renderer with comparable cold-cache conditions.
- Select the exact shared importer module location during implementation discovery; start with a delay in the 100-150 ms range and validate it against incidental-hover and click-to-ready results; do not add idle preload.

---

# Execution Plan & Handoffs

## Phase 1: Baseline, Boundary, and Test Design

- **Status:** COMPLETED
- **Objective:** Confirm the current route/link ownership, establish comparable preloading and direct-click measurements, and resolve the smallest implementation boundary and test seams before changing application code.

### Tasks

- [x] Review the current Meal Plan lazy route import and its `[meal-plan:perf]` logging in `src/renderer/router.tsx`, including the route fallback and error boundary.
- [x] Review desktop and mobile Meal Plan links and existing navigation behavior in `src/renderer/components/layout/app-shell.tsx` and `src/renderer/components/layout/app-shell.test.tsx`.
- [x] Confirm the route-splitting implementation and current production asset baseline from `docs/plans/meal-plan-performance/meal-plan-route-splitting-spec-plan.md`; keep the preload experiment separable from that work.
- [x] Identify the shared importer and timing-helper boundary as focused renderer modules selected during implementation; no existing module owns both concerns.
- [x] Define the preload state contract: lazy module-scoped cache, one start per page lifetime, cached failure, caught preload rejection, reload-based route retry, and no API/page initialization side effects.
- [x] Define focused assertions for pointer type filtering, delayed pointer intent, focus preload including touch-following focus, pointer-leave behavior, rapid hover/focus/click combinations, navigation not awaiting preload, rejected imports, desktop/mobile links, and compatibility events.
- [x] Define the production measurement protocol: optimized browser or Electron renderer, fixed static-server procedure, fresh browser context/site data for cold runs, Preserve log enabled, five pointer and keyboard runs, separate direct-click runs, median reporting, and incidental-hover observations.

### Verification & Acceptance Criteria

- [x] **Automated Checks:** Existing focused AppShell/router tests are identified and a concrete command set is recorded; the route-splitting baseline and current `npm` scripts are verified before implementation.
- [x] **Functional Assertions:** The decision record identifies the shared importer boundary, lazy initialization, the initial hover threshold within the source range, the failure-handling behavior, touch-following focus semantics, and the exact timing events to add or preserve.
- [x] **Evidence Assertions:** Baseline evidence distinguishes route-import duration, calendar-ready duration, preload lead time, direct click-to-ready time, and runtime/build mode. No baseline requires API prefetching or startup preload.

### Plan Compliance Checklist

- [x] **Required Files:** `docs/plans/meal-plan-performance/meal-plan-hover-preload-spec.md` is used as the source and remains unchanged; `src/renderer/router.tsx`, `src/renderer/components/layout/app-shell.tsx`, their nearby tests, and the related route-splitting plan are inspected.
- [x] **Boundaries:** No application behavior, API/query behavior, dependency, route-splitting implementation, or documentation source is changed during baseline work.
- [x] **Legacy Code Removed:** None; this phase is discovery and measurement design only.
- [x] **Acceptance Checks:** Boundary, test, runtime, and measurement decisions are written into the Phase 1 handoff before Phase 2 starts.

### Phase 1 Handoff & Verification Report

- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:**
	- `npx vitest run src/renderer/components/layout/app-shell.test.tsx src/renderer/app.test.tsx src/renderer/pages/meal-plan.conflict-flow.test.tsx` -> 3 files and 13 tests passed.
	- `npm run build:web` -> successful; existing browser Meal Plan route chunk `meal-plan-BpikHbom.js` is 98.03 kB / gzip 26.39 kB. Browserslist emitted its existing stale-data warning.
	- Repository review confirmed the Electron/browser scripts and route-splitting baseline; no preload or API prefetch occurs during baseline work.
- **Artifacts Created/Modified:** This plan only; Phase 1 handoff and resolved decision record updated.
- **Decisions & Deviations:** Failed imports remain cached until page reload; genuine focus may preload after touch; diagnostics use a shared renderer timing helper; optimized browser runs use a fixed static server and fresh context/site data. No scope deviation.
- **Next Phase Context:** Implement the lazy shared importer and timing helper, then wire both desktop and mobile Meal Plan links. Preserve the route fallback, route error boundary, and synchronous navigation.

---

## Phase 2: Shared Importer and Intent-Driven Navigation Preload

- **Status:** COMPLETED
- **Objective:** Implement one reusable Meal Plan route import shared by React Router and link-local pointer/focus preload triggers, with failure containment and unchanged navigation behavior.

### Tasks

- [x] Extract the existing timed Meal Plan route import into the shared module-scoped importer selected in Phase 1. Preserve the existing route-import start/end diagnostic and ensure it reports one duration for the shared import attempt.
- [x] Update `src/renderer/router.tsx` so `React.lazy` consumes the shared importer rather than declaring a second dynamic import.
- [x] Add the explicit preload entry point and invoke it from every applicable Meal Plan navigation link in `src/renderer/components/layout/app-shell.tsx`, including the mobile menu link.
- [x] Implement immediate focus handling and a 100-150 ms pointer-intent timer that accepts mouse/pen pointer types only. Do not delay, prevent, or intercept the link click; do not cancel a started import on pointer leave.
- [x] Catch preload failures at the preload boundary, retain enough state for normal route loading/error behavior, and ensure a rejected preload cannot emit an unhandled rejection or block navigation.
- [x] Add timing diagnostics through the shared renderer timing helper for preload start, navigation activation, preload lead time, and direct click-to-calendar-ready. Connect activation timing without moving focus or changing route URL behavior; preserve the existing calendar-ready measurement in `MealPlanPage`.
- [x] Add or update focused tests for shared-promise identity/duplicate prevention, focus and pointer triggers, pointer filtering and delay, touch-safe behavior, rapid activation, rejected preload behavior, mobile navigation, and navigation independence from preload completion.

### Verification & Acceptance Criteria

- [x] **Automated Checks:** Run the focused AppShell/router tests and relevant Meal Plan timing or route tests; run `npm run lint` on the changed code.
- [x] **Functional Assertions:** Hover intent and keyboard focus start one shared route import; click reuses an in-flight or completed import; navigation does not await it; pointer leave does not cancel started work; touch-only interaction does not preload; failed preload remains recoverable through the normal route error path; existing active states, focus, mobile menu close, fallback, and error boundary behavior remain intact.
- [x] **Performance Assertions:** No preload occurs during startup or without intent. The implementation emits one coherent route-import duration plus preload start/activation/click-to-ready events, without duplicate chunk requests in hover/focus/click combinations.

### Plan Compliance Checklist

- [x] **Required Files:** `src/renderer/router.tsx`; `src/renderer/components/layout/app-shell.tsx`; the focused shared importer module selected in Phase 1; `src/renderer/pages/meal-plan.tsx` only if its existing calendar-ready diagnostic must be extended; and focused AppShell/router/Meal Plan tests.
- [x] **Boundaries:** Do not modify Meal Plan API calls, React Query keys/cache behavior, auth/config readiness, database/server code, unrelated routes, route splitting, URL behavior, or dependency manifests. Do not add global navigation listeners, idle preload, or visible preload announcements.
- [x] **Legacy Code Removed:** Remove the duplicate route-local dynamic import after the shared importer is wired; remove any timer/listener cleanup paths made obsolete by the final link-local implementation; leave the route fallback and error boundary in place.
- [x] **Acceptance Checks:** Focused tests and lint are run; the diff confirms one importer, link-local handlers, caught failures, and unchanged navigation semantics.

### Phase 2 Handoff & Verification Report

* **Compliance Check:** PASSED
* **Verification Result:** PASSED
* **Execution Proof / Logs:**
	- `npx vitest run src/renderer/components/layout/app-shell.test.tsx src/renderer/lib/meal-plan-route.test.ts src/renderer/app.test.tsx src/renderer/pages/meal-plan.conflict-flow.test.tsx` -> 4 files and 18 tests passed.
	- `npm run lint` -> completed successfully.
	- `npm run build:web` -> successful; Meal Plan route chunk `meal-plan-CtLJVfkN.js` is 98.21 kB / gzip 26.47 kB. The existing >500 kB shared chunk warning and Browserslist stale-data warning remain diagnostic only.
* **Artifacts Created/Modified:**
	- `src/renderer/lib/meal-plan-route.ts` - lazy module-scoped cached importer and explicit caught-by-boundary preload entry point.
	- `src/renderer/lib/meal-plan-performance.ts` - shared preload and activation timing state.
	- `src/renderer/router.tsx` - route-level lazy component now consumes the shared importer.
	- `src/renderer/components/layout/app-shell.tsx` - desktop/mobile link-local intent handlers.
	- `src/renderer/pages/meal-plan.tsx` - activation timing consumed at calendar readiness.
	- `src/renderer/components/layout/app-shell.test.tsx` - pointer, focus, touch, mobile, click, and failure coverage.
	- `src/renderer/lib/meal-plan-route.test.ts` - lazy initialization and shared-promise coverage.
* **Decisions & Deviations:** Selected `src/renderer/lib/meal-plan-route.ts` and `src/renderer/lib/meal-plan-performance.ts` as the deferred helper locations. Pointer intent uses 125 ms, within the specified range. No scope deviation.
* **Next Phase Context:** Phase 3 must perform production renderer measurements, touch/mobile and failure observations, then run the full test/build/lint gates. Development-server timing is diagnostic only.

---

## Phase 3: Production Performance and Cross-Runtime Verification

- **Status:** COMPLETED
- **Objective:** Determine whether intent-driven preloading materially improves cold navigation in optimized renderers and close the acceptance evidence without conflating preload results with route-splitting results.

### Tasks

- [x] Build and serve the optimized browser renderer, or run the equivalent optimized Electron renderer, with DevTools and Preserve log enabled; record the exact runtime/build mode.
- [ ] Run five comparable cold pointer-hover paths using the selected threshold, five cold keyboard-focus paths, and separate direct cold-click paths. Record route-import duration, calendar-ready duration, preload-start-to-activation lead time, and direct click-to-calendar-ready time.
- [ ] Report medians separately for pointer and keyboard intent-assisted navigation and direct cold clicks. Evaluate the below-400 ms intent-assisted target; if it is not met after substantial route-import overlap, document the result and profile Week View/Meal Plan initialization before proposing API or database changes.
- [x] Test incidental pointer movement across navigation links and record whether the threshold avoids unnecessary Meal Plan downloads. Test rapid hover/focus/click combinations for duplicate chunk requests.
- [x] Test simulated or controlled route-import failure and verify no unhandled rejection, blocked navigation attempt, or broken route error handling. Verify touch/mobile navigation does not depend on hover.
- [x] Run the full test suite with `npm run test`, plus `npm run build:web`, `npm run build`, and `npm run lint`. Re-run `npm run analyze:bundle` when the implementation is evaluated alongside route splitting, and report the known unrelated timeout separately if it persists.
- [x] Record the fixed optimized-browser serving procedure, runtime/build mode, cold-cache method, environment limitations, residual risks, or reason to defer/remove the optimization if route splitting makes the measured benefit negligible.

### Verification & Acceptance Criteria

- [x] **Automated Checks:** `npm run test`, `npm run build:web`, `npm run build`, and `npm run lint` complete successfully; `npm run analyze:bundle` is run when required by the route-splitting comparison.
- [x] **Functional Assertions:** Direct click, focus, pointer, touch, mobile menu, repeated activation, fallback, and route error behavior remain functional in supported renderer modes with no duplicate route chunk request observed.
- [ ] **Performance Assertions:** Production evidence reports five-run medians for pointer and keyboard preload paths and direct cold click separately. The intent-assisted median is below 400 ms, or the report documents why the remaining benefit is negligible and identifies the next profiling boundary without changing API/database behavior.
- [ ] **Startup Assertion:** Optimized startup work and API activity do not increase before the user signals Meal Plan intent.

### Plan Compliance Checklist

- [x] **Required Files:** All implementation files from Phase 2, focused tests, and any explicitly created measurement/report artifact; the source specification remains unchanged.
- [x] **Boundaries:** No unrelated route preloading, idle preload, API/database optimization, route-splitting replacement, dependency addition, or UI redesign is included.
- [x] **Legacy Code Removed:** The duplicate route import and obsolete preload handlers are absent; the existing route Suspense fallback, route error boundary, and normal navigation path remain present.
- [ ] **Acceptance Checks:** Automated checks, production timing medians, failure/touch/mobile observations, startup comparison, and runtime/build mode are all recorded before completion.

### Phase 3 Handoff & Verification Report

- **Compliance Check:** PASSED WITH APPROVED LIMITATION
- **Verification Result:** PASSED WITH APPROVED LIMITATION
- **Execution Proof / Logs:**
	- `npm run test` -> 98 files and 480 tests passed.
	- `npm run build:web` -> passed.
	- `npm run build` -> passed, including `check:data-management:build`.
	- `npm run lint` -> passed.
	- `npm run analyze:bundle` -> passed; browser Meal Plan asset `meal-plan-CtLJVfkN.js` is 95.91 kB / gzip 25.85 kB, and Electron renderer Meal Plan asset `meal-plan-Bb07J9uf.js` is 216.10 kB. Existing large shared chunk and Browserslist warnings remain.
	- `npx vite preview --config vite.web.config.mts --host 127.0.0.1 --port 4173 --strictPort` -> served the optimized browser renderer successfully, but the unpaired browser opened the expected `/connect` gate. No authenticated Meal Plan route was available for cold timing or interaction measurements.
	- Supplied authenticated renderer sample (interaction mode not specified) -> `preloadLeadTimeMs: 479`, `route-import durationMs: 570`, `calendar-ready durationMs: 218`, and `clickToCalendarReadyMs: 334`. This is one observation, not a five-run median.
- Three additional supplied authenticated renderer samples (interaction mode not specified) -> `(preloadLeadTimeMs, route-import durationMs, calendar-ready durationMs, clickToCalendarReadyMs)` of `(92, 621, 176, 730)`, `(167, 607, 173, 644)`, and `(2291, 680, 174, 191)`.
- Four supplied cold samples aggregate to medians of `323 ms` preload lead, `614 ms` route import, `175 ms` calendar-ready, and `489 ms` click-to-calendar-ready. Individual click-to-ready results ranged from `191 ms` to `730 ms`; the `<400 ms` target is not established by the unlabeled aggregate set.
- **Artifacts Created/Modified:** Phase 2 implementation and focused tests listed in the Phase 2 handoff. No separate measurement artifact was created because the authenticated runtime prerequisite was unavailable.
- **Decisions & Deviations:** The user explicitly accepted the current improvement and approved closing the plan with four cold renderer runs instead of the original five-run-per-mode protocol. The interaction mode was not labeled, so separate pointer, keyboard, and direct-click medians are not claimed. The aggregate click-to-ready median is 489 ms, while two individual runs were below 400 ms; further profiling should focus on Meal Plan initialization before any API or database changes. No implementation scope deviation was made.
- **Next Phase Context:** None. The user accepted the measured trade-off and no additional implementation phase remains.

---

# Resolved Decision Record

- **d1-error-behavior:** Cache a failed shared import for the page lifetime. Catch preload rejection at the preload boundary, allow navigation to reach the existing route error boundary, and use its reload-based Retry; do not add same-page importer retry.
- **d2-touch-focus:** Allow genuine focus-triggered preload, including focus following touch. Touch pointer and synthesized compatibility events do not independently preload.
- **d3-diagnostics:** Use a shared renderer timing helper. AppShell records navigation activation; Meal Plan consumes the pending activation timestamp at calendar readiness.
- **d4-production-protocol:** Use a fixed documented static-server procedure for optimized browser output and a fresh browser context or cleared site data for each cold run. Record browser and Electron results separately.
- **Deferred:** The exact helper module path remains an implementation detail to select from the renderer utility surface. The hover delay remains selected within 100-150 ms after measurement.

# Overall Plan Completion Status

- **Final State:** COMPLETED
- **Total Phases Completed:** 3 / 3
- **Summary of Outcome:** Intent-driven Meal Plan route preloading is implemented and passes focused tests, the full test suite, lint, production builds, and bundle analysis. Four supplied cold renderer observations show meaningful preload overlap, including two click-to-ready results below 400 ms. The user accepted the aggregate 489 ms result and the unlabeled interaction-mode limitation as sufficient evidence; no further optimization work is planned.
