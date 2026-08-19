# Local Recipe Book — Architecture

## 1. System Overview

Local Recipe Book is a local-first meal-planning Electron desktop application. The architecture separates the Electron main process, preload bridge, React renderer, and shared contract layer.

```
┌────────────────────────────────────────────────────────────┐
│  Electron Renderer  (React + React Router)                │
│  src/renderer/                                             │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTP to embedded local server
                           ▼
┌────────────────────────────────────────────────────────────┐
│  Electron Main Process                                     │
│  src/main/                                                 │
│                                                            │
│  ┌───────────────┐  ┌──────────────────────────────────┐  │
│  │ IPC handlers  │  │ Embedded Hono server             │  │
│  │ settings/app  │  │ routes, auth, meals, recipes     │  │
│  └───────────────┘  └──────────────┬───────────────────┘  │
│                                    │                       │
│  ┌────────────────────────────┐    │                       │
│  │ Static Web Process         │    │                       │
│  │ static-web.ts (port 4173)  │    │                       │
│  │ serves browser renderer    │    │                       │
│  └─────────────┬──────────────┘    │                       │
│                │                   │                       │
│                │            ┌──────▼──────┐                │
│                │            │  SQLite     │                │
│                │            │  (WAL mode) │                │
│                │            └─────────────┘                │
└────────────────┼───────────────────────────────────────────┘
                 │ HTTP (browser assets + SPA)
                 ▼
        ┌─────────────────┐
        │  Browser Client │  (iPad, desktop browser, etc.)
        │  LAN / local    │──→ API on port 3001 (machine token)
        └─────────────────┘
```

---

## 2. Package Responsibilities

| Package | Path | Responsibilities |
|---|---|---|
| Main process | `src/main/` | Electron lifecycle, tray, IPC, embedded Hono server, settings storage, updater integration |
| Preload | `src/preload/` | Safe contextBridge API exposed to the renderer |
| Renderer | `src/renderer/` | React pages, components, routing, API client, connection handling |
| Shared | `src/shared/` | Shared types, Zod schemas, API path constants, config helpers |

### Main process layout and startup sequence

```
index.ts           Electron entry: BrowserWindow, tray, app lifecycle
ipc/index.ts       ipcMain handlers
server/            In-process Hono server + domain logic
  start.ts         startServer() / stopServer() / getServerInfo()
  static-web.ts    Static web process for browser renderer hosting
  app.ts           Hono app factory (auth middleware, routes)
  routes/          Resource routes (meals, grocery, recipes, preferences, etc.)
  services/        Domain services (MealService, GroceryService, etc.)
  lib/             bootstrap.ts, prisma.ts, lan.ts, machine-token.ts
settings/store.ts  JSON settings persistence in userData
updates/service.ts electron-updater wiring
```

Desktop-local startup flow:
1. `app.whenReady()` resolves runtime mode from `server_mode`
2. In `local` mode, `startServer()` builds runtime token/config and starts Hono with port fallback
3. Renderer requests runtime connection details through `server:getConfig`

---

## 3. Runtime Modes

### Desktop Local Mode

The default mode. Electron renderer connects to the embedded Hono server via IPC-provided config. The API binds to `127.0.0.1`. The static web process is not started unless LAN is enabled.

### Desktop Remote Mode

The Electron renderer connects to a configured remote API URL and token from settings. The embedded server and static web process are not started.

### Browser LAN Mode

A browser client (e.g., iPad Safari) opens the URL served by the static web process (default port 4173). The browser adapter (`src/renderer/lib/platform/browser.ts`) reads connection config from `localStorage` or a QR fragment (`#/connect?api=...&token=...`). The browser uses a machine token — not the per-session desktop token.

When LAN is enabled:
- API binds to `0.0.0.0` and advertises the selected LAN IPv4 address.
- Static web process starts on port 4173.
- CORS is extended to include the static web origin.

---

## 4. Platform Abstraction

The renderer uses a `RendererPlatform` interface (`src/renderer/lib/platform/types.ts`) to avoid direct `window.api` calls outside the Electron adapter.

`getPlatform()` in `src/renderer/lib/platform/index.ts` returns the correct adapter based on whether `window.api` is present:

- **Electron adapter** (`electron.ts`) — wraps all `window.api.invoke(...)` and `window.api.on(...)` calls.
- **Browser adapter** (`browser.ts`) — reads API URL and token from `localStorage`; returns `null` or disabled states for desktop-only capabilities (updates, PDF export, LAN management).

Platform capabilities:

| Capability | Electron | Browser |
|---|---|---|
| `pdfExport` | ✓ | — |
| `updates` | ✓ | — |
| `lanManagement` | ✓ | — |
| `getServerConfig` | ✓ | ✓ (from localStorage) |
| `getSetting` / `setSetting` | ✓ | ✓ (localStorage prefix) |

Renderer runtime layout:

```
app.tsx          Root layout; loads server config via platform adapter
router.tsx       Route definitions
pages/           Page-level route components
components/      Reusable UI components
context/         Renderer state providers
lib/
  api.ts         Typed fetch wrappers
  config.ts      Runtime server config caching
  connection.ts  Health-check polling + reconnect flow
  platform/      Electron/browser runtime adapters
```

---

## 5. Data Flow

A typical read request from user action to database and back:

```
1. User action  →  React component calls useQuery(...)
2. React Query  →  lib/api.ts fetch wrapper
3. api.ts       →  GET {serverUrl}/api/meals?from=...&to=... (+ Authorization header)
4. Hono server  →  auth middleware validates Bearer token
5. Route handler →  mealService.getMeals(from, to)
6. MealService  →  bootstrap() [idempotent]  →  prisma.meal.findMany(...)
7. SQLite       →  rows returned
8. MealService  →  serialize: Date → ISO string, parse ingredientsJson
9. Route handler →  c.json(serialized rows)
10. React Query →  cache update  →  UI re-render
```

---

## 6. Request Lifecycle

Most user actions follow the same path from renderer to SQLite and back:

```
1. User action  →  React component calls query or mutation helper
2. api.ts       →  HTTP request to /api/* with Authorization header
3. Hono server  →  auth middleware validates token
4. Route        →  service method
5. Service      →  bootstrapDatabase() + Prisma query
6. SQLite       →  rows returned
7. Service      →  serialize domain response
8. Route        →  c.json(...)
9. Renderer     →  React Query cache update and UI re-render
```

---

## 7. Configuration System

The app uses two configuration paths:

1. Electron settings stored under the user data directory through `src/main/settings/store.ts`.
2. Environment variable overrides consumed by the embedded server and shared config loader.

Important compatibility environment variables include `COPILOT_CHEF_DATABASE_URL` and `COPILOT_CHEF_SERVER_PORT`. The names are retained for existing installations; they do not indicate an active Copilot runtime.

For LAN and browser access behavior, see `docs/lan-browser-access.md` and `docs/copilot-chef-config.md`.

---

## 8. Authentication Model

### Client API key

In local embedded mode, the main process generates a per-session auth token and passes it to the renderer over IPC. The renderer then includes that token in its HTTP requests to the embedded server.

In remote mode, the renderer uses the configured remote URL and API key from settings.

### LAN machine token

Browser and LAN clients authenticate using a persistent machine token stored in `machine_api_key` settings. Unlike the per-session desktop token, the machine token survives restarts and is shown to users for manual entry or QR onboarding.

Token lifecycle is managed by `src/main/server/lib/machine-token.ts`:
- `generateMachineToken()` — creates and persists a new token
- `revealMachineToken()` — returns the stored token for display
- `clearMachineToken()` — removes the token from settings

Operational details, onboarding flow, and troubleshooting are documented in `docs/lan-browser-access.md`.

---

## 9. Update System

The desktop app release currently uses a single `v{semver}` tag in the same GitHub repository.

| Component | Tag format | Example |
|---|---|---|
| Desktop app | `v{semver}` | `v1.2.0` |

### Client updates

- Powered by `electron-updater` against the GitHub publish target defined in `package.json`.
- On startup: silent check; available releases download automatically and surface a persistent global toast, including progress and a final "Install & Restart" action.
- The renderer replays the latest updater state after startup or window recreation through `updates:get-state`, so the prompt is not lost before the UI subscribes.
- Settings page: "Check for Updates" button, update status/progress, and the same explicit "Install & Restart" action.
- Browser mode and development builds do not expose desktop update controls.
- Release metadata is published through Electron Builder.

---

## 10. Database

### SQLite in WAL mode

The database is a single SQLite file (`{userData}/data/copilot-chef.db`). All database access is mediated by the Hono server process — clients never connect to SQLite directly.

WAL mode is configured at startup via raw PRAGMAs applied by `prisma.ts` after the Prisma client is initialized:

| PRAGMA | Value | Purpose |
|---|---|---|
| `journal_mode` | `WAL` | Concurrent reads during writes |
| `busy_timeout` | `5000` (ms) | Wait up to 5s on lock before failing |
| `synchronous` | `NORMAL` | Faster writes; survives process crash |
| `foreign_keys` | `ON` | Enforce FK constraints (SQLite default: off) |

### Prisma schema overview

Key models: `Meal`, `GroceryList`, `GroceryItem`, `UserPreference`, `Recipe`, `RecipeTag`, `MealLog`, `PrepList`, `PrepItem`.

`ingredientsJson` fields are stored as raw JSON strings (SQLite has no native JSON column). Always `JSON.parse`/`JSON.stringify` explicitly — Prisma does not do this automatically.

### Backup

There is no standalone database-backup command in the current package. For a file-level backup, stop the app first and copy the SQLite database from the Electron user-data directory. Include the matching `.db-wal` and `.db-shm` files when they exist, or use an SQLite-aware backup process while the app is stopped.

---

## 11. Connection Model

The renderer requires an active server connection. In local mode that server runs in the same Electron process; in remote mode it targets a configured external server.

`lib/connection.ts` exports `useServerConnection()` which:

1. Polls `GET {serverUrl}/api/health` with exponential backoff (100 ms → ... → 5 s cap)
2. Returns `{ status: "connecting" | "connected" | "disconnected", retry() }`

When disconnected:
- A banner is shown: "Server connection lost. Retrying..."
- Mutation buttons are disabled; cached UI data remains visible
- React Query caches are invalidated on reconnection

---

## 12. SQLite Concurrency Model

```
Client A ──HTTP──┐
Client B ──HTTP──┤
Browser Client ──HTTP──┼──→ Hono Server (single Node.js process)
                 │         │
                 │    ┌────┴────┐
                 │    │ Prisma  │  ← single PrismaClient instance
                 │    │ Client  │  ← serializes writes naturally (WAL)
                 │    └────┬────┘  ← concurrent reads via WAL
                 │         │
                 │    ┌────┴────┐
                 │    │ SQLite  │  ← {userData}/data/copilot-chef.db
                 │    │  (WAL)  │  ← + .db-wal  + .db-shm
                 │    └─────────┘
```

Multiple HTTP clients are handled at the HTTP layer. SQLite never sees concurrent connections from different processes. `busy_timeout = 5000` ensures a request waits up to 5 seconds for a write lock before returning an error.
