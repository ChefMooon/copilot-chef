# Copilot Chef

An AI-powered meal-planning desktop application built as a **Hono API server + Tauri desktop client** monorepo.

## Features

- **Meal plan** — day, week, and month calendar views with drag-and-drop rescheduling and undo
- **Grocery list** — categorized checklist with completion progress tracking
- **Recipe book** — search, filter, and view full recipe details
- **Stats dashboard** — meal heatmap, cuisine and meal-type breakdowns, weekly trends
- **Settings** — dietary preferences, household size, cuisine preferences, AI persona selection, reply-length control
- **AI chat** — floating chat panel with streaming responses, slash commands, inline choice buttons, and session history; context-aware of the current page and your kitchen state

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

Create a server config file at `copilot-chef-server.toml`:

```toml
[server]
port = 3001
host = "127.0.0.1"
log_level = "info"

[database]
url = "file:./data/copilot-chef.db"

[auth]
tokens = []                  # empty = no auth required (dev only)
copilot_model = "gpt-4o-mini"

[updates]
check_on_startup = false

[cors]
origins = ["tauri://localhost", "http://localhost:5173"]
```

### Run

```bash
npm run dev:all        # start server (:3001) + Vite dev server (:5173) together
npm run dev:server     # server only
npm run dev:client     # Vite only
```

Open the Tauri desktop window:

```bash
cd src/client && npx tauri dev
```

> The Hono server must be running before opening the desktop window.

## Commands

```bash
npm run build          # build all packages
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

Seed data includes sample meals, user preferences, grocery lists, and recipes.

## Testing

```bash
npm run test           # all packages
npm run test:core
npm run test:shared
npm run test:server
npm run test:client
```

All packages use [Vitest](https://vitest.dev). See [docs/developer-guide.md](docs/developer-guide.md) for patterns and mocking conventions.
