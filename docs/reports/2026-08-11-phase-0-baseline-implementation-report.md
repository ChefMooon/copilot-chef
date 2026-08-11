# Phase 0 Baseline Implementation Report

## Summary

This report confirms the repository baseline for the Local Recipe Book architecture improvement plan before implementation begins. The work in this phase is read-only and intentionally does not change application code.

## Scope and execution model

- Objective: establish a stable baseline for runtime startup, configuration precedence, and shutdown behavior before architectural ownership updates.
- Execution model: sequential phase baseline only.
- Status: complete

## Evidence reviewed

- [docs/plans/local-recipe-book-architecture-improvement-plan.md](../plans/local-recipe-book-architecture-improvement-plan.md)
- [src/main/index.ts](../../src/main/index.ts)
- [src/main/server/start.ts](../../src/main/server/start.ts)
- [src/main/server/static-web.ts](../../src/main/server/static-web.ts)
- [src/main/server/lib/lan.ts](../../src/main/server/lib/lan.ts)
- [src/main/settings/store.ts](../../src/main/settings/store.ts)
- [src/main/ipc/index.ts](../../src/main/ipc/index.ts)
- [docs/architecture.md](../architecture.md)
- [docs/copilot-chef-config.md](../copilot-chef-config.md)

## Behaviors confirmed

### Runtime mode decisions

- Electron app startup in [src/main/index.ts](../../src/main/index.ts) reads `server_mode` from settings and defaults to `local`.
- Local mode triggers `startServer()` and may also start the static browser server when `lan_web_enabled` is true.
- Remote mode is not started by the Electron embedded server; the app delegates runtime connection info via IPC registration and configuration handlers in [src/main/ipc/index.ts](../../src/main/ipc/index.ts).
- LAN/browser runtime behavior is resolved through `resolveLanRuntimeSettings()` and the static web server path in [src/main/server/lib/lan.ts](../../src/main/server/lib/lan.ts) and [src/main/server/static-web.ts](../../src/main/server/static-web.ts).

### Settings precedence and runtime state

- Settings are persisted via `getSetting`, `setSetting`, and `ensureSetting` in [src/main/settings/store.ts](../../src/main/settings/store.ts).
- The database URL precedence is:
  1. `COPILOT_CHEF_DATABASE_URL`
  2. `.env` override for the same key
  3. default user data path

  This is implemented in [src/main/server/start.ts](../../src/main/server/start.ts).

- LAN runtime behavior is derived separately rather than from one typed effective configuration object. This is an explicit architecture risk identified by the plan.

### Shutdown and quit behavior

- `app.on("before-quit", async () => ...)` in [src/main/index.ts](../../src/main/index.ts) calls `stopStaticWebServer()` and `stopServer()`.
- The close-to-tray behavior is handled by the window `close` event and does not itself shut down the runtime.
- There is no shared shutdown promise or explicit lifecycle gate guarding repeated quit requests.
- The runtime state is stored in module-level mutable variables in [src/main/server/start.ts](../../src/main/server/start.ts), confirming the plan’s identified “split ownership” risk.

### Port fallback and failure behavior

- `startServer()` resolves the current port from settings and tries the configured port, then `+1`, then `+2`, and finally `0` as the final fallback.
- Port exhaustion is surfaced as a thrown error; in-use ports are logged and retried.
- The process bootstraps the database before binding the HTTP server and then resolves config for the runtime.

## Validation evidence

### Command run

```bash
npm run test
```

### Result

- 45 test files passed
- 217 tests passed
- Exit status: success

This matches the baseline recorded in the architecture plan and serves as the fixed reference point before any implementation work.

## Risk summary

- Runtime settings and environment values are not resolved through one typed snapshot.
- Startup/shutdown ownership is split between the Electron entry point, IPC registration, and server module globals.
- Server lifecycle is stateful but not explicitly modeled.
- Electron quit cleanup is asynchronous and not guarded by a serialized shutdown promise.
- Browser/LAN runtime config can be reconstructed in more than one place, which risks mismatched API ports or host advertisements.

## Recommended next phase

The next phase should be Phase 1: effective configuration boundary. This is the first architectural boundary needed to make runtime startup and LAN/browser config reliable without reworking the whole product.

## Final status

Status: complete

No production code was modified during this phase. This baseline is ready to hand to the next implementation phase under the plan’s dependency order.
