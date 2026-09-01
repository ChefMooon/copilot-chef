# Phase 3 Service Graph Implementation Report

## Summary

This phase makes the application service graph explicit and removes the hidden `PrepListService` dependency on a fresh `MealService` instance. The code keeps the compatibility singleton exports while introducing a factory that constructs a single runtime-scoped graph and allows dependency injection for related services.

## Status

Status: complete

## What changed

- Added the service factory in [src/main/server/services.ts](../../src/main/server/services.ts).
- Introduced `ApplicationServices` and `createApplicationServices()` so one runtime owns a cohesive service graph.
- Updated `PrepListService` to accept an injected `MealService` instance in [src/main/server/services/prep-list-service.ts](../../src/main/server/services/prep-list-service.ts).
- Added a focused regression test in [src/main/server/services.application-graph.test.ts](../../src/main/server/services.application-graph.test.ts) to confirm the shared dependency graph and injection behavior.

## Behavior implemented

- The default exported singleton services remain available for existing route imports while the new factory provides a runtime-scoped construction path.
- `PrepListService` no longer hard-codes a private `new MealService()`; instead, it receives a shared instance from the service graph.
- The service graph is now a clear boundary for future runtime-level dependency wiring without forcing a broad rewrite of unrelated services.

## Validation

Command run:

```bash
npm run test -- --run src/main/server/lib/bootstrap.test.ts src/main/server/services.application-graph.test.ts
```

Evidence:

- 2 test files passed
- 4 tests passed
- exit status: success

## Risks / open decisions

- This stay intentionally narrow: it does not rip out all global service access yet, but it creates the explicit ownership boundary expected by the plan.
- The next step is to continue the database/bootstrap ownership refinement in Phase 4 rather than broadening the refactor beyond the dependency order.

## Recommended next phase

Proceed to Phase 4: database and bootstrap ownership.
