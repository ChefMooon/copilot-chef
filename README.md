# Copilot Chef

An AI-powered meal-planning **Electron desktop app** with an embedded Hono API server and GitHub Copilot chat.

## Features

- **Meal plan** — day, week, and month calendar views with drag-and-drop rescheduling and undo
- **Grocery list** — categorized checklist with completion progress tracking
- **Recipe book** — search, filter, and view full recipe details
- **Stats dashboard** — meal heatmap, cuisine and meal-type breakdowns, weekly trends
- **Settings** — dietary preferences, household size, cuisine preferences, AI persona selection, reply-length control, remote server connection
- **AI chat** — floating chat panel with streaming responses, slash commands, inline choice buttons, and session history; context-aware of the current page and your kitchen state
- **LAN/browser access** — expose the API and UI over LAN for tablets and other devices; connect via manual token entry or QR code

## Architecture

```
src/main/       Electron main process — window, tray, in-process Hono server, IPC handlers
src/preload/    contextBridge surface exposed to renderer as window.api
src/renderer/   Vite + React UI — pages, components, routing, API client
src/shared/     Shared types, config schemas, API path constants
prisma/         Prisma schema (SQLite, stored in {userData}/data/)
```

The Hono API server runs **in-process** in the Electron main process. The renderer communicates with it over HTTP. A random per-session auth token is generated on each startup. When LAN access is enabled, the API binds to all interfaces and a separate static web process serves the browser renderer build for LAN clients.

See [docs/architecture.md](docs/architecture.md) for full details.

## Quick Start

### Prerequisites

- Node.js 20+, npm 10+
- `copilot login` — authenticates the GitHub Copilot SDK (required for chat)

### Setup

```bash
npm install
npm run db:push        # create the SQLite database
npm run db:generate    # generate the Prisma client
npm run db:seed        # seed sample data (optional)
copilot login          # authenticate GitHub Copilot
```

### Run

```bash
npm run dev            # electron-vite dev — opens Electron window with hot-reload
```

## Commands

```bash
npm run build          # production build (electron-vite)
npm run build:web      # build standalone browser UI (browser-only Vite bundle)
npm run dev:web        # browser UI dev server (no Electron)
npm run build:win      # build Windows installer (electron-builder)
npm run lint           # ESLint
npm run format         # Prettier
npm run test           # Vitest
npm run db:push        # apply schema changes to SQLite
npm run db:generate    # regenerate Prisma client after schema change
npm run db:seed        # reseed sample data
```

## Configuration

App settings are stored in `{userData}/settings.json` (Windows: `%APPDATA%\copilot-chef\settings.json`).

Key settings:

| Key | Default | Purpose |
|---|---|---|
| `server_mode` | `"local"` | `"local"` (embedded) or `"remote"` |
| `server_port` | `3001` | Local server port |
| `remote_server_url` | — | Remote server URL (when `server_mode = "remote"`) |
| `remote_api_key` | — | Remote server bearer token |
| `app_close_to_tray` | `true` | Hide to tray on window close |
| `copilot_model` | `"gpt-4o-mini"` | AI model override |
| `lan_enabled` | `false` | Enables API LAN binding (binds to `0.0.0.0`) and starts the static web process |
| `lan_web_enabled` | mirrors `lan_enabled` | Enables the static web process independently |
| `lan_web_port` | `4173` | Port for the static browser UI |
| `lan_api_port` | inherits `server_port` | API port when LAN is active |
| `lan_advertised_host` | auto-detected LAN IP | Override the LAN IP advertised to browser clients |
| `lan_allowed_origins` | `[]` | Extra CORS origins approved by the user |
| `machine_api_key` | generated on demand | Bearer token for browser/LAN clients |
| `machine_api_key_updated_at` | — | ISO timestamp of last token generation/rotation |

To use a remote Copilot Chef server, go to **Settings → Connection**, enable remote mode, and enter the server URL and token.

## Database

The SQLite database is created at `{userData}/data/copilot-chef.db` on first launch after `npm run db:push`.

Seed data includes sample meals, preferences, grocery lists, and recipes: `npm run db:seed`.

## Testing

```bash
npm run test
```

Uses [Vitest](https://vitest.dev). See [docs/developer-guide.md](docs/developer-guide.md) for patterns.

## Documentation

- [Architecture](docs/architecture.md) — data flow, chat streaming, auth, update system, SQLite
- [Developer Guide](docs/developer-guide.md) — setup, adding features, testing, releases

