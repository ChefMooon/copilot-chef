# Copilot Chef — Architecture

## 1. System Overview

Copilot Chef is a meal-planning Electron desktop application. The architecture separates the Electron main process, preload bridge, React renderer, and shared contract layer.

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
│  │ settings/app  │  │ routes, auth, chat, meals, etc.  │  │
│  └───────────────┘  └──────────────┬───────────────────┘  │
│                                    │                       │
│                             ┌──────▼──────┐                │
│                             │  SQLite     │                │
│                             │  (WAL mode) │                │
│                             └─────────────┘                │
└────────────────────────────────────────────────────────────┘

                           ▲
          PA / external    │  HTTP  (X-Machine-Caller-Id header)
          callers          │
```

The PA (personal assistant) and any other machine callers reach the same Hono server on the same port, using machine-auth headers.

---

## 2. Package Responsibilities

| Package | Path | Responsibilities |
|---|---|---|
| Main process | `src/main/` | Electron lifecycle, tray, IPC, embedded Hono server, settings storage, updater integration |
| Preload | `src/preload/` | Safe contextBridge API exposed to the renderer |
| Renderer | `src/renderer/` | React pages, components, routing, API client, connection handling |
| Shared | `src/shared/` | Shared types, Zod schemas, API path constants, config helpers |

The old Tauri and Next.js package layout has been removed.

---

## 3. Data Flow

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

## 4. Chat Streaming

Chat is the most complex data path because it uses a streaming response with embedded sentinel events.

```
User sends message
  ↓
Client POST /api/chat { message, sessionId, pageContext }
  ↓
Server auth middleware validates token
  ↓
chatRoutes handler
  → CopilotChef.chat(message, sessionId) builds context in parallel:
      - current week's meals
      - active grocery list
      - user preferences
      - known recipes
  → buildSystemPrompt(context) injects live kitchen state
  → GitHub Copilot SDK sends prompt, subscribes to token events
  → TransformStream pipes deltas as UTF-8 chunks
  → Sentinel events (\x00COPILOT_CHEF_EVENT\x00{type}\x00{payload}\x00) embedded inline
  ↓
new Response(stream, { "Content-Type": "text/plain; charset=utf-8",
                       "Transfer-Encoding": "chunked" })
  ↓
Client reads stream via ReadableStreamDefaultReader
  → Text chunks appended to streaming message display
  → Sentinel events parsed → React Query cache invalidations (meals, grocery, etc.)
  → isTyping state cleared when stream ends
```

**Sentinel event format**: `\x00COPILOT_CHEF_EVENT\x00{type}\x00{payload}\x00`

The sentinel parser extracts these from the raw text stream without buffering. Non-sentinel text is appended directly to the displayed message.

---

## 5. Configuration System

Both server and client use TOML configuration files with environment variable overrides.

The app uses two configuration paths:

1. Electron settings stored under the user data directory through `src/main/settings/store.ts`.
2. Environment variable overrides consumed by the embedded server and shared config loader.

Important environment variables include `COPILOT_CHEF_DATABASE_URL`, `COPILOT_MODEL`, and the `PA_MACHINE_*` auth variables.

---

## 6. Authentication Model

### Client API key

In local embedded mode, the main process generates a per-session auth token and passes it to the renderer over IPC. The renderer then includes that token in its HTTP requests to the embedded server.

In remote mode, the renderer uses the configured remote URL and API key from settings.

### PA machine auth

Machine callers (the PA agent) also use `Authorization: Bearer <token>` but additionally send:
- `X-Machine-Caller-Id: <caller-id>` — identifies the calling agent
- `X-Machine-Source: <source>` — identifies the integration source

Routes that require machine identity use `requireMachineCallerIdentity` middleware, which rejects requests without these headers even when the Bearer token is valid.

---

## 7. Update System

The desktop app release currently uses a single `v{semver}` tag in the same GitHub repository.

| Component | Tag format | Example |
|---|---|---|
| Desktop app | `v{semver}` | `v1.2.0` |

### Client updates

- Powered by `electron-updater` against the GitHub publish target defined in `package.json`.
- On startup: silent check; notification badge shown if update available.
- Settings page: "Check for Updates" button, current version, "Install & Restart" action.
- Release metadata is published through Electron Builder.

---

## 8. Database

### SQLite in WAL mode

The database is a single SQLite file (`data/copilot-chef.db`). All database access is mediated by the Hono server process — clients never connect to SQLite directly.

WAL mode is configured at startup via raw PRAGMAs applied by `prisma.ts` after the Prisma client is initialized:

| PRAGMA | Value | Purpose |
|---|---|---|
| `journal_mode` | `WAL` | Concurrent reads during writes |
| `busy_timeout` | `5000` (ms) | Wait up to 5s on lock before failing |
| `synchronous` | `NORMAL` | Faster writes; survives process crash |
| `foreign_keys` | `ON` | Enforce FK constraints (SQLite default: off) |

### Prisma schema overview

Key models: `Meal`, `GroceryList`, `GroceryItem`, `UserPreferences`, `Recipe`, `RecipeTag`, `MealLog`, `Persona`, `ChatSession`.

`ingredientsJson` fields are stored as raw JSON strings (SQLite has no native JSON column). Always `JSON.parse`/`JSON.stringify` explicitly — Prisma does not do this automatically.

### Backup

```bash
copilot-chef-server db backup <output-path>
```

This checkpoints the WAL first (`PRAGMA wal_checkpoint(TRUNCATE)`), then copies the `.db` file to the output path. The result is a complete, consistent snapshot.

---

## 9. Connection Model

The renderer requires an active server connection. In local mode that server runs in the same Electron process; in remote mode it targets a configured external server.

`lib/connection.ts` exports `useServerConnection()` which:

1. Polls `GET {serverUrl}/api/health` with exponential backoff (100 ms → ... → 5 s cap)
2. Returns `{ status: "connecting" | "connected" | "disconnected", retry() }`

When disconnected:
- A banner is shown: "Server connection lost. Retrying..."
- Mutation buttons are disabled; cached UI data remains visible
- React Query caches are invalidated on reconnection

---

## 10. SQLite Concurrency Model

```
Client A ──HTTP──┐
Client B ──HTTP──┤
PA Agent ──HTTP──┼──→ Hono Server (single Node.js process)
                 │         │
                 │    ┌────┴────┐
                 │    │ Prisma  │  ← single PrismaClient instance
                 │    │ Client  │  ← serializes writes naturally (WAL)
                 │    └────┬────┘  ← concurrent reads via WAL
                 │         │
                 │    ┌────┴────┐
                 │    │ SQLite  │  ← data/copilot-chef.db
                 │    │  (WAL)  │  ← + .db-wal  + .db-shm
                 │    └─────────┘
```

Multiple HTTP clients are handled at the HTTP layer. SQLite never sees concurrent connections from different processes. `busy_timeout = 5000` ensures a request waits up to 5 seconds for a write lock before returning an error.
