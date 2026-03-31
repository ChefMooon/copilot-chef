# Copilot Chef — Developer Guide

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | >= 20.x | https://nodejs.org |
| npm | >= 10.x | Ships with Node.js |
| Rust toolchain | stable >= 1.75 | `rustup` from https://rustup.rs |
| Tauri CLI v2 | ^2 | `cargo install tauri-cli --version "^2"` |
| GitHub Copilot CLI | any | `copilot login` (auth only) |

---

## 2. Repository Structure

```
copilot-chef/
├── src/core/      @copilot-chef/core    Prisma schema, domain services, CopilotChef AI
├── src/shared/    @copilot-chef/shared  Shared types, config schemas, API constants
├── src/server/    @copilot-chef/server  Hono API server, CLI, update logic
├── src/client/    @copilot-chef/client  Tauri + Vite + React desktop app
├── data/                               SQLite database file (gitignored)
├── docs/
│   ├── architecture.md                 How the system works
│   └── developer-guide.md              This file
└── .github/workflows/                  CI + release pipelines
```

---

## 3. First-Time Setup

```bash
# 1. Clone and install all workspace dependencies
git clone https://github.com/copilot-chef/copilot-chef
cd copilot-chef
npm install

# 2. Apply the Prisma schema to create the SQLite database
npm run db:push

# 3. Regenerate the Prisma client
npm run db:generate

# 4. Seed sample data
npm run db:seed

# 5. Create a default server config (edit as needed)
cat > copilot-chef-server.toml << 'EOF'
[server]
port = 3001
host = "127.0.0.1"
log_level = "info"

[database]
url = "file:./data/copilot-chef.db"

[auth]
tokens = []
copilot_model = "gpt-4o-mini"

[updates]
check_on_startup = false

[cors]
origins = ["tauri://localhost", "http://localhost:5173"]
EOF

# 6. Authenticate with GitHub Copilot (required for chat to work)
copilot login
```

> **Note**: `data/` is gitignored. The SQLite file is created in your working directory and never committed.

---

## 4. Running in Development

### Start everything (recommended)

```bash
npm run dev:all
```

This launches the Hono server (`:3001`) and the Vite dev server (`:5173`) concurrently using `concurrently`.

### Start individually

```bash
npm run dev:server   # Hono server only (tsx watch, hot-reloads on save)
npm run dev:client   # Vite dev server only (browser at http://localhost:5173)
```

Use individual starts when debugging one layer or when the other is already running.

### Open the Tauri desktop window

```bash
cd src/client
npx tauri dev
```

This runs the Vite dev server internally and opens a native window. Requires the Hono server to already be running.

---

## 5. Configuration

### Server config file

`copilot-chef-server.toml` (searched in CWD, then app data dir, then home dir):

```toml
[server]
port = 3001
host = "127.0.0.1"          # "0.0.0.0" to expose on LAN
log_level = "info"

[database]
url = "file:./data/copilot-chef.db"

[auth]
tokens = ["your-api-key"]   # empty list = no auth required (dev only)
copilot_model = "gpt-4o-mini"

[updates]
check_on_startup = true

[cors]
origins = ["tauri://localhost", "http://localhost:5173"]
```

### Client config file

`copilot-chef-client.toml` in the Tauri app data directory:

```toml
[connection]
server_url = "http://localhost:3001"
api_key = ""
auto_launch_server = false  # set true to spawn server automatically

[updates]
check_on_startup = true

[ui]
theme = "system"
```

### Environment variable overrides

Environment variables override TOML values. Useful for CI and Docker.

| Variable | Maps to |
|---|---|
| `COPILOT_CHEF_SERVER_PORT` | `server.port` |
| `COPILOT_CHEF_DATABASE_URL` | `database.url` |
| `DATABASE_URL` | `database.url` (backward-compat) |
| `COPILOT_MODEL` | `auth.copilot_model` |

---

## 6. Adding Features

The general workflow for any new feature:

```
schema change → service method → server route → client page/component
```

### New database model

1. Add model to `src/core/prisma/schema.prisma`
2. Run `npm run db:push` (applies schema to SQLite)
3. Run `npm run db:generate` (regenerates Prisma client)
4. Create a service in `src/core/src/services/` following the pattern below
5. Export from `src/core/src/index.ts`

**Service pattern** (every method follows this):
```ts
async getItems(): Promise<Item[]> {
  await bootstrap();
  const rows = await prisma.item.findMany();
  return rows.map(serialize);
}
```

### New API route

Create `src/server/src/routes/<resource>.ts`:

```ts
import { Hono } from "hono";
import { MyService } from "@copilot-chef/core";

const service = new MyService();
export const myRoutes = new Hono();

myRoutes.get("/my-resource", async (c) => {
  const data = await service.getAll();
  return c.json(data);
});

myRoutes.post("/my-resource", async (c) => {
  const body = await c.req.json();
  // validate with Zod, call service, return
  const created = await service.create(body);
  return c.json(created, 201);
});
```

Register it in `src/server/src/app.ts`:
```ts
import { myRoutes } from "./routes/my-resource.js";
app.route("/api", myRoutes);
```

### New client page

1. Create `src/client/src/pages/my-page.tsx`
2. Add a route in `src/client/src/router.tsx`
3. Add a nav link in `src/client/src/components/layout/app-shell.tsx`

```tsx
// pages/my-page.tsx
import { useQuery } from "@tanstack/react-query";
import { getMyResource } from "@/lib/api";

export default function MyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-resource"],
    queryFn: getMyResource,
  });
  // ...
}
```

### New chat slash command

Add to `src/client/src/components/chat/slash-commands.ts`:

```ts
{
  command: "/my-command",
  label: "My Command",
  description: "Short description shown in the menu",
  prompt: "The message sent to Copilot when this command is selected",
},
```

For commands requiring special client-side processing (e.g., navigation), extend the command handler in `ChatPanel.tsx`.

---

## 7. Testing

```bash
# Run all tests
npm run test

# Per-package
npm run test:core
npm run test:shared
npm run test:server
npm run test:client

# Single test file
cd src/server && npx vitest run src/routes/__tests__/meals.test.ts
```

Tests use [Vitest](https://vitest.dev). Mock Prisma and fetch using `vi.mock()`. See existing tests in `src/server/src/routes/__tests__/` and `src/client/src/test/` for patterns.

---

## 8. Database Changes

```bash
# After editing src/core/prisma/schema.prisma:
npm run db:push       # apply schema change to SQLite (no migration files)
npm run db:generate   # regenerate Prisma client
```

> **Never skip `db:generate` after `db:push`.** Stale Prisma clients produce runtime type errors that look like import errors.

If you need to reset the database entirely:

```bash
rm data/copilot-chef.db data/copilot-chef.db-wal data/copilot-chef.db-shm
npm run db:push
npm run db:seed
```

---

## 9. Database Backup

Safe backup (WAL is checkpointed first):

```bash
copilot-chef-server db backup ./backups/copilot-chef-$(date +%Y%m%d).db
```

Manual backup (also safe after a WAL checkpoint):

```bash
copilot-chef-server db status    # verify WAL is checkpointed
cp data/copilot-chef.db backups/copilot-chef.db
```

---

## 10. Building

```bash
# Build all TypeScript packages
npm run build

# Build individual packages
npm run build:shared
npm run build:server
npm run build:client    # Vite build (JS/CSS bundle only)

# Build Tauri desktop installer (requires Rust + Tauri CLI)
cd src/client
npx tauri build
```

The Tauri installer is output to `src/client/src-tauri/target/release/bundle/`.

---

## 11. Debugging

### Server logs

The Hono logger middleware prints every request to stdout. Start with `npm run dev:server` and watch the terminal.

```
[server] listening on http://127.0.0.1:3001
GET /api/health  200  4ms
POST /api/chat   200  1234ms
```

### Tauri DevTools

Press `F12` inside the Tauri window (dev builds only) to open Chromium DevTools. Network tab shows all API requests including streaming chat.

### Copilot auth issues

Run `copilot login` and verify with `copilot auth status`. The SDK reads credentials from the same store as the CLI. A missing or expired token produces a vague 401 from the Copilot API.

### SQLite lock issues

If the server fails to start with `SQLITE_BUSY` or lock errors:
- Check for stale `.db-wal` or `.db-shm` files
- Ensure no other process has the database file open
- The server is the only process that should open `data/copilot-chef.db`

---

## 12. Release Process

### Server release

```bash
git tag server-v1.2.0
git push origin server-v1.2.0
```

GitHub Actions (`release-server.yml`) builds, tests, packs, and uploads the `.tgz` to GitHub Releases.

### Client release

```bash
git tag client-v1.2.0
git push origin client-v1.2.0
```

GitHub Actions (`release-client.yml`) builds Tauri installers for Windows, macOS, and Linux and uploads them to GitHub Releases. The Tauri updater plugin uses these assets.

### Combined release (breaking API changes)

```bash
git tag v1.0.0
git push origin v1.0.0
```

Create the GitHub Release manually and attach assets from both the server and client release workflows.
