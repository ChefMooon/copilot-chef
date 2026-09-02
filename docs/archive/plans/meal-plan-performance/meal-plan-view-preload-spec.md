# Meal Plan View Preloading Specification

## Status

Decision-complete; ready for implementation planning.

This specification follows the completed Meal Plan route-splitting and navigation-preload work recorded in the archived performance plans. It addresses deferred chunks inside the Meal Plan page and must not weaken the existing route-level preload or lazy boundaries.

## Problem Statement

The Meal Plan route is preloaded when the user focuses or intentionally hovers the Meal Plan navigation link. After the route is usable, Day View and Month View are still loaded only when the user switches to them. The first switch can therefore show a short deferred loading state even though these views are predictable, common alternatives to Week View.

The same pattern applies to Edit Meal and other interaction workflows. They are intentionally deferred and should not all be loaded automatically without evidence that the additional work improves the user experience.

## Goals

- Reduce or eliminate first-use module-loading delay when switching from Week View to Day View or Month View.
- Begin view preloading only after the primary Meal Plan experience is usable, or after an equivalent idle-after-readiness boundary.
- Reuse the same cached import promise for explicit preloading and eventual lazy rendering.
- Preserve the current conditional mounting behavior so preloading never mounts hidden views or runs component effects.
- Preserve existing date, view preference, query, loading, error, accessibility, Electron, and browser/LAN behavior.
- Measure whether view preloading improves activation latency without regressing initial Week View readiness.
- Preload Edit Meal and its nested Delete Confirmation and Recipe Search modules during the same post-ready idle window.

## Non-Goals

- Preloading unrelated Meal Plan workflows immediately after page load, including Duplicate Meal, export, Slot Manager, and Add Recipe.
- Preloading unrelated application routes.
- Mounting hidden Day, Month, or modal components.
- Prefetching Meal Plan API data for alternate date ranges.
- Changing query keys, cache policy, refetch intervals, live-sync behavior, or server APIs.
- Replacing route-level Suspense fallbacks or deferred-content error boundaries.
- Adding a new dependency, telemetry system, or global navigation listener.

## User Stories

- As a Meal Plan user, after the weekly calendar is usable, I can switch to Day View without waiting for an avoidable module download.
- As a Meal Plan user, after the weekly calendar is usable, I can switch to Month View without waiting for an avoidable module download.
- As a user who never opens Day or Month View, my initial Week View load does not incur unnecessary work before the page becomes usable.
- As a user who opens Edit Meal, the first-use experience remains reliable even if its deferred module is still loading or fails to load.
- As a keyboard, touch, Electron, or browser/LAN user, navigation and focus behavior remain unchanged.

## Current-State Evidence

- The route uses a shared cached importer in [src/renderer/lib/meal-plan-route.ts](../../../src/renderer/lib/meal-plan-route.ts). Navigation preload currently covers the route module only.
- The route-level lazy component and calendar-shaped fallback are defined in [src/renderer/router.tsx](../../../src/renderer/router.tsx).
- Day View, Month View, Edit Modal, Duplicate Meal, export, slot management, recipe search, Add Recipe, and delete confirmation are created as deferred components in [src/renderer/pages/meal-plan.tsx](../../../src/renderer/pages/meal-plan.tsx).
- Day and Month are conditionally mounted only when their view is selected in [src/renderer/pages/meal-plan.tsx](../../../src/renderer/pages/meal-plan.tsx). This behavior must remain intact.
- Edit Modal is conditionally mounted only after an edit action in [src/renderer/pages/meal-plan.tsx](../../../src/renderer/pages/meal-plan.tsx).
- Day and Month are separate modules with shared calendar and period-navigation dependencies in [src/renderer/components/meal-plan/DayView.tsx](../../../src/renderer/components/meal-plan/DayView.tsx) and [src/renderer/components/meal-plan/MonthView.tsx](../../../src/renderer/components/meal-plan/MonthView.tsx).
- The application already uses TanStack Query prefetching for broadly useful meal-type configuration in [src/renderer/app.tsx](../../../src/renderer/app.tsx). This establishes a local prefetch pattern but does not justify additional Meal Plan data requests.
- The existing view behavior and accessibility coverage is tested in [src/renderer/components/meal-plan/ProfileViews.test.tsx](../../../src/renderer/components/meal-plan/ProfileViews.test.tsx), while deferred page workflows are covered in [src/renderer/pages/meal-plan.conflict-flow.test.tsx](../../../src/renderer/pages/meal-plan.conflict-flow.test.tsx).
- The completed route-splitting work reduced the browser Meal Plan entry from approximately 164.66 kB to approximately 95.73 kB minified and reduced the Electron renderer entry from approximately 372.56 kB to approximately 215.53 kB. The remaining Day, Month, and workflow chunks are already split and are therefore candidates for targeted preloading rather than another bundling redesign.

## Proposed Scope

### Required: Day and Month view preload

Add shared, module-scoped import functions for Day View and Month View. The lazy components and explicit preload functions must use the same importer for each module.

Start preloading only after the Meal Plan page reaches the selected readiness boundary. The preferred initial experiment is a delayed or idle-after-readiness trigger so view imports do not compete with route loading, primary queries, Week View rendering, or initial settings reads.

The implementation must preload modules without rendering them. Existing `view === "day"` and `view === "month"` gates remain the authority for mounting.

### Required: Edit Meal and nested workflow preload

Preload Edit Modal during the same post-ready idle window as Day and Month. Because Edit Modal statically imports Delete Confirmation and Recipe Search, preload those nested workflow modules as part of this scope as well. Do not mount any of them or open a modal during preloading.

The other deferred workflows remain on-demand initially:

- Duplicate Meal
- Menu Print / Export
- Slot Manager
- Recipe Search
- Add Recipe
- Delete Confirmation

### Explicitly excluded: API prefetch

Do not prefetch scheduled or unscheduled meal data for alternate views as part of this specification. Day, Week, and Month can represent different date ranges and arbitrary navigation, while the current query layer already handles concurrent requests and invalidation. Revisit this only if production evidence shows data latency, rather than module loading or rendering, is the dominant cost.

## Functional Requirements

1. Day View and Month View preloads begin only after the defined Meal Plan readiness boundary.
2. The Day View lazy component and its explicit preload share one import promise.
3. The Month View lazy component and its explicit preload share one import promise.
4. Repeated readiness effects, view changes, and retry state changes do not issue duplicate chunk requests.
5. Preloading never mounts Day View, Month View, Edit Modal, or another deferred component.
6. Preloading never invokes component effects, opens a modal, changes focus, or changes the selected view.
7. Switching views preserves the selected date, loaded meals, meal-type profiles, `cal_view` persistence, and existing view-specific behavior.
8. A failed background preload is caught and does not create an unhandled rejection.
9. A failed preload does not change the existing deferred error boundary, Retry, or Dismiss behavior when the user later selects the view.
10. Existing route-level preload, route fallback, local deferred fallback, route error handling, and navigation behavior remain intact.
11. The implementation works in Electron and browser/LAN renderer modes.
12. Edit, Delete Confirmation, and Recipe Search preloading is limited to the agreed post-ready idle window; Duplicate Meal, export, Slot Manager, and Add Recipe remain on demand.

## Performance Requirements

- Initial Week View readiness must not regress materially compared with the current production baseline.
- Day and Month activation time must be measured separately with and without background module preload using an optimized renderer.
- Measurements must record whether the user opened the view after the preload completed, while it was in flight, or before it started.
- The experiment must report chunk request count and confirm that no duplicate request occurs for a view.
- The preload trigger must not increase startup API activity or initial JavaScript work before the Meal Plan page is usable.
- A view preload is successful only if it produces a meaningful reduction in first activation latency without an unacceptable increase in initial Week View readiness or resource usage.
- Edit workflow preload must report its transitive chunk cost and first-use benefit separately from Day/Month. It may be retained only if the measured benefit does not violate the initial Week View regression gate.

## Accessibility and UX Requirements

- Keyboard focus and activation remain unchanged.
- Touch navigation does not depend on hover or pointer compatibility events.
- Preloading remains invisible and does not announce status to assistive technologies.
- Existing loading feedback remains available if a user activates a view before its preload completes.
- Existing focus continuity, labels, keyboard controls, and error recovery remain intact.
- Reduced-motion preferences do not change preload behavior or introduce new animations.
- The page must remain usable if a deferred chunk fails to load.

## Implementation Constraints

- Prefer shared import functions in the renderer utility surface, following the pattern in [src/renderer/lib/meal-plan-route.ts](../../../src/renderer/lib/meal-plan-route.ts).
- Keep lazy component creation and import caching compatible with the existing retry mechanism in [src/renderer/pages/meal-plan.tsx](../../../src/renderer/pages/meal-plan.tsx).
- Keep the Meal Plan page as owner of view and workflow state.
- Do not use a global event listener or preload every route.
- Do not alter React Query keys, query functions, API contracts, or server behavior.
- Do not remove conditional rendering or local loading/error boundaries.
- Do not add a dependency.

## Validation Plan

1. Establish the current optimized browser and Electron baselines for initial Week View readiness and first Day/Month activation.
2. Implement shared Day and Month importers and focused unit tests for promise identity, lazy initialization, duplicate prevention, and rejected imports.
3. Add readiness-gated background preload behavior and test that no deferred component mounts or API query starts because of preloading.
4. Run the focused Meal Plan tests, including [src/renderer/components/meal-plan/ProfileViews.test.tsx](../../../src/renderer/components/meal-plan/ProfileViews.test.tsx) and [src/renderer/pages/meal-plan.conflict-flow.test.tsx](../../../src/renderer/pages/meal-plan.conflict-flow.test.tsx).
5. Run `npm run test`, `npm run lint`, `npm run build:web`, `npm run build`, and `npm run analyze:bundle`.
6. In an optimized renderer, perform five comparable cold Week-to-Day and Week-to-Month switches with preloading disabled and enabled. Report medians separately.
7. Verify that initial Week View readiness, startup network activity, query behavior, view persistence, focus behavior, touch/mobile behavior, and error recovery remain unchanged.
8. Measure Edit, Delete Confirmation, Recipe Search, Duplicate, Export, Slot Manager, and Add Recipe first-use latency separately; report the transitive cost and benefit of the agreed Edit preload.
9. Verify browser/LAN and Electron behavior where authenticated runtime access is available. Record any `/connect` or runtime limitation rather than treating it as a passing manual check.

## Acceptance Criteria

- [ ] Day View and Month View use shared cached importers for lazy rendering and explicit preload.
- [ ] Background preloading starts only after the agreed Meal Plan readiness boundary.
- [ ] Initial Week View readiness and startup API activity do not materially regress.
- [ ] Day and Month first-use activation latency improves by a documented meaningful amount, or the preload is deferred as not beneficial.
- [ ] No duplicate Day or Month chunk requests occur across preload, view activation, retries, or repeated use.
- [ ] Day/Month preloading never mounts hidden components or changes visible state before activation.
- [ ] Existing Day, Week, Month, Meal Bank, modal, focus, touch, error, and persistence behavior remains functional.
- [ ] Preload failures do not create unhandled rejections and existing recovery behavior remains available.
- [ ] Electron and browser/LAN renderer builds and supported runtime checks pass.
- [ ] Focused tests, full tests, lint, builds, bundle analysis, and production timing evidence are recorded.
- [ ] Edit, Delete Confirmation, and Recipe Search preload is measured as part of the post-ready idle work, while Duplicate, Export, Slot Manager, and Add Recipe remain on demand.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Background imports compete with initial Week View work | Gate them on page readiness and use a delayed or idle-after-readiness trigger. |
| Users download views they never open | Measure usage and resource cost; preload only Day and Month initially. |
| Lazy and preload paths request the same chunk twice | Centralize each import promise and test identity and rapid activation. |
| A rejected preload breaks later view navigation | Catch background failures and preserve the existing local error boundary and retry path. |
| Retry recreates lazy wrappers and bypasses preload state | Define importer ownership separately from retryable component wrappers. |
| Edit and nested workflow chunks add more cost than value | Measure their transitive resource cost and first-use benefit; reject the preload if it breaches the Week View regression gate. |
| API prefetch creates stale or unnecessary data requests | Keep API prefetch out of scope and revisit only after measured query latency evidence. |
| Development timings misrepresent production behavior | Use optimized browser/Electron measurements and report runtime/build mode. |

## Resolved Decisions

- **Readiness boundary:** Release preloading after the primary scheduled and unscheduled meal queries plus required Meal Plan configuration/profile data are ready. This ensures the initial Week View data path has completed before background work begins.
- **Scheduling:** Use idle-after-readiness scheduling with a bounded timeout fallback. Do not use an unbounded idle callback or immediate post-readiness imports.
- **Renderer acceptance:** Evaluate browser/LAN and Electron separately. Each supported renderer must show a meaningful Day/Month activation improvement without violating the initial Week View regression gate; unavailable authenticated manual evidence must be recorded as a limitation.
- **Initial Week View regression gate:** Reject or revise the preload if it increases median initial usable Week View readiness by more than 50 ms or increases initial API activity.
- **Edit scope:** Preload Edit Modal, Delete Confirmation, and Recipe Search together during the post-ready idle window. Duplicate Meal, export, Slot Manager, and Add Recipe remain on demand.

No material implementation decisions remain open. The exact helper filenames and the bounded idle timeout are implementation details to be selected during planning and validated against the stated gates.

## Recommendation

Proceed with readiness-gated, idle-after-readiness module preloading for Day View, Month View, Edit Modal, Delete Confirmation, and Recipe Search. Keep Duplicate Meal, export, Slot Manager, and Add Recipe on demand. Keep API/data prefetching rejected for this scope. Implementation planning should preserve the 50 ms median Week View regression gate and separate browser/LAN and Electron evidence.
