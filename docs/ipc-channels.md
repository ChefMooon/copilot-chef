# Local Recipe Book IPC Channels

## 1. Scope

This file is the canonical reference for Electron IPC channels.

For user-facing LAN/browser runtime behavior and token operations that use these channels, see `docs/lan-browser-access.md`.

The canonical runtime contract is defined in `src/shared/ipc.ts`. Update this file when changing any of these sources:
- `src/shared/ipc.ts`
- `src/main/ipc/index.ts`
- `src/main/updates/service.ts`
- `src/preload/index.ts`
- `src/renderer/lib/platform/electron.ts`
- `src/renderer/vite-env.d.ts`

---

## 2. Request-Response Channels

These channels use `ipcMain.handle(...)` in main and `window.api.invoke(...)` in renderer.

| Channel | Direction | Payload | Purpose | Source |
|---|---|---|---|---|
| `server:getConfig` | renderer -> main | none | Returns API URL/token/mode for renderer API calls | `src/main/ipc/index.ts` |
| `server:getStatus` | renderer -> main | none | Returns local server runtime status | `src/main/ipc/index.ts` |
| `lan:getStatus` | renderer -> main | none | Returns LAN diagnostics and machine token metadata | `src/main/ipc/index.ts` |
| `lan:restart` | renderer -> main | none | Restarts API + static web services (non-remote mode) | `src/main/ipc/index.ts` |
| `app:getVersion` | renderer -> main | none | Returns app version string | `src/main/ipc/index.ts` |
| `window:minimize` | renderer -> main | none | Minimizes focused window | `src/main/ipc/index.ts` |
| `window:toggleMaximize` | renderer -> main | none | Toggles maximize/unmaximize on focused window | `src/main/ipc/index.ts` |
| `window:isMaximized` | renderer -> main | none | Returns focused window maximize state | `src/main/ipc/index.ts` |
| `window:close` | renderer -> main | none | Closes focused window | `src/main/ipc/index.ts` |
| `app:settings:get` | renderer -> main | `key: string` | Reads a setting value by key | `src/main/ipc/index.ts` |
| `app:settings:set` | renderer -> main | `{ key, value }` | Writes a setting; may restart LAN services for related keys | `src/main/ipc/index.ts` |
| `app:settings:getAll` | renderer -> main | none | Returns all persisted settings | `src/main/ipc/index.ts` |
| `machine-token:metadata` | renderer -> main | none | Returns machine token metadata (presence/timestamp) | `src/main/ipc/index.ts` |
| `machine-token:reveal` | renderer -> main | none | Returns stored machine token value or null | `src/main/ipc/index.ts` |
| `machine-token:generate` | renderer -> main | none | Generates machine token and restarts local server when running | `src/main/ipc/index.ts` |
| `machine-token:rotate` | renderer -> main | none | Rotates machine token and restarts local server when running | `src/main/ipc/index.ts` |
| `machine-token:clear` | renderer -> main | none | Clears machine token and restarts local server when running | `src/main/ipc/index.ts` |
| `menu:exportPdf` | renderer -> main | `{ htmlContent, suggestedFileName }` | Generates a PDF and opens save dialog | `src/main/ipc/index.ts` |
| `updates:check` | renderer -> main | none | Checks for app updates | `src/main/updates/service.ts` |
| `updates:install` | renderer -> main | none | Installs downloaded update and restarts app | `src/main/updates/service.ts` |

---

## 3. Push/Event Channels

These channels use `webContents.send(...)` in main and `window.api.on(...)` in renderer.

| Channel | Direction | Payload | Purpose | Source | Renderer status |
|---|---|---|---|---|---|
| `updates:available` | main -> renderer | `UpdateInfo` | Signals update availability | `src/main/updates/service.ts` | Subscribed |
| `updates:not-available` | main -> renderer | none | Signals no update available | `src/main/updates/service.ts` | Subscribed |
| `updates:progress` | main -> renderer | `ProgressInfo` | Emits download progress | `src/main/updates/service.ts` | Not subscribed by current platform adapter |
| `updates:downloaded` | main -> renderer | `UpdateInfo` | Signals update is downloaded and ready | `src/main/updates/service.ts` | Subscribed by settings page flow |
| `updates:error` | main -> renderer | `string` | Emits update errors | `src/main/updates/service.ts` | Subscribed |

---

## 4. IPC Implementation Rules

1. Register channels in main before using them in renderer.
2. Type renderer usage through the platform layer (`src/renderer/lib/platform/electron.ts`) rather than direct page-level IPC calls.
3. Keep `window.api` surface in `src/renderer/vite-env.d.ts` aligned with preload.
4. If adding new push channels, add subscribe and unsubscribe paths in renderer.
5. Document every new channel here in the same PR as code changes.
