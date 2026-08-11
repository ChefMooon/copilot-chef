# Phase 6 Typed IPC and Platform Contract Report

## Summary

This phase removes the last generic string-based IPC seam by making the preload bridge and renderer platform surface type-safe and contract-driven. The main goal was to keep channel names, payloads, and renderer usage aligned with a single shared source of truth instead of drifting across `string` signatures and ad hoc platform helpers.

## Status

Status: complete

## What changed

- Added a shared runtime IPC contract in [src/shared/ipc.ts](../../src/shared/ipc.ts):
  - canonical channel list
  - typed `IpcInvokeMap`
  - typed `IpcEventMap`
  - canonical event channels for update notifications
- Exported the contract from [src/shared/index.ts](../../src/shared/index.ts) so the bridge and renderer can rely on the same boundary type definitions.
- Tightened the preload bridge in [src/preload/index.ts](../../src/preload/index.ts):
  - `window.api.invoke(...)` is now generic and channel-aware
  - `window.api.on(...)` and `window.api.off(...)` are restricted to known event channels
  - window actions remain behind the explicit typed helpers instead of raw string calls
- Updated the renderer typing in [src/renderer/vite-env.d.ts](../../src/renderer/vite-env.d.ts) so the DOM contract matches the shared bridge definition.
- Kept the platform adapter in [src/renderer/lib/platform/electron.ts](../../src/renderer/lib/platform/electron.ts) aligned with the shared contract, while preserving browser capability checks in [src/renderer/lib/platform/browser.ts](../../src/renderer/lib/platform/browser.ts) and [src/renderer/lib/platform/index.ts](../../src/renderer/lib/platform/index.ts).
- Added a focused regression in [src/shared/ipc.test.ts](../../src/shared/ipc.test.ts) to lock the canonical channel set and map shape.
- Updated the canonical IPC documentation in [docs/ipc-channels.md](../ipc-channels.md) and the drift check in [scripts/check-ipc-doc-drift.mjs](../../scripts/check-ipc-doc-drift.mjs) to reflect the shared source of truth.

## Behavior implemented

- Invalid or unknown IPC names are rejected by TypeScript at compile time instead of slipping through a raw string API.
- Renderer calls remain behind `getPlatform()` and do not execute Electron-only IPC in browser mode.
- Platform capability handling and browser/Electron runtime selection stay aligned with the same channel map.
- IPC docs remain synchronized with the actual code channel set via the repo-level drift script.

## Validation

Command run:

```bash
npm run lint ; npm run docs:check:ipc ; npm run test -- --run src/shared/ipc.test.ts src/renderer/lib/platform/browser.test.ts
```

Evidence:

- ESLint passed
- IPC docs drift check passed
- 2 test files passed
- 9 tests passed
- exit status: success

## Risks / open decisions

- This phase intentionally keeps the public IPC surface typed and stable without changing runtime behavior. The next dependency step is reliability and integration coverage in Phase 7.
- Any future IPC additions should land in the shared map first and then be reflected in the docs and renderer adapter in the same change set.

## Recommended next phase

Proceed to Phase 7: Reliability, observability, and integration coverage.
