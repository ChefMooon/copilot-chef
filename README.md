# Local Recipe Book

Local Recipe Book is a local-first meal-planning Electron app with an embedded Hono API server and SQLite storage.

## Features

- **Meal plan** — day, week, and month calendar views with drag-and-drop rescheduling and undo/redo
- **Grocery list** — categorized checklist with completion progress tracking
- **Recipe book** — search, filter, import, and view full recipe details
- **Stats dashboard** — meal heatmap, cuisine and meal-type breakdowns, weekly trends
- **Settings** — dietary preferences, household defaults, LAN/browser access, and remote server connection
- **LAN/browser access** — expose the API and browser UI to trusted devices with a machine token

## Architecture

```
src/main/       Electron main process — window, tray, embedded Hono server, IPC handlers
src/preload/    contextBridge surface exposed to renderer as window.api
src/renderer/   Vite + React UI — pages, components, routing, API client
src/shared/     Shared types, config schemas, API path constants
prisma/         Prisma schema for SQLite data stored in {userData}/data/
```

The Hono API server runs in the Electron main process. The renderer talks to it over HTTP. When LAN access is enabled, the API binds to the configured LAN host and a separate static web process serves the browser build for trusted devices.

See [docs/architecture.md](docs/architecture.md) for full details.

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
npm install
npm run db:push
npm run db:generate
npm run db:seed
```

### Run

```bash
npm run dev
```

## Commands

```bash
npm run build
npm run build:web
npm run dev:web
npm run build:win
npm run lint
npm run format
npm run test
npm run db:push
npm run db:generate
npm run db:seed
```

## Configuration

App settings are stored in `{userData}/settings.json`.

Key settings:

| Key | Default | Purpose |
|---|---|---|
| `server_mode` | `"local"` | Use the embedded server or a remote server |
| `server_port` | `3001` | Local API port |
| `remote_server_url` | — | Remote API URL when `server_mode = "remote"` |
| `remote_api_key` | — | Remote API bearer token |
| `app_close_to_tray` | `true` | Hide to tray on close |
| `lan_enabled` | `false` | Enables LAN API binding |
| `lan_web_enabled` | mirrors `lan_enabled` | Enables the static browser UI server |
| `lan_web_port` | `4173` | Port for the static browser UI |
| `lan_api_port` | inherits `server_port` | API port when LAN is active |
| `lan_advertised_host` | auto-detected | Optional advertised LAN host override |
| `lan_allowed_origins` | `[]` | Extra approved CORS origins |
| `machine_api_key` | generated on demand | Persistent bearer token for browser/LAN clients |
| `machine_api_key_updated_at` | — | ISO timestamp of the last token change |

To use a remote server, go to **Settings → Connection**, enable remote mode, and enter the server URL and token.

## Database

The SQLite database is created at `{userData}/data/copilot-chef.db` on first launch after `npm run db:push`.

Seed data includes sample meals, preferences, grocery lists, and recipes.

## Testing

```bash
npm run test
```

Uses [Vitest](https://vitest.dev).

## Documentation

- [Architecture](docs/architecture.md) — runtime model, auth, updates, SQLite
- [Developer Guide](docs/developer-guide.md) — setup, feature workflow, testing, releases
- [LAN and Browser Access](docs/lan-browser-access.md) — token flow and trusted-device access
- [Tauri/Rust Rebuild Blueprint](docs/tauri-rebuild-blueprint.md) — feature inventory and migration plan for a Tauri + Rust rewrite

