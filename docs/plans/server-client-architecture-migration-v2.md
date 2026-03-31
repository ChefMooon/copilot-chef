> Historical note: This migration plan is retained for design history only. It documents the abandoned Next.js to Hono plus Tauri migration path and no longer reflects the current Electron app layout or release process. See `docs/architecture.md`, `docs/developer-guide.md`, and `docs/release-guide.md` for the current source of truth.

# Server-Client Architecture Migration Plan (v2 — SQLite)

> This document is a complete migration guide for restructuring Copilot Chef from a Next.js fullstack app into a standalone Hono API server + Tauri v2 desktop client, using **SQLite** (with WAL mode) as the database.
>
> This document is a complete migration guide for restructuring Copilot Chef from a Next.js fullstack app into a standalone Hono API server + Tauri v2 desktop client. It is intended for implementing agents working in parallel across defined phases. Each phase has explicit prerequisites, checkpoints, and verification steps. **Agents must not install packages.** If a phase requires new packages, it will say **ASK USER** — the user must install them before the agent begins that phase.

---

## Why SQLite Is Viable Here

SQLite is often dismissed for "multi-user" scenarios, but the architecture of this project eliminates the classic problems:

1. **Single writer process**: All clients connect to the Hono API server over HTTP. The server is the **only** process that opens the SQLite file. There is no client-to-database direct access. This is the same architecture used by projects like Lichess, Pihole, Expensify, and many others that serve thousands of concurrent users from a single SQLite database behind an API server.

2. **Low write volume**: A meal planning app generates a handful of writes per user interaction (create a meal, check off a grocery item). SQLite in WAL mode handles hundreds of writes per second — orders of magnitude more than this app will ever need.

3. **Read-heavy workload**: Viewing meal plans, browsing recipes, and loading grocery lists are all reads. SQLite in WAL mode allows unlimited concurrent readers alongside a single writer with zero contention.

4. **Zero infrastructure**: No database server to install, configure, back up, or version-manage. The app defaults to `file:./data/copilot-chef.db` with no env setup required. The database file can be copied, moved, or backed up by simply copying a single file.

### SQLite Concurrency Protections (Applied in Phase 0)

| Protection | What It Does |
|---|---|
| `PRAGMA journal_mode = WAL` | Write-Ahead Logging. Allows reads while a write is in progress. Default SQLite mode blocks readers during writes. |
| `PRAGMA busy_timeout = 5000` | If the database is locked, wait up to 5 seconds before returning SQLITE_BUSY. Prevents spurious failures under concurrent requests. |
| `PRAGMA synchronous = NORMAL` | Slightly relaxed durability (data survives process crash but not OS crash). Significant write performance improvement. Safe for an app where the worst case is re-entering one meal. |
| `PRAGMA foreign_keys = ON` | Enforce FK constraints (SQLite disables these by default). Already needed for cascading deletes. |
| Single PrismaClient instance | Prisma's SQLite connector uses a single connection. Combined with WAL mode, this serializes writes naturally while allowing concurrent reads. |

### When Would You Outgrow SQLite?

- Hundreds of simultaneous clients sustaining high write throughput (not this app)
- Need for full-text search with complex ranking (Prisma `contains` is fine for this scale)
- Multi-server horizontal scaling (this is a single-server LAN app)
- Complex transactions with row-level locking (meal planning doesn't need this)

If any of these become real concerns in the future, migrating from SQLite to PostgreSQL via Prisma is a schema provider swap — the service layer stays identical.

---

## Prerequisites — Packages to Install Before Starting

> **IMPORTANT FOR ALL AGENTS**: Do not run `npm install`, `npm add`, `cargo install`, or any package installation commands. All packages listed below must be installed by the user before the relevant phase begins. If you reach a step that requires a package not yet installed, stop and ask the user to install it.

### System-Level Tools (install once)

| Tool | Version | Install Command | Needed For |
|---|---|---|---|
| **Node.js** | >= 20.x | https://nodejs.org | Everything |
| **npm** | >= 10.x | Ships with Node.js | Everything |
| **Rust toolchain** | stable (>= 1.75) | `rustup` from https://rustup.rs | Tauri client (Phase 3) |
| **Tauri CLI** | v2 | `cargo install tauri-cli --version "^2"` | Tauri client (Phase 3) |

> **Note**: No PostgreSQL installation required. SQLite is embedded — no external database server needed.

### npm Packages by Phase

Agents will modify `package.json` files to declare dependencies, but the **user must run `npm install`** after each phase's package.json changes before agents proceed with implementation.

#### Phase 1: Shared Package (`src/shared/`)

```
# New package — user creates src/shared/ directory, then runs npm install from root after package.json is written
Dependencies:
  zod                   (already in workspace via core)
  smol-toml             ^1.3.1

DevDependencies:
  typescript            (already in workspace)
  vitest                (already in workspace)
```

#### Phase 2: Server Package (`src/server/`)

```
Dependencies:
  hono                  ^4.7.0
  @hono/node-server     ^1.14.0
  @copilot-chef/core    *          (workspace)
  @copilot-chef/shared  *          (workspace)

DevDependencies:
  typescript            (already in workspace)
  tsx                   (already in workspace via core)
  vitest                (already in workspace)
  @types/node           (already in workspace)
```

#### Phase 3: Client Package (`src/client/`)

```
Dependencies:
  react                 ^19.0.0   (already in workspace via web)
  react-dom             ^19.0.0   (already in workspace via web)
  react-router          ^7.0.0
  @tanstack/react-query ^5.68.0   (already in workspace via web)
  @radix-ui/react-alert-dialog    (already in workspace via web)
  @radix-ui/react-slot             (already in workspace via web)
  @radix-ui/react-toast            (already in workspace via web)
  class-variance-authority          (already in workspace via web)
  clsx                              (already in workspace via web)
  lucide-react                      (already in workspace via web)
  recharts                          (already in workspace via web)
  tailwind-merge                    (already in workspace via web)
  @copilot-chef/shared  *          (workspace)

  # Tauri APIs (installed via npm, used in frontend JS)
  @tauri-apps/api       ^2.0.0
  @tauri-apps/plugin-updater  ^2.0.0
  @tauri-apps/plugin-shell    ^2.0.0
  @tauri-apps/plugin-fs       ^2.0.0

DevDependencies:
  vite                  ^6.0.0
  @vitejs/plugin-react  ^4.0.0
  typescript            (already in workspace)
  vitest                (already in workspace)
  @testing-library/react (already in workspace via web)
  jsdom                  (already in workspace via web)
  tailwindcss            (already in workspace via web)
  postcss                (already in workspace via web)
  autoprefixer           (already in workspace via web)

# Tauri Rust plugins — added to src/client/src-tauri/Cargo.toml
  tauri                 ^2.0
  tauri-plugin-updater  ^2.0
  tauri-plugin-shell    ^2.0
  tauri-plugin-fs       ^2.0
```

#### Root Package Updates

```
# Root package.json — add to devDependencies
  concurrently          ^9.1.0    (for unified dev command)

# Root package.json — add to workspaces array
  "src/shared"
  "src/server"
  "src/client"
```

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend framework | **Hono** | Lightweight, native streaming, TypeScript-first, moderate migration from Next.js routes |
| Client framework | **Tauri v2 + Vite + React** | Smaller footprint than Electron, thin client model, native updater plugin |
| Client-server startup | **Both modes** | Client can launch embedded server OR connect to remote. Config toggle |
| Server distribution | **npm package + optional Docker** | Familiar dev experience, easy updates. Docker for server deployment |
| Database | **SQLite (WAL mode)** | Zero infrastructure, single-file backup, sufficient for LAN/multi-client via server-mediated access. Easy setup — no external database server required. |
| LAN security | **API key/token** | Simple shared secret, appropriate for home/office LAN |
| Client offline mode | **Not supported** | Client requires active server connection. Graceful degradation on disconnect |
| Dev experience | **Unified + separate** | `npm run dev` starts both (concurrently), individual `dev:server` / `dev:client` available |
| Update system | **Single GitHub repo, separate tag prefixes** | `server-v*` and `client-v*` tags, same release feed |
| Package installation | **User only** | Agents must never install packages. Ask the user |

---

## Architecture Overview

### Post-Migration Structure

```
copilot-chef/
├── src/core/          @copilot-chef/core       (Prisma, services, CopilotChef — SQLite with WAL mode)
├── src/server/        @copilot-chef/server     (NEW — Hono API server)
├── src/client/        @copilot-chef/client     (NEW — Tauri + Vite + React desktop app)
├── src/shared/        @copilot-chef/shared     (NEW — shared types, config schemas, API contract)
├── data/              copilot-chef.db           (SQLite database file — gitignored)
├── docs/
│   ├── architecture.md                         (NEW — how the app works)
│   └── developer-guide.md                      (NEW — how to work on it)
└── src/web/           @copilot-chef/web        (DEPRECATED — removed after migration verified)
```

### Data Flow

```
User Action
  → Tauri Client (React UI)
    → HTTP Request (with API key header)
      → Hono Server (auth middleware → route handler)
        → Core Service (bootstrap → Prisma query → serialize)
          → SQLite (WAL mode, single file)
        ← Response (JSON or ReadableStream)
      ← HTTP Response
    ← React Query cache update
  ← UI re-render
```

### Chat Streaming Flow

```
User sends message
  → Client POST /api/chat { message, sessionId, pageContext }
    → Server creates/resumes CopilotChef session
      → buildContext() parallel-fetches meals, grocery, prefs, recipes
      → buildSystemPrompt() injects live kitchen state
      → SDK sends prompt, subscribes to events
      → TransformStream pipes deltas as UTF-8 chunks
      → Sentinel events (\x00COPILOT_CHEF_EVENT\x00) embedded in stream
    ← ReadableStream response (Transfer-Encoding: chunked)
  → Client reads stream chunks in real-time
    → Parses sentinel events → triggers domain refreshes (React Query invalidation)
    → Appends text chunks to streaming message display
```

### SQLite Concurrency Model

```
Client A ──HTTP──┐
Client B ──HTTP──┤
Client C ──HTTP──┼──→ Hono Server (single Node.js process)
PA Agent ──HTTP──┤         │
                 │    ┌────┴────┐
                 │    │ Prisma  │  ← single PrismaClient instance
                 │    │ Client  │  ← serialized writes (WAL mode)
                 │    └────┬────┘  ← concurrent reads (WAL mode)
                 │         │
                 │    ┌────┴────┐
                 │    │ SQLite  │  ← single .db file
                 │    │  (WAL)  │  ← copilot-chef.db + .db-wal + .db-shm
                 │    └─────────┘
```

All database access is mediated by the single server process. SQLite never sees concurrent connections from different processes — the "multiple clients" pattern is handled entirely at the HTTP layer.

---

## Phase Dependency Graph

```
Phase 0 (SQLite + WAL Hardening)
  ↓
Phase 1 (Shared Package)
  ↓
  ├→ Phase 2 (Server)     ←── can run in PARALLEL
  └→ Phase 3 (Client)     ←── can run in PARALLEL
       ↓        ↓
       └────┬───┘
            ↓
      Phase 4 (Update System)
            ↓
      Phase 5 (Documentation)
            ↓
      Phase 6 (Migration & Cleanup)
```

**Parallelization rules:**
- Phase 2 and Phase 3 can be worked on simultaneously by different agents after Phase 1 is complete
- Within Phase 2, route porting steps (2.3) can be parallelized across route groups
- Phase 4 depends on both Phase 2 and Phase 3 having their scaffolding complete
- Phase 5 (docs) can be started during Phase 2/3 but finalized after Phase 4
- Phase 6 is strictly sequential and last

---

## Phase 0: SQLite + WAL Hardening

> **Goal**: Configure the Prisma schema for SQLite, apply WAL mode and concurrency-safe PRAGMAs, and verify everything works. This must complete before architectural changes begin.

### Prerequisites

- [ ] No database env var required (defaults to `file:./data/copilot-chef.db`)

### Step 0.1: Set Prisma schema provider to SQLite

Set the datasource in `src/core/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("COPILOT_CHEF_DATABASE_URL")
}
```

### Step 0.2: Verify schema compatibility with SQLite

Review the schema for anything that needs adjusting for SQLite compatibility:

- **Enums**: SQLite doesn't support native enums. Prisma emulates them with `CHECK` constraints on `String` fields. If the schema uses `enum MealType`, Prisma handles this transparently for SQLite — no code changes needed, but verify after `db:push`.
- **JSON fields**: Already stored as `String` with manual `JSON.parse`/`JSON.stringify` — this is correct for SQLite. Do not change.
- **DateTime handling**: SQLite stores dates as ISO strings. Prisma abstracts this — no code changes.
- **Boolean fields**: SQLite stores as 0/1. Prisma abstracts — no code changes.
- **`@@index` directives**: SQLite supports indexes. Keep them as-is.

### Step 0.3: Update prisma.ts with WAL mode and concurrency PRAGMAs

Replace `src/core/src/lib/prisma.ts` with a version that:

1. Uses `COPILOT_CHEF_DATABASE_URL` if provided, otherwise defaults to `file:./data/copilot-chef.db`
2. Configures WAL mode and performance PRAGMAs after client initialization
3. Keeps the existing global singleton pattern

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const databaseUrl =
  process.env.COPILOT_CHEF_DATABASE_URL ?? "file:./data/copilot-chef.db";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (!globalForPrisma.prisma) {
  // Configure SQLite for concurrent access safety.
  // These PRAGMAs persist for the lifetime of the connection.
  prisma
    .$executeRawUnsafe("PRAGMA journal_mode = WAL")
    .then(() => prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000"))
    .then(() => prisma.$executeRawUnsafe("PRAGMA synchronous = NORMAL"))
    .then(() => prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON"))
    .catch((err: unknown) => {
      console.error("Failed to set SQLite PRAGMAs:", err);
    });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### Step 0.4: Optional env overrides (only if custom path is needed)

No `.env` file is required for the default SQLite path.

If a custom path is needed, set one of:

- `COPILOT_CHEF_DATABASE_URL=file:./custom.db`

### Step 0.5: Review bootstrap.ts and seed.ts

Review `src/core/src/lib/bootstrap.ts` and `src/core/src/lib/seed.ts`:
- Verify seed data uses Prisma's cross-database API only (no raw SQL)
- Confirm the bootstrap idempotency check works with SQLite

### Step 0.6: Run database setup

**ASK USER** to run:

```bash
npm run db:push
npm run db:generate
npm run db:seed
```

### Step 0.7: Run existing tests

Run `npm run test` to verify all core and web tests still pass with SQLite.

### Checkpoint 0

- [ ] Prisma schema uses `provider = "sqlite"`
- [ ] `prisma.ts` sets WAL mode, busy_timeout, synchronous, and foreign_keys PRAGMAs
- [ ] Database connection works with default `file:./data/copilot-chef.db` or an explicit override
- [ ] `npm run db:push` succeeds against SQLite
- [ ] `npm run db:generate` succeeds
- [ ] `npm run db:seed` populates data
- [ ] `npm run test` passes (all core and web tests)
- [ ] Dev server (`npm run dev`) starts and all pages work against SQLite
- [ ] WAL mode is active (verify: `copilot-chef.db-wal` file appears next to the database after first write)

---

## Phase 1: Foundation — Shared Package & Config System

> **Goal**: Establish shared types, API contract, and configuration schema before moving code. This phase produces the foundation that both server and client depend on.

### Prerequisites

- [ ] Phase 0 complete (SQLite configured with WAL mode)
- [ ] **ASK USER**: Run `npm install` after the agent writes `src/shared/package.json` and updates root `package.json` workspaces

### Step 1.1: Create `@copilot-chef/shared` package

Create `src/shared/` with:

**`src/shared/package.json`**:
- Name: `@copilot-chef/shared`
- Type: `module`
- Main/exports: `dist/index.js`
- Dependencies: `zod`, `smol-toml`
- Scripts: `build` (tsc), `test` (vitest)

**`src/shared/tsconfig.json`**: Extends `../../tsconfig.base.json`

**`src/shared/src/index.ts`**: Re-exports everything below

### Step 1.2: Define config schemas

**`src/shared/src/config/server-config.ts`**:

```ts
const ServerConfigSchema = z.object({
  server: z.object({
    port: z.number().default(3001),
    host: z.string().default("127.0.0.1"),
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  }),
  database: z.object({
    url: z.string().default("file:./data/copilot-chef.db"),
  }),
  auth: z.object({
    tokens: z.array(z.string()).default([]),
    copilotModel: z.string().default("gpt-4o-mini"),
  }),
  updates: z.object({
    feedUrl: z.string().default(""),
    checkOnStartup: z.boolean().default(true),
  }),
  cors: z.object({
    origins: z.array(z.string()).default(["tauri://localhost", "http://localhost:5173"]),
  }),
});
```

**`src/shared/src/config/client-config.ts`**:

```ts
const ClientConfigSchema = z.object({
  connection: z.object({
    serverUrl: z.string().default("http://localhost:3001"),
    apiKey: z.string().default(""),
    autoLaunchServer: z.boolean().default(true),
    serverBinaryPath: z.string().default(""),
  }),
  updates: z.object({
    checkOnStartup: z.boolean().default(true),
  }),
  ui: z.object({
    theme: z.enum(["system", "light", "dark"]).default("system"),
  }),
});
```

### Step 1.3: Config file loaders

**`src/shared/src/config/loader.ts`**:
- `loadServerConfig(configPath?)` — reads TOML file, merges env var overrides (prefixed `COPILOT_CHEF_`), validates with Zod
- `loadClientConfig(configPath?)` — same pattern
- Config file search order: explicit path → CWD → app data dir → home dir
- Env var mapping: `COPILOT_CHEF_SERVER_PORT` → `server.port`, `COPILOT_CHEF_DATABASE_URL` → `database.url`, etc.

### Step 1.4: API contract types

**`src/shared/src/api/types.ts`**:
- Request/response types for all 14 API route groups, mirroring current shapes
- Export `ApiPaths` constant object mapping route names to URL paths
- Export `SENTINEL_PREFIX` constant

**`src/shared/src/api/constants.ts`**:
- `MEAL_TYPES`, `GROCERY_CATEGORIES`, `GROCERY_UNITS`
- Move these from `src/web/src/lib/calendar.ts` and `src/web/src/lib/grocery.ts`

### Step 1.5: Move shared Zod schemas

Move from `src/core/src/schemas/`:
- `chat.ts` schemas (message, choice, action, response)
- `recipe-schemas.ts` (CreateRecipeInput, UpdateRecipeInput, etc.)

Keep re-exports in `src/core/src/schemas/` pointing to `@copilot-chef/shared` so existing imports don't break.

### Step 1.6: Update root package.json

- Add `src/shared`, `src/server`, `src/client` to `workspaces` array
- Add scripts:
  - `"dev:server": "npm run dev --workspace @copilot-chef/server"`
  - `"dev:client": "npm run dev --workspace @copilot-chef/client"`
  - `"dev:all": "concurrently \"npm:dev:server\" \"npm:dev:client\""`
  - `"build:shared": "npm run build --workspace @copilot-chef/shared"`
  - `"build:server": "npm run build --workspace @copilot-chef/server"`
  - `"build:client": "npm run build --workspace @copilot-chef/client"`
  - `"test:server": "npm run test --workspace @copilot-chef/server"`
  - `"test:client": "npm run test --workspace @copilot-chef/client"`

**ASK USER**: Run `npm install` after these changes.

### Step 1.7: Write config loader tests

**`src/shared/src/config/__tests__/loader.test.ts`**:
- Test TOML parsing → typed config
- Test env var overrides
- Test default fallbacks
- Test validation errors for invalid config

### Checkpoint 1

- [ ] `src/shared/` package exists with config schemas, API types, shared constants
- [ ] `npm run build --workspace @copilot-chef/shared` succeeds
- [ ] Config loader tests pass
- [ ] `src/core` schemas re-export from `@copilot-chef/shared` — existing imports still work
- [ ] `npm run test` passes (all packages, including core and web — no regressions)

---

## Phase 2: Server Package — Hono API

> **Goal**: Port all Next.js API routes to a standalone Hono server. Core services are already decoupled — this is primarily route translation. The existing `src/web/` continues working throughout this phase.
>
> **Parallelization**: Steps 2.3a through 2.3n (individual route groups) can be done in parallel by separate agents. Each route group is independent. Steps 2.1 and 2.2 must complete first.

### Prerequisites

- [ ] Phase 1 complete (shared package built and tests passing)
- [ ] **ASK USER**: Run `npm install` after the agent writes `src/server/package.json`

### Step 2.1: Scaffold Hono server

**`src/server/package.json`**:
- Name: `@copilot-chef/server`
- Dependencies: `hono`, `@hono/node-server`, `@copilot-chef/core`, `@copilot-chef/shared`
- Bin: `"copilot-chef-server": "dist/cli.js"`
- Scripts: `dev` (tsx watch), `build` (tsc), `start` (node dist/index.js), `test` (vitest)

**`src/server/tsconfig.json`**: Extends base, outDir `dist/`

**`src/server/src/app.ts`**: Hono app instance with middleware:
1. Request logger
2. CORS (origins from config)
3. Error handler (catch-all, returns JSON error)
4. Auth middleware (validate API key/token from `Authorization: Bearer <token>` header)

**`src/server/src/index.ts`**: Entry point:
1. Load server config via `loadServerConfig()`
2. Call `bootstrapDatabase()` from core
3. Start Hono on configured port/host via `@hono/node-server`
4. Log startup message with port, host, version, and confirm WAL mode is active

### Step 2.2: Create service singletons and health route

**`src/server/src/services.ts`**: Module-level singleton instances (mirrors `src/web/src/lib/chat-singletons.ts`):
```ts
export const chef = new CopilotChef();
export const historyService = new ChatHistoryService();
export const preferenceService = new PreferenceService();
export const groceryService = new GroceryService();
export const mealService = new MealService();
export const recipeService = new RecipeService();
export const personaService = new PersonaService();
export const mealLogService = new MealLogService();
```

**`src/server/src/routes/health.ts`**: `GET /api/health` → `{ status: "ok", version: pkg.version, uptime: process.uptime(), database: "sqlite" }`

### Step 2.3: Port API routes

Each route group is an independent file. Agents working in parallel should each pick a different group. Follow this pattern for every route:

1. Read the existing Next.js route handler in `src/web/src/app/api/<route>/route.ts`
2. Create the equivalent Hono route in `src/server/src/routes/<route>.ts`
3. Use Hono's `c.req.query()`, `c.req.json()`, `c.req.param()` instead of `NextRequest`
4. Return `c.json(data)` instead of `NextResponse.json(data)`
5. For streaming: return `new Response(stream, { headers })` directly (Hono passes it through)
6. Write tests in `src/server/src/routes/__tests__/<route>.test.ts` mirroring existing web tests

**Route groups to port (each is one agent task):**

#### 2.3a: Meals routes
- Source: `src/web/src/app/api/meals/route.ts`, `src/web/src/app/api/meals/[id]/route.ts`
- Target: `src/server/src/routes/meals.ts`
- Methods: GET (range query via `from`/`to`), POST (create), GET/:id, PUT/:id, DELETE/:id
- Tests: Port any existing meal route tests

#### 2.3b: Grocery list routes
- Source: `src/web/src/app/api/grocery-lists/` (all files)
- Target: `src/server/src/routes/grocery-lists.ts`
- Methods: GET (with `current` flag), POST, GET/:id, PUT/:id, DELETE/:id, plus item sub-routes (add/update/delete/reorder items)
- Tests: Port existing grocery tests

#### 2.3c: Recipe routes
- Source: `src/web/src/app/api/recipes/` (all files including `[id]/`, `export/`, `grocery/`)
- Target: `src/server/src/routes/recipes.ts`
- Methods: GET (filters: query, origin, difficulty, maxCookTime, rating, tags), POST, GET/:id, PUT/:id, DELETE/:id, POST/:id/rating, POST/export, POST/grocery, POST/grocery/new
- Tests: Port existing recipe tests

#### 2.3d: Preferences routes
- Source: `src/web/src/app/api/preferences/` (all files)
- Target: `src/server/src/routes/preferences.ts`
- Methods: GET, PATCH, POST/reset, GET/detect-region, GET/export
- Tests: Port existing preference route tests

#### 2.3e: Chat routes (CRITICAL — streaming)
- Source: `src/web/src/app/api/chat/route.ts`, `respond-to-input/route.ts`, `end-session/route.ts`, `src/web/src/app/api/chat/` (delete history)
- Target: `src/server/src/routes/chat.ts`
- Methods: POST /api/chat (streaming + JSON responses), POST /api/chat/respond-to-input, POST /api/chat/end-session, DELETE /api/chat/history
- **Key**: The streaming response uses `new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" } })`. This works identically in Hono.
- **Key**: Sentinel events (`\x00COPILOT_CHEF_EVENT\x00`) are embedded in the stream. Do not modify this protocol.
- **Key**: The chat route has complex command parsing (undo, redo, plan week, direct meal/grocery operations). Port all of this logic exactly.
- Tests: Port existing chat route tests — these are the most important tests

#### 2.3f: Chat session routes
- Source: `src/web/src/app/api/chat-sessions/` (all files)
- Target: `src/server/src/routes/chat-sessions.ts`
- Methods: GET, POST, GET/:id, PUT/:id, DELETE/:id
- Include machine auth enforcement (uses `requireMachineCallerIdentity`)
- Tests: Port existing chat session tests

#### 2.3g: Persona routes
- Source: `src/web/src/app/api/personas/` (all files)
- Target: `src/server/src/routes/personas.ts`
- Methods: GET, POST, GET/:id, PUT/:id, DELETE/:id
- Tests: Write new tests

#### 2.3h: Meal log routes
- Source: `src/web/src/app/api/meal-logs/route.ts`
- Target: `src/server/src/routes/meal-logs.ts`
- Methods: GET (with `weeks`/`recent` query params), POST
- Tests: Write new tests

#### 2.3i: Stats routes
- Source: `src/web/src/app/api/stats/route.ts`, `meal-summary/route.ts`
- Target: `src/server/src/routes/stats.ts`
- Methods: GET /api/stats, GET /api/stats/meal-summary
- Tests: Write new tests

#### 2.3j: Session probe route
- Source: `src/web/src/app/api/session-probe/`
- Target: `src/server/src/routes/session-probe.ts`
- Tests: Write new tests

### Step 2.4: Port auth middleware

**`src/server/src/middleware/auth.ts`**:
- Adapt `src/web/src/lib/machine-auth.ts` to Hono middleware
- Support two auth modes:
  - **Client API key**: `Authorization: Bearer <key>` validated against `config.auth.tokens`
  - **PA machine token**: Same header, but with additional `X-Machine-Caller-Id` and `X-Machine-Source` headers
- Apply globally: `app.use("/api/*", authMiddleware)` (except `/api/health` which is public)
- Port machine auth tests from `src/web/src/lib/machine-auth.test.ts`

### Step 2.5: Server CLI

**`src/server/src/cli.ts`**:
- Parse args: `start` (default), `update`, `version`, `config`, `db`
- `start`: call main `index.ts` entry point
- `version`: print package version
- `config`: load and print resolved config (with secrets redacted)
- `db`: subcommands for database management:
  - `db status`: print database path, file size, WAL mode status
  - `db backup <path>`: copy the `.db`, `.db-wal`, and `.db-shm` files atomically (checkpoint WAL first via `PRAGMA wal_checkpoint(TRUNCATE)`, then copy the single `.db` file)
- `update`: (see Step 2.6)
- Register as bin in package.json: `"copilot-chef-server": "./dist/cli.js"`

### Step 2.6: Server update mechanism

**`src/server/src/updater.ts`**:
- `checkForUpdate()`: GET GitHub Releases API, filter for `server-v*` tags, compare semver with current version
- On startup (if `config.updates.checkOnStartup`): call `checkForUpdate()`, print notice if newer version exists
- `update` CLI command: download tarball asset from latest release, `npm install` to target dir, print instructions to restart
- Do not auto-restart — print message telling user to restart the service

### Checkpoint 2

- [ ] `src/server/` package exists with all route files
- [ ] `npm run build --workspace @copilot-chef/server` succeeds
- [ ] `npm run dev:server` starts Hono on configured port
- [ ] `GET /api/health` returns `{ status: "ok", version, uptime, database: "sqlite" }`
- [ ] Every API endpoint returns identical responses to the Next.js equivalents (verify with manual testing or a parity test script)
- [ ] Chat streaming works: POST /api/chat returns chunked stream with sentinel events
- [ ] Auth middleware rejects unauthenticated requests (when tokens configured)
- [ ] Server CLI: `copilot-chef-server version`, `copilot-chef-server config`, `copilot-chef-server db status` work
- [ ] All server route tests pass: `npm run test:server`
- [ ] Core and web tests still pass (no regressions): `npm run test`

---

## Phase 3: Client Package — Tauri + Vite + React

> **Goal**: Port the Next.js frontend to a Tauri desktop app. Replace App Router with React Router. Remove all SSR. The client requires an active server connection — no offline mode.
>
> **Parallelization**: Steps 3.4a through 3.4h (page porting) can be done in parallel by separate agents after Steps 3.1–3.3 are complete.
>
> **Can run in parallel with Phase 2** after Phase 1 is complete. The client can be developed against the existing Next.js backend initially, then switch to the Hono server once Phase 2 is done.

### Prerequisites

- [ ] Phase 1 complete (shared package built and tests passing)
- [ ] Rust toolchain installed (`rustup` + stable Rust)
- [ ] Tauri CLI installed (`cargo install tauri-cli --version "^2"`)
- [ ] **ASK USER**: Run `npm install` after the agent writes `src/client/package.json`

### Step 3.1: Scaffold Tauri project

**`src/client/package.json`**:
- Name: `@copilot-chef/client`
- Dependencies: React 19, React Router, TanStack Query, Radix UI, CVA, clsx, lucide-react, recharts, tailwind-merge, `@copilot-chef/shared`, Tauri APIs
- DevDependencies: Vite, @vitejs/plugin-react, TypeScript, Vitest, testing-library, jsdom, Tailwind, PostCSS
- Scripts: `dev` (vite), `build` (vite build), `test` (vitest), `tauri` (tauri)

**`src/client/vite.config.ts`**:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
```

**`src/client/src-tauri/tauri.conf.json`**:
- App identifier, version, window config (1200x800)
- `frontendDist: "../dist"`, `devUrl: "http://localhost:5173"`
- Plugins: updater (with endpoint + pubkey), shell (for embedded server), fs (for config)

**`src/client/src-tauri/Cargo.toml`**: Tauri v2, plugin deps

**`src/client/src-tauri/src/main.rs`**: Minimal Tauri setup registering plugins

**`src/client/tsconfig.json`**: Extends base, path aliases matching `@/`

### Step 3.2: Entry point and router

**`src/client/src/main.tsx`**: React root render with `<RouterProvider>`

**`src/client/src/router.tsx`**: Route definitions:
```
/                       → HomePage
/meal-plan              → MealPlanPage
/grocery-list           → GroceryListPage
/grocery-list/shop/:id  → ShoppingPage
/recipes                → RecipesPage
/recipes/:recipeId      → RecipeDetailPage
/stats                  → StatsPage
/settings               → SettingsPage
```

**`src/client/src/app.tsx`**: Root layout with `<AppShell>`, `<ChatProvider>`, `<QueryProvider>`, `<Outlet />`

### Step 3.3: Port shared infrastructure

These must be done before page porting:

**Styling**:
- Copy `tailwind.config.ts`, `postcss.config.mjs`, `globals.css` from web package
- Copy all CSS Module files (`.module.css`)
- Vite handles CSS Modules natively

**UI primitives** (direct copy — no Next.js deps):
- `src/client/src/components/ui/button.tsx`
- `src/client/src/components/ui/input.tsx`
- `src/client/src/components/ui/textarea.tsx`
- `src/client/src/components/ui/alert-dialog.tsx`

**Lib utilities**:
- `lib/utils.ts` → direct copy (`cn()`)
- `lib/calendar.ts` → direct copy (import constants from `@copilot-chef/shared` instead of local definitions)
- `lib/grocery.ts` → direct copy (import constants from `@copilot-chef/shared`)
- `lib/recipe-instructions.ts`, `lib/recipe-units.ts` → direct copy

**`lib/api.ts`** — adapt for configurable server URL:
- Read `serverUrl` and `apiKey` from client config (loaded at app startup)
- Prefix all fetch URLs: `${serverUrl}/api/...`
- Add `Authorization: Bearer ${apiKey}` header to all requests
- Keep all the existing typed fetch wrapper functions

**Context providers**:
- `context/page-context-types.ts` → direct copy (already framework-agnostic)
- `context/chat-context.tsx` → adapt: replace hardcoded `/api/...` URLs with config-based URLs, same auth header injection
- `components/providers/query-provider.tsx` → direct copy
- `components/providers/toast-provider.tsx` → direct copy

**Chat components** (direct copy — no Next.js deps):
- `components/chat/ChatPanel.tsx`
- `components/chat/ChatWidget.tsx`
- `components/chat/SessionBrowser.tsx`
- `components/chat/SlashCommandMenu.tsx`
- `components/chat/slash-commands.ts`

**Layout** — adapt for React Router:
- `components/layout/app-shell.tsx`:
  - Replace `import Link from "next/link"` → `import { Link } from "react-router"`
  - Replace `usePathname()` → `useLocation().pathname`
  - Replace `useRouter()` → `useNavigate()`
  - Keep all styling and structure identical

**Server connection manager**:
- New file: `src/client/src/lib/connection.ts`
- On startup: poll `GET {serverUrl}/api/health` with exponential backoff (100ms → 200ms → 400ms → ... → 5s cap)
- Export `useServerConnection()` hook returning `{ status: "connecting" | "connected" | "disconnected", retry() }`
- When disconnected during active use: show banner "Server connection lost. Retrying...", disable mutation buttons, keep read-cached data visible
- When reconnected: dismiss banner, re-enable mutations, invalidate stale React Query caches

### Step 3.4: Port pages

Each page can be ported independently after Step 3.3 is complete.

#### 3.4a: Home page
- Source: `src/web/src/app/page.tsx`, `src/web/src/components/home/`
- Target: `src/client/src/pages/home.tsx`, `src/client/src/components/home/`
- Changes: Remove any `next/` imports. Everything else is client-side React already.

#### 3.4b: Meal Plan page
- Source: `src/web/src/app/meal-plan/page.tsx` and all components in `src/web/src/app/meal-plan/components/`
- Target: `src/client/src/pages/meal-plan/` (same component structure)
- Changes: Replace `useRouter`, `useSearchParams` with React Router equivalents. Keep all calendar/drag/undo-redo logic.
- Tests: Port `DeleteConfirmationModal.test.ts`, `use-meal-undo-redo.test.ts`

#### 3.4c: Grocery List page
- Source: `src/web/src/app/grocery-list/page.tsx` and components
- Target: `src/client/src/pages/grocery-list/`
- Changes: Replace Next.js navigation imports

#### 3.4d: Shopping page
- Source: `src/web/src/app/grocery-list/shop/[id]/page.tsx`
- Target: `src/client/src/pages/grocery-list/shop.tsx`
- Changes: `useParams()` from React Router instead of Next.js

#### 3.4e: Recipes page
- Source: `src/web/src/app/recipes/page.tsx` and components
- Target: `src/client/src/pages/recipes/`
- Tests: Port `RecipeDetail.test.tsx`

#### 3.4f: Recipe Detail page
- Source: `src/web/src/app/recipes/[recipeId]/page.tsx`
- Target: `src/client/src/pages/recipes/detail.tsx`
- Changes: `useParams()` from React Router

#### 3.4g: Stats page (requires conversion)
- Source: `src/web/src/app/stats/page.tsx`, `src/web/src/components/stats/`
- Target: `src/client/src/pages/stats.tsx`, `src/client/src/components/stats/`
- **Key change**: Currently a React Server Component that directly calls services. Must convert to a client component that calls `GET /api/stats` via React Query.
- The `GET /api/stats` endpoint already exists — just need the client-side fetch.

#### 3.4h: Settings page
- Source: `src/web/src/app/settings/page.tsx`, `src/web/src/components/settings/`
- Target: `src/client/src/pages/settings.tsx`, `src/client/src/components/settings/`
- **Addition**: New "Connection" section (server URL, API key, auto-launch toggle, check for updates button, version display)
- Store connection settings in Tauri app data directory via `@tauri-apps/plugin-fs`

### Step 3.5: Client configuration at startup

**`src/client/src/lib/config.ts`**:
- Load `copilot-chef-client.toml` from Tauri app data dir
- If not found: show first-run setup UI (enter server URL, API key)
- Save config via `@tauri-apps/plugin-fs`
- Expose via React context: `useClientConfig()`

### Step 3.6: Embedded server launcher

**`src/client/src/lib/server-launcher.ts`**:
- When `config.connection.autoLaunchServer` is true:
  - Use `@tauri-apps/plugin-shell` to spawn `copilot-chef-server start`
  - Determine binary path: config override → auto-detect in PATH → bundled resource
  - Monitor child process (restart on unexpected exit, max 3 retries)
  - On Tauri window close: send SIGTERM to child process, wait up to 5s, then SIGKILL
- When false: just connect to `config.connection.serverUrl`
- **Note**: Embedded mode requires Node.js installed on the user's machine. The server binary is NOT bundled with the Tauri installer — it requires a separate server install.

### Step 3.7: Client update mechanism

- Configure `@tauri-apps/plugin-updater` in `tauri.conf.json`
- Endpoint: GitHub Releases API for this repo, filtered by `client-v*` tags
- On startup (if `config.updates.checkOnStartup`): check silently, show notification badge if update available
- Settings page: "Check for Updates" button, current version display, "Install & Restart" action
- Tauri handles the download, verification (signed binary), install, and restart natively

### Step 3.8: Port tests

- Port component tests from web to client package
- Port utility tests (`calendar.test.ts`, `recipe-instructions.test.ts`)
- Add new tests for:
  - Server connection manager (mock fetch for health endpoint)
  - Config loading
  - React Router navigation

### Checkpoint 3

- [ ] `src/client/` package exists with all pages and components
- [ ] `npm run build --workspace @copilot-chef/client` (Vite build) succeeds
- [ ] `npm run dev:client` opens Vite dev server on :5173
- [ ] All pages render correctly when pointed at a running server (Next.js backend OR Hono server)
- [ ] Chat streaming works end-to-end through Tauri webview
- [ ] Navigation between all pages works via React Router
- [ ] Connection status displays correctly (connecting → connected, and disconnection → banner)
- [ ] Settings page shows version and connection config
- [ ] All client tests pass: `npm run test:client`
- [ ] `cargo tauri dev` opens the desktop window with working UI

---

## Phase 4: Update System & CI/CD

> **Goal**: Establish the GitHub Release-based update system and CI/CD pipelines for both server and client.

### Prerequisites

- [ ] Phase 2 Checkpoint passed (server CLI exists)
- [ ] Phase 3 Checkpoint passed (Tauri client builds)

### Step 4.1: Release tagging convention

Document and enforce:
- Server releases: `server-v1.0.0`
- Client releases: `client-v1.0.0`
- Combined releases (breaking API changes): `v1.0.0` (includes assets for both)
- Pre-releases: `server-v1.0.0-beta.1`, `client-v1.0.0-beta.1`

### Step 4.2: GitHub Actions CI workflow

**`.github/workflows/ci.yml`**:
- Trigger: push to `main`, pull requests
- Matrix: test all packages
- Steps: install deps, build shared → build core → build server → build client (Vite only, not Tauri), lint, test all

### Step 4.3: Server release workflow

**`.github/workflows/release-server.yml`**:
- Trigger: push tag `server-v*`
- Steps: build, test, `npm pack` → upload `.tgz` to GitHub Release
- Include `CHANGELOG.md` in release body

### Step 4.4: Client release workflow

**`.github/workflows/release-client.yml`**:
- Trigger: push tag `client-v*`
- Matrix: `[windows-latest, macos-latest, ubuntu-latest]`
- Steps: build Vite → `cargo tauri build` → upload platform installers to GitHub Release
- Tauri auto-generates `latest.json` for the updater plugin

### Step 4.5: Wire update checks

**Server** (already scaffolded in Step 2.6):
- Verify `checkForUpdate()` works against real GitHub Releases API
- Verify `copilot-chef-server update` downloads and installs correctly

**Client** (already scaffolded in Step 3.7):
- Verify Tauri updater detects a real GitHub Release
- Verify install + restart flow works

### Checkpoint 4

- [ ] CI workflow runs on push/PR and tests all packages
- [ ] Server release workflow produces `.tgz` on GitHub Release
- [ ] Client release workflow produces platform installers on GitHub Release
- [ ] Server detects new version on startup and `update` command works
- [ ] Client detects new version on startup and Settings "Check for Updates" works

---

## Phase 5: Documentation

> **Goal**: Produce architecture and developer guide documents that reflect the new structure. Can be started during Phases 2–4 and finalized after.

### Step 5.1: Architecture document

Create **`docs/architecture.md`** with these sections:

1. **System Overview** — Diagram showing: Tauri Client ↔ HTTP ↔ Hono Server ↔ Core Services ↔ SQLite (WAL). PA ↔ HTTP ↔ Hono Server (same server, machine auth).
2. **Package Responsibilities** — Table: core (Prisma, services, CopilotChef), shared (config, types, constants), server (Hono routes, middleware, CLI), client (Tauri + React UI)
3. **Data Flow** — Request lifecycle from user click to database and back
4. **Chat Streaming** — Detailed flow including sentinel events, input requests, domain refreshes
5. **Configuration System** — Server TOML + client TOML, resolution order, env overrides
6. **Authentication Model** — Client API keys, PA machine tokens, auth middleware
7. **Update System** — GitHub Releases, tagging convention, server CLI updater, Tauri plugin updater
8. **Database** — SQLite in WAL mode, Prisma schema overview, key model relationships, PRAGMA configuration, backup procedure
9. **Connection Model** — Client requires server, health check polling, graceful degradation on disconnect
10. **SQLite Concurrency** — How multiple clients are safely served via server-mediated access, WAL mode details, busy timeout behavior

### Step 5.2: Developer guide

Create **`docs/developer-guide.md`** with these sections:

1. **Prerequisites** — Node.js >= 20, npm >= 10, Rust stable, Tauri CLI v2, `copilot login`.
2. **Repository Structure** — Package map with descriptions
3. **First-Time Setup** — Step-by-step: clone, install, push schema (auto-creates SQLite file), generate client, seed, create config files, login
4. **Running in Development** — `npm run dev:all` (unified), `npm run dev:server` / `npm run dev:client` (separate), when to use each
5. **Configuration** — Default dev config files, env var overrides, config file locations
6. **Adding Features** — Workflow: schema change → service → server route → client page
7. **Adding an API Route** — Hono route pattern with example code
8. **Adding a Page** — React Router route + page component pattern
9. **Testing** — `npm run test` (all), per-package, writing tests, mocking patterns
10. **Database Changes** — `schema.prisma` → `db:push` → `db:generate` workflow
11. **Database Backup** — `copilot-chef-server db backup <path>` or manual file copy after WAL checkpoint
12. **Building** — `npm run build` (all packages), `cargo tauri build` (client installer)
13. **Debugging** — Server logs, Tauri devtools (F12), Copilot auth issues, SQLite lock issues (check for stale WAL files)
14. **Release Process** — Tag conventions, GitHub Actions, verifying assets

### Step 5.3: Update project root docs

- **`README.md`** — Update with new architecture overview, quickstart, link to detailed docs
- **`.github/copilot-instructions.md`** — Rewrite for new package structure (server routes, client pages, shared package)
- **`CLAUDE.md`** — Rewrite for new commands and architecture

### Checkpoint 5

- [ ] `docs/architecture.md` exists and covers all sections
- [ ] `docs/developer-guide.md` exists and a fresh developer could follow it
- [ ] `README.md` reflects new architecture
- [ ] `.github/copilot-instructions.md` updated
- [ ] `CLAUDE.md` updated

---

## Phase 6: Migration & Cleanup

> **Goal**: Verify feature parity, migrate remaining state, and remove the old web package. This phase is strictly sequential and requires user approval for destructive steps.

### Prerequisites

- [ ] All previous phase checkpoints passed
- [ ] Server and client running together successfully
- [ ] All tests passing across all packages

### Step 6.1: Feature parity verification

Run a comprehensive comparison between the old Next.js app and the new Hono server + Tauri client:

**Server parity** (automated test script):
- Meals CRUD: create, list range, get by ID, update, delete
- Grocery lists: create, list, get current, update, delete, add/update/delete/reorder items
- Recipes: create, list with filters, get, update, delete, rate, export, grocery derivation
- Preferences: get, patch, reset, detect region, export
- Chat: send message → verify streaming + sentinel events, respond to input, end session
- Chat sessions: list, create, get, update, delete
- Personas: CRUD
- Meal logs: list, create
- Stats: get aggregations, meal summary
- Auth: verify rejection without token, acceptance with valid token

**Client parity** (manual or screenshot comparison):
- Home dashboard
- Meal plan: day/week/month views, add/edit/delete meals, drag interactions, undo/redo (Ctrl+Z/Y)
- Grocery list: create/switch lists, add/edit/delete/check items, shopping view, filters
- Recipes: browse, search/filter, detail view, import from URL, AI-generated
- Stats: charts, heatmap, trends
- Settings: all preference sections, persona management
- Chat: streaming messages, slash commands, inline choices, session browser, pending input questions

### Step 6.2: Remove `src/web/`

**ASK USER for approval before proceeding with this step.**

- Remove `src/web/` directory
- Remove `@copilot-chef/web` from root `package.json` workspaces
- Remove web-specific scripts from root `package.json` (`dev` → now points to `dev:all`, remove old `dev`)
- Remove web-specific ESLint config entries
- **ASK USER**: Run `npm install` to clean up dependency tree

### Step 6.3: Final test run

- `npm run test` passes across core, shared, server, client
- `npm run build` succeeds for all packages
- `cargo tauri build` produces working installer
- `npm run lint` passes
- `npm run format` passes

### Step 6.4: Update future-architecture.md

Update `docs/research/future-architecture.md`:
- Change status from "Preferred direction" to "Implemented"
- Note the database choice: "**SQLite in WAL mode** for all environments. The server mediates all database access, so concurrent client connections are handled at the HTTP layer. SQLite provides zero-infrastructure setup and single-file backup."
- Resolve all other open questions with the decisions made
- Add a "Resolution" section documenting: Hono backend, SQLite (WAL), Tauri client, no offline mode

### Checkpoint 6 (Final)

- [ ] Feature parity verified (server and client match old Next.js app)
- [ ] `src/web/` removed (with user approval)
- [ ] All tests pass
- [ ] All builds succeed
- [ ] Documentation complete and accurate
- [ ] `future-architecture.md` updated with resolved decisions
- [ ] Project is fully functional on the new architecture

---

## Agent Instructions Summary

### Rules for All Agents

1. **NEVER install packages.** Do not run `npm install`, `npm add`, `cargo add`, or any installation command. If packages need installing, stop and ask the user.
2. **Check prerequisites** at the start of every phase. If a prerequisite is not met, stop and report.
3. **Run tests** after completing each step that modifies code. Report failures immediately.
4. **Do not modify `src/web/`** during Phases 0–5. It must keep working as a parallel reference.
5. **Follow existing code style**: double quotes, semicolons, ES5 trailing commas, TypeScript strict mode.
6. **Keep the existing core package as stable as possible.** The SQLite + WAL configuration (Phase 0) and shared schema extraction (Phase 1) are the only planned core modifications.

### Parallelization Guide

| Task | Can Parallel With | Notes |
|---|---|---|
| Phase 0 | Nothing | Must complete first |
| Phase 1 | Nothing | Must complete before 2 and 3 |
| Phase 2 (server) | Phase 3 (client) | Independent packages, same core dependency |
| Phase 2 route groups (2.3a–j) | Each other | Each route group is a separate file |
| Phase 3 pages (3.4a–h) | Each other | Each page is independent after 3.1–3.3 |
| Phase 4 | Must wait for 2+3 scaffolding | CI/CD + update wiring |
| Phase 5 (docs) | Can start during 2+3 | Finalize after Phase 4 |
| Phase 6 | Nothing | Strictly sequential, last |

### Handoff Protocol

When completing a phase or checkpoint:
1. List all files created or modified
2. List all tests that pass
3. Note any deviations from the plan and why
4. Note any issues discovered that affect later phases
5. State which checkpoint items are verified

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Copilot SDK auth doesn't work outside Next.js process | Chat completely broken | Test early in Phase 2 (Step 2.3e). The SDK reads from the same credential store regardless of framework — `copilot login` should work. If not, investigate SDK internals. |
| SQLite write contention under heavy concurrent requests | Slow writes, occasional SQLITE_BUSY | WAL mode + `busy_timeout = 5000` handles this. The write volume of a meal planning app is negligible. If a write takes >5s, the server returns an error — the client retries. |
| SQLite database corruption from improper shutdown | Data loss | WAL mode is crash-safe (survives process crash). `synchronous = NORMAL` survives process crash but not OS crash. For a meal planner, this is acceptable. The `db backup` CLI command provides safe backups. |
| SQLite file locked by external process | Server can't start or queries fail | Document that only the server process should access the database file. Add a startup check that verifies exclusive access. |
| React Router migration misses edge cases | Broken navigation/state | Test every page transition. Search for all `next/` imports and ensure zero remain. |
| Streaming chat breaks in Hono | Core feature broken | Test in Phase 2 before client depends on it. Hono passes `Response` objects through — same API as Next.js. |
| Tauri webview CORS issues | Client can't reach server | CORS middleware configured in Phase 2 with `tauri://localhost` origin. Test early. |
| Bundle size for Tauri installer | Large download | Client does NOT bundle Node.js or server. Embedded mode requires separate Node.js + server install. |
| SQLite max database size | Can't store enough data | SQLite supports databases up to 281 TB. A meal planning app will never come close. |

---

## Configuration Reference

### Server: `copilot-chef-server.toml`

```toml
[server]
port = 3001
host = "0.0.0.0"          # "127.0.0.1" for local-only, "0.0.0.0" for LAN
log_level = "info"         # debug | info | warn | error

[database]
url = "file:./data/copilot-chef.db"   # SQLite file path (relative to server CWD)

[auth]
tokens = ["your-api-key-here"]
copilot_model = "gpt-4o-mini"

[updates]
feed_url = "https://api.github.com/repos/OWNER/copilot-chef/releases"
check_on_startup = true

[cors]
origins = ["tauri://localhost", "http://localhost:5173"]
```

### Client: `copilot-chef-client.toml`

```toml
[connection]
server_url = "http://localhost:3001"
api_key = "your-api-key-here"
auto_launch_server = true
server_binary_path = ""    # auto-detect if empty

[updates]
check_on_startup = true

[ui]
theme = "system"           # system | light | dark
```

### Environment Variable Overrides

| Env Var | Maps To | Package |
|---|---|---|
| `COPILOT_CHEF_SERVER_PORT` | `server.port` | Server |
| `COPILOT_CHEF_SERVER_HOST` | `server.host` | Server |
| `COPILOT_CHEF_SERVER_LOG_LEVEL` | `server.logLevel` | Server |
| `COPILOT_CHEF_DATABASE_URL` | `database.url` | Server |
| `COPILOT_CHEF_AUTH_TOKENS` | `auth.tokens` (comma-separated) | Server |
| `COPILOT_CHEF_COPILOT_MODEL` | `auth.copilotModel` | Server |
| `COPILOT_CHEF_CLIENT_SERVER_URL` | `connection.serverUrl` | Client |
| `COPILOT_CHEF_CLIENT_API_KEY` | `connection.apiKey` | Client |

---

## Relevant Source Files

### Core (reference — minimal changes)

| File | Purpose |
|---|---|
| `src/core/src/index.ts` | Public API surface, all exports |
| `src/core/src/copilot/copilot-chef.ts` | CopilotChef class, sessions, tools, streaming |
| `src/core/src/copilot/system-prompt.ts` | System prompt builder |
| `src/core/src/lib/bootstrap.ts` | DB initialization |
| `src/core/src/lib/prisma.ts` | Prisma singleton (**modified in Phase 0 — WAL PRAGMAs**) |
| `src/core/src/lib/copilot-client.ts` | SDK client management |
| `src/core/prisma/schema.prisma` | Database schema (**modified in Phase 0 — set to sqlite**) |
| `src/core/src/schemas/` | Zod schemas (**re-exported in Phase 1**) |

### Web (migration source — read, don't modify)

| File | Purpose |
|---|---|
| `src/web/src/app/api/**` | All API routes (14 groups) → port to server |
| `src/web/src/lib/chat-singletons.ts` | Service singleton pattern → replicate in server |
| `src/web/src/lib/machine-auth.ts` | Auth middleware → port to Hono middleware |
| `src/web/src/lib/api.ts` | Typed fetch wrappers → adapt for configurable base URL |
| `src/web/src/context/chat-context.tsx` | Chat state → port with configurable URLs |
| `src/web/src/context/page-context-types.ts` | Page context types → direct copy |
| `src/web/src/components/layout/app-shell.tsx` | Navigation → adapt for React Router |
| `src/web/src/components/chat/*` | Chat UI → direct copy |
| `src/web/src/components/ui/*` | Shadcn primitives → direct copy |
| `src/web/src/app/stats/page.tsx` | Server Component → convert to client component |
| `src/web/src/app/*/page.tsx` | All pages → register in React Router |

### New (created during migration)

| File/Dir | Phase | Purpose |
|---|---|---|
| `src/shared/` | 1 | Config schemas, API types, shared constants |
| `src/server/` | 2 | Hono API server, routes, middleware, CLI |
| `src/client/` | 3 | Tauri + Vite + React desktop app |
| `docs/architecture.md` | 5 | Architecture document |
| `docs/developer-guide.md` | 5 | Developer guide |
| `.github/workflows/ci.yml` | 4 | CI pipeline |
| `.github/workflows/release-server.yml` | 4 | Server release automation |
| `.github/workflows/release-client.yml` | 4 | Client release automation |

---

## Comparison: SQLite vs PostgreSQL for This Project

This section documents why SQLite was chosen and when to reconsider.

| Factor | SQLite (chosen) | PostgreSQL |
|---|---|---|
| **Setup** | Zero — just a file path | Install server, create database, manage credentials |
| **Backup** | Copy one file | `pg_dump` or filesystem snapshot |
| **Concurrent reads** | Unlimited (WAL mode) | Unlimited (MVCC) |
| **Concurrent writes** | Serialized (one at a time, queued via busy_timeout) | Fully concurrent (row-level locking) |
| **Write throughput** | ~100-1000 writes/sec (WAL) | ~10,000+ writes/sec |
| **Max database size** | 281 TB | Unlimited (practical) |
| **Full-text search** | FTS5 extension (not needed yet) | Built-in `tsvector` |
| **Deployment** | Nothing to deploy — file lives next to server | Separate service to manage |
| **Migration path** | Change Prisma `provider` to `"postgresql"`, adjust `COPILOT_CHEF_DATABASE_URL` | — |

For a LAN meal planning app with <10 simultaneous users and <100 writes/minute, SQLite is more than sufficient and dramatically simpler to set up and maintain.
