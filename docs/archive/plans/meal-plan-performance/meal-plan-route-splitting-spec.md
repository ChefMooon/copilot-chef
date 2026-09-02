# Meal Plan Route Splitting Specification

## Status

Proposed.

## Problem Statement

The first navigation to the Meal Plan page is slower than expected after application startup. Renderer diagnostics show that loading and evaluating the Meal Plan route takes substantially longer than loading its data:

| Stage | Observed duration |
|---|---:|
| Meal Plan route import | 957 ms |
| Scheduled meals query | 83 ms |
| Unscheduled meals query | 81 ms |
| Calendar readiness after page initialization | 196 ms |

The production browser build currently emits a Meal Plan JavaScript chunk of approximately 164 kB minified (42 kB gzip) and a Meal Plan CSS chunk of approximately 79 kB (14 kB gzip). The route entry statically imports multiple views, modals, drag/drop surfaces, and recipe workflows even though the default first-use path is the weekly calendar.

## Goals

- Reduce the JavaScript and initialization work required before the default weekly Meal Plan calendar can become usable.
- Preserve all existing Meal Plan functionality and navigation behavior.
- Keep the existing route-level loading skeleton or replace it with an equivalent stable fallback.
- Defer interaction-only code until the user opens the corresponding workflow.
- Measure the result using the existing `[meal-plan:perf]` diagnostics and production builds.

## Non-Goals

- Redesigning the Meal Plan UI.
- Changing meal API contracts, database queries, or SQLite behavior without separate evidence.
- Removing Day, Month, Meal Bank, recipe, export, editing, or drag/drop functionality.
- Making every component lazy by default.
- Optimizing unrelated application routes or the shared application bundle as part of this change.

## User Stories

- As a user, when I click Meal Plan for the first time after startup, I can see and use the weekly calendar as soon as the required data is available.
- As a user, when I open an edit, duplicate, export, slot-management, or recipe-search workflow for the first time, that workflow still opens reliably and communicates any short deferred load state.
- As a user, when I switch between Day, Week, and Month views, the selected view remains correct and does not lose meal data or interaction behavior.

## Current-State Evidence

- The Meal Plan route is already route-lazy-loaded in [src/renderer/router.tsx](../../../src/renderer/router.tsx), but the page statically imports its views and interaction components.
- The route entry imports `DayView`, `WeekView`, `MonthView`, `MealBankSidecar`, `EditModal`, `DuplicateMealModal`, `MenuPrintExportModal`, `SlotManagerModal`, `RecipeSearchModal`, and `AddRecipeModal` from [src/renderer/pages/meal-plan.tsx](../../../src/renderer/pages/meal-plan.tsx).
- Week View is the default calendar view.
- The route-level fallback already displays a calendar-shaped skeleton in [src/renderer/router.tsx](../../../src/renderer/router.tsx).
- Meal and unscheduled-meal requests run concurrently and completed in approximately 80 ms in the renderer, while the server reported approximately 1–2 ms for each request. This makes route module loading and renderer initialization the primary optimization target.
- The current production bundle was measured with `npm run analyze:bundle` on 2026-09-01. Re-run the command after changes rather than treating these sizes as permanent thresholds.

## Scope

### Initial Meal Plan path

The initial route should retain only code required to render the default weekly calendar and its always-visible controls. The exact boundary must be confirmed during implementation, but likely retained modules include:

- Meal Plan page orchestration.
- Week View and its required shared calendar utilities.
- Meal Bank sidecar and its required drag/drop utilities.
- Page header, navigation, loading, error, and shared UI primitives required by the initial view.

### Deferred modules

The following are candidates for on-demand loading because they are opened by explicit user actions or represent non-default views:

- Edit meal workflow.
- Duplicate meal workflow.
- Menu print/export workflow.
- Slot manager workflow.
- Recipe search and save-as-recipe workflows.
- Day View and Month View, if their shared dependencies can be separated without duplicating substantial code.

Do not split a module solely because it is listed here. Keep a module in the initial path when splitting it would duplicate shared code, introduce visible interaction delay, or make error handling less reliable.

## Functional Requirements

1. Navigating to `/meal-plan` must continue to render the current default Week View.
2. Existing route errors must continue to reach the route error boundary.
3. Loading the route must show a stable fallback with no avoidable layout shift.
4. Opening each deferred workflow must load and render the same component behavior as before.
5. A deferred workflow must not be mounted before its trigger requires it.
6. Switching calendar views must preserve the selected date, loaded meals, meal type profiles, and existing view-specific behavior.
7. Failed deferred imports must result in a recoverable user-facing error state rather than an unhandled blank region.
8. The change must work in both Electron renderer mode and browser/LAN renderer mode.
9. Existing `[meal-plan:perf]` logs must remain usable for comparing route import and calendar readiness timings.

## Performance Requirements

- The production Meal Plan route chunk should be smaller than the current approximately 164 kB minified baseline, unless measurement shows that a larger chunk produces a faster usable calendar.
- Cold first navigation should improve the `route-import-end` duration on the affected machine under the same test conditions.
- The change must not materially regress first-use latency for Edit, Duplicate, Export, Slot Manager, Recipe Search, Day View, or Month View.
- Bundle-size changes must be reported for both JavaScript and CSS where relevant.
- Measurements must be taken from a production build or equivalent optimized renderer, not only the development server.

## Accessibility and UX Requirements

- The route skeleton and deferred workflow fallbacks must preserve meaningful focus behavior.
- A loading state must not trap keyboard focus or leave the triggering control without feedback.
- Deferred imports must not cause duplicate activation when a user clicks repeatedly.
- Existing labels, keyboard interaction, drag/drop behavior, and error messages must remain intact.
- Follow the existing frontend conventions in [docs/STYLE-GUIDE.md](../../STYLE-GUIDE.md).

## Implementation Constraints

- Prefer existing React `lazy` and `Suspense` patterns used elsewhere in the renderer.
- Keep the Meal Plan page as the owner of workflow state and callbacks unless a smaller existing abstraction is a better fit.
- Use local fallbacks for deferred modal content so the whole page does not disappear while a modal chunk loads.
- Avoid changing API query keys or cache behavior as part of route splitting.
- Do not add a new bundler or runtime dependency for this change.

## Validation Plan

1. Run `npm run analyze:bundle` and record the before/after Meal Plan JavaScript and CSS assets.
2. Start the app in development mode with DevTools enabled and perform a cold first navigation.
3. Compare `[meal-plan:perf] route-import-end` and `[meal-plan:perf] calendar-ready` against the current baseline.
4. Repeat first-use interactions for Edit, Duplicate, Export, Slot Manager, Recipe Search, Day View, and Month View.
5. Run the focused Meal Plan tests and the full test suite.
6. Verify both Electron and browser/LAN builds if the shared route implementation is changed.
7. Confirm no console errors occur during route loading, deferred import failure, or view switching.

## Acceptance Criteria

- [ ] The default weekly calendar remains the first usable Meal Plan experience.
- [ ] At least one measurable reduction is shown in route import duration or initial route asset size.
- [ ] All deferred workflows remain functional on first use and subsequent use.
- [ ] Day, Week, and Month view navigation remains correct.
- [ ] Route and local loading states do not introduce unacceptable layout shift or focus problems.
- [ ] Electron and browser/LAN renderers remain functional.
- [ ] Focused tests, full tests, and bundle measurements are recorded.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| A deferred modal feels slow on first use | Use a local modal loading state and consider the separate hover/focus preload specification. |
| Shared dependencies are duplicated across chunks | Inspect bundle output and keep high-value shared modules in a common chunk. |
| Lazy import failure leaves an unusable page | Provide an error boundary or recoverable local error state around deferred content. |
| Calendar drag/drop behavior changes | Run existing Meal Plan drag/drop tests and manually verify drag lifecycle in each supported layout. |
| Development timings differ from production | Use `npm run analyze:bundle` and repeat measurements with an optimized build. |

## Open Decisions

- Should Day View and Month View be deferred immediately, or only interaction-only modals in the first phase?
- Should deferred modal loading use a compact inline fallback, a modal shell fallback, or the existing generic route fallback?
- What click-to-calendar-ready threshold defines success on the affected machine?
- Should preloading on navigation hover be delivered separately or enabled after route splitting is measured?

## Handoff Notes

Implementation planning should begin from [src/renderer/pages/meal-plan.tsx](../../../src/renderer/pages/meal-plan.tsx) and preserve the current route-level fallback in [src/renderer/router.tsx](../../../src/renderer/router.tsx). The supplied evidence supports route-level code splitting as the primary performance work; it does not support changing the meal API or database layer first.
