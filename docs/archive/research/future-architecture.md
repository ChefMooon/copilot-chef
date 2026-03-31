> Historical note: This research document is retained for architectural history. It captures an earlier future-state proposal centered on a Tauri client and should not be treated as the current source of truth. See `docs/architecture.md`, `docs/developer-guide.md`, and `docs/release-guide.md` for the current Electron app.

# Future Architecture for Copilot Chef

## Status

**Implemented.** The architecture described in this document has been fully built and deployed as of the server-client migration (v2).

## Resolution

All open questions have been resolved and implemented:

- **Backend framework**: Standalone **Hono** API server (`@copilot-chef/server`). Lightweight, TypeScript-first, native streaming support. Next.js web package removed.
- **Database**: **SQLite in WAL mode** for all environments. The server is the only process that opens the database file. Multiple clients connect via HTTP — SQLite never sees concurrent connections from different processes. WAL mode + `busy_timeout = 5000` handles all concurrency needs for this workload.
- **Client**: **Tauri v2 + Vite + React** desktop app (`@copilot-chef/client`). Smaller footprint than Electron; configured with server URL and API key.
- **Offline mode**: Not supported. The client requires an active server connection. Graceful degradation: shows a banner, disables mutations, keeps cached data visible, auto-retries with exponential backoff.

See [docs/architecture.md](../architecture.md) for the full system design.
See [docs/developer-guide.md](../developer-guide.md) for setup and development workflows.

## Summary

Copilot Chef should evolve into a backend-first system with a separate client package.
The backend owns all data, Copilot orchestration, and API routes.
The client should be a lightweight Tauri desktop app that talks to the backend over HTTP.

This keeps the application installable on a single machine or usable on a local network,
while still allowing local development to stay isolated from the installed production data.

## Decisions

### 1. Split the application into server and client packages

- The server will host the domain services, Copilot integration, database access, and HTTP API.
- The client will be a separate Tauri application focused on UI and API consumption.
- The client should not contain business logic or direct database access.

### 2. Use Tauri for the desktop client

Tauri is the preferred client option for this project.
It gives us a smaller footprint than Electron and is a better fit for a thin client whose main job is to render UI and call a backend API.

### 3. Keep one backend process shared across many clients

- The backend should manage Copilot sessions internally.
- Each user or client interaction should have its own conversation/session identity.
- The backend itself is the single agent manager; it is not one agent instance per client.
- Multiple clients can connect to the same server at the same time.

### 4. Keep PA integration server-side

The PA should call the backend API directly and should not depend on the desktop client being open.
This means the integration remains available as long as the backend service is running and reachable on the network.

### 5. Separate dev and production data by configuration

- Development should use a dedicated local database file or local database instance.
- The installed/server environment should use a different database path or database server.
- The client should not be responsible for storing shared application data.
- Local browser/UI state can remain in browser storage because it is only preference-level data.

### 6. Prefer a machine-authenticated API surface for non-browser callers

- Backend routes used by the PA should require machine authentication.
- The backend should support strict route enforcement for machine-only flows.
- Public browser access and machine access should be separated by configuration, not by code duplication.

## Recommended Architecture

### Backend

Responsibilities:

- Database access and persistence
- Meal, grocery, preference, recipe, and chat services
- Copilot session lifecycle and tool execution
- Machine-authenticated API endpoints for the PA
- Session ownership and authorization checks

Suggested deployment:

- Run as a long-lived service on the local machine or a LAN server
- Bind to a network address when LAN access is desired
- Store production data outside the repository tree

### Client

Responsibilities:

- Render the UI
- Collect user input
- Call the backend API
- Keep only local UI preferences such as view state and collapsed sections

Suggested deployment:

- Tauri desktop app
- Configured with a backend base URL
- Able to point at localhost for development and at a LAN server for production

## Data Separation Model

Use separate environments and separate database targets:

- Local dev backend: local database file or local dev database
- Production backend: separate database location
- Client: no shared database access

This keeps local experimentation from modifying installed data.
It also makes reinstalling or updating the client independent of the stored application state.

## Update Strategy

### Client updates

- Ship Tauri releases through a normal versioned installer or updater flow
- Updating the client should not require data migration in the client itself
- Client updates should be safe to install without disrupting server data

### Backend updates

- Update the backend separately from the client when possible
- Backend releases may include schema or service changes
- Database migrations or push steps should be handled on the server side

## Why This Direction

- Keeps the UI thin and easy to replace
- Makes LAN/server deployment practical
- Lets the PA integrate directly with the backend without needing the desktop app
- Preserves a clean separation between dev data and installed data
- Avoids coupling the core business logic to a desktop wrapper

## Notes From Current Codebase

The current repository already has most of the backend shape in place:

- Core services live in `src/core`
- API routes live in `src/web/src/app/api`
- Copilot session state is managed in the backend process
- The database already defaults to `file:./data/copilot-chef.db` (with optional env overrides)
- Browser-only preferences are already isolated to local storage

That means the main work ahead is packaging and extraction, not a rewrite of the domain model.

## Resolved Questions

- **Should the backend remain a Next.js server with API routes, or should the API be extracted into a dedicated Node service later?**
  Resolved: Extract into a standalone **Hono** API server (`@copilot-chef/server`). Hono is lightweight, TypeScript-first, and has native streaming support. The Next.js web package will be removed after migration.

- **Should the backend use SQLite for single-user installs and PostgreSQL for LAN/multi-client installs?**
  Resolved: Use **SQLite in WAL mode for all environments**. The server process is the only SQLite client — all HTTP clients interact through the Hono server. WAL mode provides concurrent reads and serialized writes, which is sufficient for this workload. Zero infrastructure overhead. The database is a single file that can be backed up with one command.

- **Should the Tauri client support offline mode, or remain fully dependent on the backend?**
  Resolved: **No offline mode.** The client requires an active server connection. Graceful degradation on disconnect: show a status banner, disable mutations, keep cached data visible, auto-retry with exponential backoff.

## Implementation

See `docs/archive/plans/server-client-architecture-migration-v2.md` for the full migration plan that was executed.
