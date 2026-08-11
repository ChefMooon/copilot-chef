# Phase 4 Database and Bootstrap Ownership Report

## Summary

This phase makes database readiness explicit and separates the bootstrap lifecycle into named operations while keeping the existing concurrency and retry behavior intact. The compatibility repair, defaults, seed policy, and runtime finalization are now independently owned and testable.

## Status

Status: complete

## What changed

- Extracted named bootstrap steps in [src/main/server/lib/bootstrap.ts](../../src/main/server/lib/bootstrap.ts):
  - `connectDatabase()`
  - `ensureDatabaseCompatibility()`
  - `applyDatabaseDefaults()`
  - `applyDatabaseSeedPolicy()`
  - `finalizeDatabaseRuntime()`
  - `initializeDatabaseRuntime()`
- Preserved the existing singleton `bootstrapDatabase()` wrapper so current callers keep working without a broad migration.
- Kept the environment seed policy contract and made it accessible for direct test coverage through `shouldSeedDatabase()`.
- Added focused bootstrap ownership tests in [src/main/server/lib/bootstrap.test.ts](../../src/main/server/lib/bootstrap.test.ts).

## Behavior implemented

- Database connection, schema compatibility repair, defaults, seed policy, and finalization each have an explicit lifecycle owner.
- A single runtime initialization still serializes concurrent callers using the existing `bootstrapPromise` gate.
- Failed initialization resets the promise so a retry can recover.
- Seed behavior remains controlled by `COPILOT_CHEF_SEED_DATABASE` and the safe default policy for production.

## Validation

Focused command run:

```bash
npm run test -- --run src/main/server/lib/bootstrap.test.ts src/main/server/services.application-graph.test.ts
```

Evidence:

- 2 test files passed
- 4 tests passed
- exit status: success

Repo-level command run:

```bash
npm run test ; npm run lint ; npm run docs:check:ipc
```

Evidence:

- 49 test files passed
- 227 tests passed
- ESLint passed
- IPC docs check passed

## Risks / open decisions

- This phase intentionally keeps the compatibility bootstrap wrapper in place to preserve existing service behavior while the architecture refactor continues.
- The next dependency-ordered phase remains Phase 5: API contracts and error boundary.

## Recommended next phase

Proceed to Phase 5: API contracts and error boundary.
