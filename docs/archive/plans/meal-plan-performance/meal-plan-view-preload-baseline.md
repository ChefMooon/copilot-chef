# Meal Plan View Preloading Baseline

Date: 2026-09-01

## Readiness Boundary

The usable Week View boundary is the Meal Plan page rendered with a ready server
configuration and settled primary data inputs: the date-range `mealsQuery`, the
`unscheduledMealsQuery`, `mealTypeProfilesQuery`, and
`mealSubTypesQuery`. The existing Week View mount is controlled by
`view === "week"`; alternate views additionally require
`!mealsQuery.isLoading`. The implementation must preserve the existing fallback
profile behavior while waiting for the profile query to settle.

## Deferred Boundaries

`meal-plan.tsx` creates retryable lazy wrappers for Day View, Month View, Edit
Modal, Delete Confirmation, Recipe Search, Duplicate Meal, Menu Print / Export,
Slot Manager, and Add Recipe. Day and Month mount only for their selected view;
Edit, Delete Confirmation, and the other workflows mount only when their state
gates are active. `EditModal.tsx` statically imports Delete Confirmation and
Recipe Search, so those dependencies are part of the Edit workflow's transitive
module cost but are not mounted until their internal state gates open.

## Importer and Scheduling Decision

Shared cached importers will live in
`src/renderer/lib/meal-plan-deferred.ts`. Each importer owns one module-scoped
promise and returns the named export expected by the corresponding lazy
component. `meal-plan.tsx` will use the Day and Month importers for lazy
initialization and will use the five targeted importers for explicit preloading.
Retryable lazy wrapper recreation remains separate from importer ownership.

Post-readiness work will use one idle callback with a 1,000 ms timeout fallback.
The callback will be scheduled only after the readiness boundary, and its
background promises will be caught individually or as a settled batch. Repeated
effects must not schedule duplicate work, and cleanup must cancel the pending
idle callback or fallback timer.

## Automated Baseline

Command:

```text
npx vitest run src/renderer/components/meal-plan/ProfileViews.test.tsx src/renderer/pages/meal-plan.conflict-flow.test.tsx
```

Result: 2 test files passed, 28 tests passed.

Command:

```text
npm run build:web
```

Result: optimized browser renderer build passed. Existing separate deferred
assets included `DayView`, `MonthView`, `EditModal`,
`DeleteConfirmationModal`, and `RecipeSearchModal`; excluded workflows also
remained separate assets.

The optimized Electron build was invoked through `npm run build`; the command
produced the build output, but the terminal integration truncated the result
before an exit summary was available. It is therefore not counted as a passed
Electron timing or validation result here and will be rerun in final validation.

## Runtime Baseline Limitations

No authenticated browser/LAN or Electron timing sample was available in this
phase. The shared browser page was at `/connect` and reported refused API
requests, while the Electron renderer page was unavailable. Consequently,
initial Week View readiness, first Day activation, first Month activation,
startup API activity, and chunk-request timing are pending an authenticated
optimized runtime. They must be measured separately for browser/LAN and
Electron in Phase 4; unavailable checks are limitations, not passes.