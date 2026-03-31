# Copilot Chef

An AI-powered meal-planning application built as a **Hono API server + Tauri desktop client** monorepo.

## Architecture

```
src/core/     @copilot-chef/core    Prisma/SQLite, domain services, CopilotChef AI
src/shared/   @copilot-chef/shared  Shared types, config schemas, API path constants
src/server/   @copilot-chef/server  Hono API server + copilot-chef-server CLI
src/client/   @copilot-chef/client  Tauri + Vite + React desktop app
data/                               SQLite database file (gitignored)
```

See [docs/architecture.md](docs/architecture.md) for a detailed breakdown.

## Quick Start

### Prerequisites

- Node.js 20+, npm 10+
- Rust stable + Tauri CLI v2 (for the desktop client)
- `copilot login` (authenticates the GitHub Copilot SDK)

### Setup

```bash
npm install
npm run db:push        # create the SQLite database
npm run db:generate    # generate the Prisma client
npm run db:seed        # seed sample data
copilot login          # authenticate GitHub Copilot
```

Create a minimal server config:

```toml
# copilot-chef-server.toml
[server]
port = 3001
host = "127.0.0.1"

[database]
url = "file:./data/copilot-chef.db"

[auth]
tokens = []

[cors]
origins = ["tauri://localhost", "http://localhost:5173"]
```

### Run

```bash
npm run dev:all        # start server (:3001) + Vite dev server (:5173) together
npm run dev:server     # server only
npm run dev:client     # Vite only
```

Open the desktop window:

```bash
cd src/client && npx tauri dev
```

## Commands

```bash
npm run build          # build all packages
npm run test           # run all tests
npm run lint
npm run format
npm run db:push        # apply schema changes to SQLite
npm run db:generate    # regenerate Prisma client after schema change
npm run db:seed
```

## Documentation

- [Architecture](docs/architecture.md) — packages, data flow, chat streaming, auth, update system, SQLite
- [Developer Guide](docs/developer-guide.md) — setup, adding features, testing, releases

To override the AI model, set `COPILOT_MODEL` as an environment variable or via `auth.copilot_model` in `copilot-chef-server.toml` (e.g., `COPILOT_MODEL=gpt-4o`).

### Database

The SQLite database is created at `data/copilot-chef.db` (configured via `database.url` in `copilot-chef-server.toml`) after running `npm run db:push` and `npm run db:seed`.

Seed data includes:

- Sample meals organized by day and meal type
- User preferences (dietary restrictions, household size, cuisine preferences)
- Sample grocery lists and items
- Indexed lookups for efficient queries

## Meal Plan Delete UX

- Dragging a meal in Day or Week view shows a bottom-left trash drop zone.
- Dropping on trash opens a confirmation modal focused on Delete Meal (Enter confirms).
- Deleting from either trash flow or edit modal shows an Undo toast for 30 seconds.
- After Undo restores the meal, the "Restored ..." confirmation toast lasts 5 seconds.

## Testing

Run all tests:

```bash
npm run test
```

Per-package:

```bash
npm run test:core
npm run test:shared
npm run test:server
npm run test:client
```

All packages use [Vitest](https://vitest.dev). See [docs/developer-guide.md](docs/developer-guide.md) for patterns and mocking conventions.
