# Copilot Chef Client and Server: Install and Usage Guide

This guide explains how to install, configure, run, and use both parts of Copilot Chef:
- Server: Hono API service
- Client: React/Tauri desktop app (and Vite dev UI)

## 1. Prerequisites

Install these first:
- Node.js 20+
- npm 10+
- Rust stable (required for Tauri desktop client)
- Tauri CLI v2
- GitHub Copilot CLI authentication (`copilot login`)

Recommended install commands:

```bash
cargo install tauri-cli --version "^2"
```

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
origins = ["tauri://localhost", "http://localhost:5173"]
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

You have two ways to run the client.

### Option A: Vite web client (fastest for UI development)

From the repository root:

```bash
npm run dev:client
```

Open `http://localhost:5173`.

### Option B: Tauri desktop app

From `src/client`:

```bash
npm run tauri dev
```

Important:
- Start the server first (`npm run dev:server`), unless you have enabled auto-launch in client settings.

## 7. Run Client and Server Together

From the repository root:

```bash
npm run dev:all
```

This starts:
- Server on port 3001
- Vite client on port 5173

## 8. Configure Client Connection

The client stores config in `copilot-chef-client.toml` in the app data directory.

Connection fields:
- `connection.serverUrl` (default: `http://localhost:3001`)
- `connection.apiKey` (must match a server auth token when tokens are enabled)
- `connection.autoLaunchServer` (default: `true`)
- `connection.serverBinaryPath` (optional explicit path to server binary)

If the UI cannot connect:
- Verify server is running.
- Verify the URL matches the server host/port.
- Verify API key if server auth tokens are enabled.

## 9. Typical Daily Workflow

1. Start server:

```bash
npm run dev:server
```

2. Start client:

```bash
npm run dev:client
```

or desktop:

```bash
cd src/client
npm run tauri dev
```

3. Use the app:
- Meal Plan: schedule meals by date/week/month.
- Grocery List: track and complete shopping items.
- Recipes: browse and manage recipes.
- Stats: review planning and meal trends.
- Chat: ask Copilot for meal planning help, grocery suggestions, and recipe ideas.

## 10. Build for Production

From the repository root:

```bash
npm run build
```

This builds all workspace packages.

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
npm run dev:all
npm run dev:server
npm run dev:client
npm run build
npm run test
npm run test:server
npm run test:client
npm run db:push
npm run db:generate
npm run db:seed
```
