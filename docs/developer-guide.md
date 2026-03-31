# Copilot Chef — Developer Guide

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | >= 20.x | https://nodejs.org |
| npm | >= 10.x | Ships with Node.js |
| GitHub Copilot CLI | any | `copilot login` (auth only) |

---

## 2. Repository Structure

```
copilot-chef/
├── src/main/      Electron main process, IPC, embedded Hono server
├── src/preload/   Electron contextBridge surface
├── src/renderer/  React UI
├── src/shared/    Shared types, config schemas, API constants
├── prisma/        Prisma schema
├── resources/     Icons and packaged app resources
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

# 5. Authenticate with GitHub Copilot (required for chat to work)
copilot login
```

> **Note**: The Electron app creates its SQLite database under the app user data directory at runtime. The Prisma schema still lives in `prisma/schema.prisma`.

---

## 4. Running in Development

### Start the Electron app

```bash
npm run dev
```

This starts the Electron main process, preload bundle, and renderer with `electron-vite` hot reload.

### Build a production bundle

```bash
npm run build
```

### Build a Windows installer

```bash
npm run build:win
```

---

## 5. Configuration

The desktop app primarily uses Electron settings storage plus environment variables.

Important runtime settings are stored in the app settings file managed by `src/main/settings/store.ts`.

Key settings:

- `server_mode`: `local` or `remote`
- `server_port`: local embedded server port
- `remote_server_url`: remote API URL when using remote mode
- `remote_api_key`: bearer token for remote mode
- `app_close_to_tray`: whether closing hides to tray
- `copilot_model`: Copilot model override

### Environment variable overrides

Useful environment variables:

| Variable | Maps to |
|---|---|
| `COPILOT_CHEF_DATABASE_URL` | Prisma datasource override |
| `COPILOT_MODEL` | Copilot model override |
| `PA_MACHINE_AUTH_ENABLED` | Enables PA/machine auth middleware |
| `PA_MACHINE_AUTH_TOKENS` | Machine auth token mappings |

---

## 6. Adding Features

The general workflow for any new feature:

```
schema change → service method → server route → client page/component
```

### New database model

1. Add model to `prisma/schema.prisma`
2. Run `npm run db:push` (applies schema to SQLite)
3. Run `npm run db:generate` (regenerates Prisma client)
4. Create or update a service in `src/main/server/services/`
5. Export it from `src/main/server/services.ts` if needed

**Service pattern** (every method follows this):
```ts
async getItems(): Promise<Item[]> {
  await bootstrapDatabase();
  const rows = await prisma.item.findMany();
  return rows.map(serialize);
}
```

### New API route

Create `src/main/server/routes/<resource>.ts`:

```ts
import { Hono } from "hono";
import { myService } from "../services";

export const myRoutes = new Hono();

myRoutes.get("/my-resource", async (c) => {
  const data = await myService.getAll();
  return c.json(data);
});
```

Register it in `src/main/server/app.ts`:
```ts
import { myRoutes } from "./routes/my-resource.js";
app.route("/api", myRoutes);
```

### New client page

1. Create `src/renderer/pages/my-page.tsx`
2. Add a route in `src/renderer/router.tsx`
3. Add navigation in `src/renderer/components/layout/`

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

Add to `src/renderer/components/chat/slash-commands.ts`:

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

# Single test file
npx vitest run src/main/server/copilot/copilot-chef.tools.test.ts
```

Tests use [Vitest](https://vitest.dev). Current test coverage lives primarily under `src/main/server/` and `src/shared/config/__tests__/`.

---

## 8. Database Changes

```bash
# After editing prisma/schema.prisma:
npm run db:push       # apply schema change to SQLite (no migration files)
npm run db:generate   # regenerate Prisma client
```

> **Never skip `db:generate` after `db:push`.** Stale Prisma clients produce runtime type errors that look like import errors.

If you need to reset a local dev database, remove the SQLite file from the app data directory or point `COPILOT_CHEF_DATABASE_URL` at a fresh file and rerun setup.

---

## 9. Building

```bash
npm run build
npm run build:win
```

Packaged Windows artifacts are emitted by Electron Builder under the build output directory used during packaging.


## 10. Debugging

### Server logs

The embedded Hono server runs inside the Electron main process. Start with `npm run dev` and watch the Electron terminal output.

```
[copilot-chef] server started on http://localhost:3001
GET /api/health  200  4ms
POST /api/chat   200  1234ms
```

### Electron DevTools

Press `F12` in the Electron window during development to open Chromium DevTools. The Network tab shows renderer requests to the embedded server.

### Copilot auth issues

Run `copilot login` and verify with `copilot auth status`. The SDK reads credentials from the same store as the CLI. A missing or expired token produces a vague 401 from the Copilot API.

### SQLite lock issues

If the server fails to start with `SQLITE_BUSY` or lock errors:
- Ensure no other process is holding the app database file open.
- Check any custom `COPILOT_CHEF_DATABASE_URL` override you are using.
- Let the Electron app own the SQLite connection; the renderer should never touch the database directly.


## 11. Release Process

### Desktop app release

```bash
git tag v1.2.0
git push origin v1.2.0
```

GitHub Actions (`release-client.yml`) rebuilds the app, reruns lint and tests as a validation gate, and then packages and publishes the Windows Electron installer.
