# Copilot Chef Client and Server: Install and Usage Guide

This guide explains how to install, configure, run, and use both parts of Copilot Chef:
- Server: Hono API service
- Client: Electron desktop app with a React renderer

## 1. Prerequisites

Install these first:
- Node.js 20+
- npm 10+
- GitHub Copilot CLI authentication (`copilot login`)

Then authenticate Copilot:

```bash
copilot login
```

## 2. Install Project Dependencies

From the repository root:

```bash
npm install
```

## 3. Initialize the Database

Run these once for first-time setup:

```bash
npm run db:push
npm run db:generate
npm run db:seed
```

## 4. Create Server Configuration

Create a file named `copilot-chef-server.toml` in the repository root:

```toml
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
origins = ["http://localhost:5173"]
```

Notes:
- `tokens = []` means no API key is required (best for local development only).
- If you set tokens, the client must send a matching API key.

## 5. Run the Server

From the repository root:

```bash
npm run dev:server
```

The server listens on `http://127.0.0.1:3001` by default.

## 6. Run the Client

Run the desktop app from the repository root:

```bash
npm run dev
```

This starts Electron and the renderer dev server together.

## 7. Run Client and Server Together

The Electron app starts the embedded local server automatically when `server_mode` is `local`.

## 8. Configure Client Connection

The app stores connection settings in the Electron settings file under the user data directory.

Connection-related settings include:
- `server_mode`
- `server_port`
- `remote_server_url`
- `remote_api_key`

If the UI cannot connect:
- Verify server is running.
- Verify the URL matches the server host/port.
- Verify API key if server auth tokens are enabled.

## 9. Typical Daily Workflow

1. Start server:

```bash
npm run dev
```

2. Use the app:
- Meal Plan: schedule meals by date/week/month.
- Grocery List: track and complete shopping items.
- Recipes: browse and manage recipes.
- Stats: review planning and meal trends.
- Chat: ask Copilot for meal planning help, grocery suggestions, and recipe ideas.

## 10. Build for Production

From the repository root:

```bash
npm run build
npm run build:win
```

This builds the production app bundle and, with `build:win`, the Windows installer.

## 11. Common Issues

### Chat returns auth errors (401)
Cause:
- Copilot authentication is missing.

Fix:

```bash
copilot login
```

### Prisma or type/runtime mismatch after schema changes
Cause:
- Prisma client is stale.

Fix:

```bash
npm run db:push
npm run db:generate
```

### Client cannot reach server
Cause:
- Wrong URL, server not running, or API key mismatch.

Fix:
- Confirm server logs show it is listening on expected host/port.
- Confirm client `serverUrl` points to that host/port.
- If `auth.tokens` is not empty, set matching API key in client config.

## 12. Useful Commands Reference

```bash
npm run dev
npm run build
npm run test
npm run db:push
npm run db:generate
npm run db:seed
```
