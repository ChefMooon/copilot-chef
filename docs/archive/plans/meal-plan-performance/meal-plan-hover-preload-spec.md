# Meal Plan Navigation Preloading Specification

## Status

Proposed.

This specification follows the completed route-splitting work recorded in [meal-plan-route-splitting-spec-plan.md](meal-plan-route-splitting-spec-plan.md). The preload work remains independently measurable and must not be treated as a replacement for route splitting.

## Problem Statement

The Meal Plan route is loaded only when navigation occurs. On a cold first visit, the route import took approximately 957 ms in the renderer, while the Meal Plan API requests took approximately 80 ms each and ran concurrently. This creates a visible delay after the user activates the Meal Plan navigation item, even though the route can often be predicted before activation through pointer hover or keyboard focus.

The application uses React Router links in [src/renderer/components/layout/app-shell.tsx](../../../src/renderer/components/layout/app-shell.tsx) and route-level `React.lazy` imports in [src/renderer/router.tsx](../../../src/renderer/router.tsx). There is currently no explicit navigation-triggered preload for the Meal Plan route.

## Goals

- Begin loading the Meal Plan route module before navigation when the user shows clear intent to visit it.
- Reduce the cold click-to-calendar delay without eagerly loading the route for every startup.
- Target a median click-to-calendar-ready time below 400 ms for pointer and keyboard navigation when preload begins before activation.
- Support pointer hover, keyboard focus, and touch-safe behavior.
- Avoid duplicate route imports and unhandled promise rejections.
- Keep the feature independent from the route-splitting work so its benefit can be measured separately.

## Non-Goals

- Prefetching Meal Plan API data before the user navigates.
- Preloading every application route.
- Replacing React Router navigation or changing URL behavior.
- Keeping the entire Meal Plan module permanently in memory after every hover.
- Treating hover preloading as a substitute for reducing the Meal Plan route bundle.

## User Stories

- As a pointer user, when I hover over Meal Plan with intent to click, the route begins loading before activation.
- As a keyboard user, when I focus the Meal Plan navigation link, the route begins loading without requiring a pointer.
- As a touch user, navigation remains unchanged and does not depend on hover events.
- As a user who moves across navigation links without clicking, accidental short hovers do not cause excessive work or repeated downloads.
- As a user whose route preload fails, clicking Meal Plan still follows the normal route error behavior and does not leave the application in a broken state.

## Current-State Evidence

- The Meal Plan navigation item is a standard React Router `Link` in [src/renderer/components/layout/app-shell.tsx](../../../src/renderer/components/layout/app-shell.tsx).
- The route is represented by a lazy import in [src/renderer/router.tsx](../../../src/renderer/router.tsx).
- Before route splitting, the existing route diagnostic measured approximately 957 ms from route import start to completion on a cold first navigation.
- After route splitting, a development-renderer measurement recorded approximately 782 ms for route import and 161 ms from Meal Plan mount to weekly calendar readiness. The route-import duration does not include the calendar-ready duration because the latter timer starts inside `MealPlanPage`.
- The current browser production Meal Plan entry is approximately 95.73 kB minified, down from the 164.66 kB pre-split baseline. This confirms that route splitting reduced the initial asset, but it does not establish an equivalent reduction in development-server import time.
- The scheduled and unscheduled meal requests completed in approximately 72 ms and 70 ms in the latest measurement and run concurrently. The request layer is therefore not the first optimization target for this change.
- The renderer already logs route import timings with the `[meal-plan:perf]` prefix.
- The route currently has a dedicated Suspense fallback, so preloading is an optimization to hide or reduce that fallback duration rather than a replacement for it.

### Performance model

For a direct cold activation, the observed path is approximately:

`route import duration + calendar-ready duration`

For a preload that starts before activation, route loading and page initialization overlap. The expected click-to-calendar-ready time is approximately:

`max(route import duration - preload lead time, calendar-ready duration)`

These are estimates rather than acceptance results. The implementation must record click-to-ready directly instead of deriving it only by adding independent console timings.

## Scope

### Preload trigger

Add a small, reusable preload function for the Meal Plan route module. Invoke it from the Meal Plan navigation link on:

- `pointerenter`, for mouse and pen users.
- `focus`, for keyboard and assistive technology users.

The function must be idempotent and share the same import promise used by the route lazy component. It must not trigger API queries or mount the page.

### Trigger timing

Use an immediate trigger for `focus` and a 100-150 ms intent threshold for pointer hover. The threshold must be short enough to overlap route loading with normal click intent and must not delay navigation itself. Confirm the selected value with incidental-hover and click-to-ready measurements on the affected machine; adjust it only if those measurements show unnecessary downloads or insufficient overlap.

The threshold applies only to supported mouse or pen pointer events. It must not delay or intercept clicks, and a pointer leaving after the import starts must not cancel that import.

### Runtime boundaries

- The behavior must work in Electron and browser/LAN renderers.
- Touch devices must continue to navigate normally without requiring hover support.
- The preload must be safe if the route is already loaded, loading, or has failed.
- Preloading must not change auth/config readiness or query-cache behavior.

## Functional Requirements

1. Hovering the Meal Plan link with a supported pointer must start at most one route-module import for the current page lifetime.
2. Focusing the Meal Plan link must start the same shared import promise if it has not already started.
3. Clicking the Meal Plan link must reuse the in-flight or completed preload rather than initiating a second import.
4. Navigation must not wait for the preload promise to resolve.
5. A pointer leaving the link must not cancel an import that has already started.
6. A failed preload must not produce an unhandled rejection.
7. A failed preload must not prevent the normal route navigation attempt or route error handling.
8. The preload must not fire for touch-only interaction solely because a browser synthesizes compatibility events.
9. Existing navigation active states, focus behavior, and mobile navigation behavior must remain unchanged.
10. The route import timing diagnostic must continue to report a single meaningful import duration.
11. The implementation must record the preload start time, navigation activation time, and click-to-calendar-ready duration for performance comparison.

## Performance Requirements

- Measure cold navigation with preloading disabled and enabled under comparable conditions using an optimized production renderer; development-server measurements may be recorded as diagnostic context but must not be the sole acceptance evidence.
- Report the route import duration and calendar-ready duration using `[meal-plan:perf]` logs.
- Report the interval between preload start and navigation activation, plus the direct click-to-calendar-ready interval.
- Demonstrate a median click-to-calendar-ready time below 400 ms for pointer-hover and keyboard-focus navigation, or document why the route split makes the remaining preload benefit negligible.
- Report direct cold-click results separately. The 400 ms target is not a requirement that an unprepared direct click meet the same threshold.
- Treat the approximately 161 ms post-mount calendar-ready measurement as the initial lower-bound reference. If preload-assisted navigation remains above 400 ms after the route import is substantially overlapped, profile the Week View and Meal Plan initialization path before changing API or database behavior.
- Do not increase initial startup JavaScript or API work before the user shows intent to visit Meal Plan.
- Do not issue duplicate route chunk requests during hover, focus, and click combinations.

## Accessibility and UX Requirements

- Keyboard focus must trigger preloading without changing visible focus styling.
- Pointer hover must not be the only preload trigger.
- Navigation must remain usable with keyboard, screen reader, touch, and reduced-motion preferences.
- Preloading must not announce a status message because it is an invisible optimization; visible loading feedback remains the route fallback’s responsibility.
- The implementation must not move focus or intercept the click event.
- Follow the existing frontend conventions in [docs/STYLE-GUIDE.md](../../STYLE-GUIDE.md).

## Implementation Constraints

- Prefer a shared route import function rather than duplicating `import("./pages/meal-plan")` in the router and navigation component.
- Keep the shared import promise at module scope so the route and preload paths can reuse it.
- Do not use a global event listener for all navigation when a link-local handler is sufficient.
- Do not add a new dependency.
- Keep preload behavior limited to the Meal Plan route until measurements justify a broader abstraction.
- Preserve the existing route-level Suspense fallback and route error boundary.

## Validation Plan

1. Build and serve the optimized browser renderer, or run the equivalent optimized Electron renderer, with DevTools enabled and **Preserve log** active. Record the build/runtime mode because development-server module timing is not comparable to production chunk timing.
2. Test a cold pointer path: hover Meal Plan, wait for the chosen threshold, click, and record the `[meal-plan:perf]` sequence.
3. Test a cold keyboard path: tab to Meal Plan, record preload start, press Enter, and record route import and calendar readiness.
4. Test a direct click without hover and confirm navigation still works.
5. Repeat pointer and keyboard paths five times with equivalent cold-cache conditions. Report median route-import, preload-lead, click-to-calendar-ready, and calendar-ready values.
6. Test incidental pointer movement across navigation links and record whether the selected threshold avoids unnecessary Meal Plan imports.
7. Test hover, focus, and click in rapid succession and confirm only one route import occurs.
8. Test a route import failure or simulated failed chunk and confirm no unhandled rejection is emitted.
9. Verify touch/mobile navigation does not depend on pointer hover.
10. If the median intent-assisted result remains above 400 ms after preload overlap, use the existing performance marks or a focused profiler to identify Week View render, meal transformation, profile calculation, settings, or query-update costs before proposing further changes.
11. Run focused AppShell/router tests and the full test suite.
12. Re-run `npm run analyze:bundle` if this is implemented alongside route splitting.

## Acceptance Criteria

- [ ] Meal Plan preloading starts from pointer intent and keyboard focus.
- [ ] Route navigation does not wait for preload completion.
- [ ] The route and preload share one import promise with no duplicate chunk request.
- [ ] Median intent-assisted click-to-calendar-ready time is below 400 ms under documented production-renderer conditions, or the measured result explains why the remaining benefit is negligible.
- [ ] Direct cold-click timing is reported separately and remains functionally reliable even when it does not meet the intent-assisted target.
- [ ] Direct click, keyboard, touch, mobile menu, and repeated activation remain functional.
- [ ] Preload failures are handled without unhandled promise rejections.
- [ ] Existing route fallbacks, focus behavior, and error boundaries remain intact.
- [ ] Focused tests and performance measurements are recorded.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Incidental hover causes unnecessary download | Use a short intent threshold and keep the trigger limited to the Meal Plan link. |
| Duplicate imports occur | Centralize the route import promise and test hover/focus/click combinations. |
| Preloading competes with startup work | Do not preload until pointer or keyboard intent; compare startup resource activity before and after. |
| Keyboard users miss the optimization | Trigger on focus as well as pointer hover. |
| A failed preload creates an unhandled rejection | Catch and retain the failure for normal route handling, with an explicit test. |
| Route splitting makes preload less useful | Measure after route splitting; defer or remove this optimization if it adds complexity without reducing readiness time. |
| Development timings overstate production chunk cost | Use production browser/Electron renderers for acceptance measurements and label development results as diagnostic only. |
| Calendar initialization becomes the new bottleneck | Preserve the 161 ms post-mount reference, measure click-to-ready directly, and profile Week View/data transformation before changing API or database behavior. |

## Open Decisions

- **Hover delay:** Start with 100-150 ms and validate it against incidental-hover frequency and click-to-ready measurements on the affected machine.
- **Pointer trigger:** Use the short delayed pointer trigger; focus remains immediate for keyboard and assistive-technology users.
- **Idle preload:** Do not add idle preload. Keep the optimization intent-driven so startup JavaScript and network work remain unchanged until the user signals interest.
- **Timing diagnostics:** Extend the existing `[meal-plan:perf]` diagnostics with preload start, activation, and click-to-ready events while retaining one route-import duration per route lifetime.

## Handoff Notes

Implementation planning should coordinate with [meal-plan-route-splitting-spec.md](meal-plan-route-splitting-spec.md). Route splitting should be measured first or in the same experiment because it changes the amount of work preloading hides. The recommended implementation boundary is a shared Meal Plan route importer consumed by both [src/renderer/router.tsx](../../../src/renderer/router.tsx) and the Meal Plan navigation link in [src/renderer/components/layout/app-shell.tsx](../../../src/renderer/components/layout/app-shell.tsx).
