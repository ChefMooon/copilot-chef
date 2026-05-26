# Copilot Chef — Workspace Instructions

## Project Overview

Copilot Chef is an AI-powered meal-planning **Electron desktop app**. It is a single npm package with four source directories:

| Directory | Role |
|---|---|
| `src/main/` | Electron main process: window, tray, IPC handlers, in-process Hono server, settings store |
| `src/preload/` | contextBridge IPC surface exposed to renderer as `window.api` |
| `src/renderer/` | React UI — pages, components, routing, API client |
| `src/shared/` | Shared types, config schemas, API path constants (no runtime deps on Electron) |

---

## Documentation Map

Before making changes, review the focused documentation file for that domain.

| Topic | File | Summary |
|---|---|---|
| Development workflow and commands | `docs/developer-guide.md` | Setup, run, test, build, and feature implementation workflow |
| System architecture and runtime model | `docs/architecture.md` | Process boundaries, runtime modes, data flow, auth, and streaming model |
| Electron IPC contracts | `docs/ipc-channels.md` | Canonical request-response and push channel reference |
| App settings and environment configuration | `docs/copilot-chef-config.md` | Settings keys/defaults, env vars, and preference contracts |
| Frontend standards | `docs/copilot-chef-style-guide.md` | Visual/UX implementation standards for frontend work |
| Documentation navigation | `docs/STRUCTURE.md` | Single-page index for documentation ownership and maintenance |

For frontend or UI changes, align with `docs/copilot-chef-style-guide.md` before implementation.

---

## Working Agreement

Use focused docs as source of truth and avoid duplicating long-form details in this file:
- Commands, setup, and feature workflow: `docs/developer-guide.md`
- Runtime architecture and Copilot orchestration: `docs/architecture.md`
- IPC channel contracts: `docs/ipc-channels.md`
- Settings and configuration keys: `docs/copilot-chef-config.md`

> **Important:** `copilot login` must be run before starting the app or chat calls will fail with a 401 from the Copilot SDK.

---

## Common Pitfalls

- **Prisma generated client**: After any schema change, always run `db:push` then `db:generate`. Stale clients cause runtime type errors.
- **`ingredientsJson`**: Stored as a JSON string in SQLite — always parse/stringify when reading/writing the `Meal.ingredientsJson` field.
- **Copilot auth**: `GITHUB_TOKEN` must be set or `copilot login` must have been run; missing auth surfaces as a 401 from the SDK.
- **Streaming responses**: The chat route pipes the raw stream from the SDK. Do not buffer it — return `new Response(stream, { headers: ... })` directly.
- **IPC `app:settings:set`**: The renderer passes `{ key, value }` as a single payload object — the IPC handler destructures it.
- **Remote mode**: In remote mode, `startServer()` is skipped entirely. Switching modes requires restarting the app.
- **Tray lifecycle**: Closing the window hides it. The app only fully quits via "Quit" in the tray menu, which calls `stopServer()` via `before-quit`.
- **Prisma in packaged builds**: `electron-builder extraResources` must include `.prisma/` and `@prisma/engines/` or the packaged app will fail to find query engine binaries.
- **`window.api` direct calls**: Never call `window.api.invoke(...)` directly in renderer code outside `src/renderer/lib/platform/electron.ts`. Use `getPlatform()` from `src/renderer/lib/platform/` instead. Direct calls will throw in browser mode where `window.api` is undefined.

