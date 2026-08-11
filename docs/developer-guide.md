# Local Recipe Book — Developer Guide

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | >= 20.x | https://nodejs.org |
| npm | >= 10.x | Ships with Node.js |

---

## 2. Repository Structure

```
local-recipe-book/
├── src/main/      Electron main process, IPC, embedded Hono server
│   └── server/
│       ├── static-web.ts    Static web process — serves browser renderer build
│       └── lib/
│           ├── lan.ts        LAN settings resolution, IPv4 detection
│           └── machine-token.ts  Machine token lifecycle (generate/rotate/clear)
├── src/preload/   Electron contextBridge surface
├── src/renderer/  React UI
│   └── lib/
│       └── platform/        Runtime platform abstraction (Electron vs browser adapters)
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
git clone https://github.com/ChefMooon/local-recipe-book.git
cd local-recipe-book
npm install

# 2. Apply the Prisma schema to create the SQLite database
npm run db:push

# 3. Regenerate the Prisma client
npm run db:generate

# 4. Seed sample data
npm run db:seed
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

### Lint and format

```bash
npm run lint
npm run format
```

### Build the browser UI

```bash
npm run build:web
```

Produces a standalone browser-ready build in `out/web/`. Used by the static web process when LAN mode is enabled and included in packaged builds.

### Browser UI dev server

```bash
npm run dev:web
```

Starts a Vite dev server for the browser renderer only (no Electron). Useful for rapid browser UI iteration. Connect to a running local API via the connection page.

---

## 5. Configuration

The canonical settings and environment reference is maintained in `docs/copilot-chef-config.md`.

Use this guide for development workflow and command usage, and use the config reference for:
- App settings keys/defaults and semantics
- Environment variable overrides
- LAN and browser access setting details

Use `docs/lan-browser-access.md` for LAN/browser onboarding flow, token lifecycle, and troubleshooting.

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

**Current service boundary**:

Services are constructed from `src/main/server/services.ts` and use the shared database/bootstrap infrastructure. Database readiness is currently handled by the idempotent logic in `src/main/server/lib/bootstrap.ts`; do not add feature-specific schema repair, seed, or duplicate bootstrap behavior in a new service. The architecture improvement plan proposes making this dependency explicit at the runtime boundary.

```ts
async getItems(): Promise<Item[]> {
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

### New IPC channel

1. Add `ipcMain.handle(channel, handler)` in `src/main/ipc/index.ts`
2. Expose/update bridge behavior in `src/preload/index.ts` when needed
3. Add usage in `src/renderer/lib/platform/electron.ts`
4. Update `src/renderer/vite-env.d.ts` if the renderer API surface changed
5. Document channel changes in `docs/ipc-channels.md`

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

### Frontend implementation note

For any frontend or UI behavior changes, align with `docs/copilot-chef-style-guide.md` before implementation.

---

## 7. Testing

```bash
# Run all tests
npm run test

# Single test file
npx vitest run src/shared/config/__tests__/loader.test.ts
```

Tests use [Vitest](https://vitest.dev). Tests are distributed across `src/main/`, `src/shared/`, and `src/renderer/`; see `docs/TEST.md` for the current snapshot and coverage gaps.

---

## 8. Database Changes

```bash
# After editing prisma/schema.prisma:
npm run db:push       # apply schema change to SQLite (no migration files)
npm run db:generate   # regenerate Prisma client
```

> **Never skip `db:generate` after `db:push` during normal development.** Stale Prisma clients produce runtime type errors that look like import errors. On Windows, an active Electron process can lock the Prisma engine; stop it first, or use `npm run db:push -- --skip-generate` followed by `npx prisma generate --no-engine` when only client/types need updating.

If you need to reset a local dev database, remove the SQLite file from the app data directory or point the compatibility variable `COPILOT_CHEF_DATABASE_URL` at a fresh file and rerun setup.

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
POST /api/meals  200  24ms
```

The `[copilot-chef]` log prefix is an internal compatibility identifier; the application product name is Local Recipe Book.

### Electron DevTools

Press `F12` in the Electron window during development to open Chromium DevTools. The Network tab shows renderer requests to the embedded server.

### SQLite lock issues

If the server fails to start with `SQLITE_BUSY` or lock errors:
- Ensure no other process is holding the app database file open.
- Check any custom `COPILOT_CHEF_DATABASE_URL` override you are using. The variable name is retained for compatibility.
- Let the Electron app own the SQLite connection; the renderer should never touch the database directly.


## 11. Release Process

### Desktop app release

```bash
git tag v1.2.0
git push origin v1.2.0
```

GitHub Actions (`release-client.yml`) rebuilds the app, reruns lint and tests as a validation gate, and then packages and publishes the Windows Electron installer.
