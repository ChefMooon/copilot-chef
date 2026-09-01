# Phase 5 API Contracts and Error Boundary Report

## Summary

This phase makes the HTTP server error behavior predictable for both the Electron renderer and browser/LAN clients. The app now uses one shared error envelope at the boundary instead of ad hoc route-specific payloads, while preserving safe behavior for auth and internal failures.

## Status

Status: complete

## What changed

- Added a shared API error contract in [src/shared/api/errors.ts](../../src/shared/api/errors.ts):
  - `ApiErrorEnvelope`
  - `ApiErrorCode`
  - `createApiErrorEnvelope()`
  - `formatZodIssues()`
- Centralized app-level error mapping in [src/main/server/app.ts](../../src/main/server/app.ts):
  - validation failures -> `VALIDATION_ERROR`
  - unauthorized requests -> `UNAUTHORIZED`
  - not-found routes -> `NOT_FOUND`
  - conflict/rate-limit signals -> their stable codes
  - unexpected failures -> safe `INTERNAL_ERROR`
- Normalized auth middleware responses in [src/main/server/middleware/auth.ts](../../src/main/server/middleware/auth.ts) to return the same machine-readable envelope.
- Exported the shared contract from [src/shared/index.ts](../../src/shared/index.ts) so the boundary is reusable by additional transports.
- Added a regression suite in [src/main/server/error-contract.test.ts](../../src/main/server/error-contract.test.ts) covering validation, auth, and unknown-route behavior.

## Behavior implemented

- HTTP failures now use a consistent JSON envelope with `ok`, `error`, `code`, and optional `requestId`/`details`.
- Validation detail paths are preserved for debugging without leaking internal stack details.
- Auth enforcement fails with `401` instead of falling through to a generic server error.
- Unknown routes return a safe 404 payload rather than a generic auth failure.
- Existing renderer/browser compatibility is preserved through a stable error payload shape while allowing a migration path to the shared envelope.

## Validation

Focused regression command run:

```bash
npm run test -- --run src/main/server/error-contract.test.ts
```

Evidence:

- 1 test file passed
- 3 tests passed
- exit status: success

Repo-level validation command run:

```bash
npm run lint ; npm run docs:check:ipc ; npm run test
```

Evidence:

- ESLint passed
- IPC docs check passed
- 50 test files passed
- 230 tests passed
- exit status: success

## Risks / open decisions

- Remaining route handlers still have inconsistent per-route payloads in some places; this phase intentionally fixes the boundary contract and keeps service-layer behavior transport-agnostic.
- The next phase is the typed IPC and platform contract, which will tighten the preload/renderer boundary without changing product behavior.

## Recommended next phase

Proceed to Phase 6: Typed IPC and platform contract.
