# Tauri/Rust Rebuild Blueprint

## Purpose

This document captures the core product behavior of Local Recipe Book so it can be rebuilt in Tauri and Rust without inheriting the Electron-specific architecture.

The goal is to preserve the user experience while replacing the desktop shell, IPC layer, embedded server, and Node-based runtime with a simpler local-first architecture.

## Guiding Principles

- Keep the product local-first and offline-friendly.
- Separate user-visible features from implementation details.
- Model the app around domain data and workflows, not Electron processes.
- Favor a small, maintainable Rust core with a thin UI layer.
- Preserve browser/LAN access as an optional capability rather than a requirement for the first version.

## 1. Product Scope

The application is a meal-planning tool with five primary workflows:

1. Plan meals over time
2. Manage a grocery list from planned meals
3. Browse and manage recipes
4. Review meal trends and household preferences
5. Run as a local home server and connect from other devices on the same Wi-Fi network, including tablets such as an iPad

These workflows should be treated as the primary product requirements for the Tauri rebuild.

## 2. Current Feature Inventory

### Meal planning

- View meals by day, week, and month
- Create and edit meal entries
- Reschedule meals across calendar views
- Drag-and-drop style reordering or movement between dates
- Undo and redo recent changes

### Grocery list

- View categorized grocery items
- Mark items as complete or incomplete
- Track completion progress
- Keep grocery items aligned with planned meals

### Recipe book

- Search and filter recipes
- Import recipes into the app
- View full recipe details
- Organize recipes by tags or related metadata

### Stats and insights

- See meal activity over time
- Visualize cuisine and meal type distribution
- Review weekly patterns and trends

### Settings and preferences

- Store household defaults and dietary preferences
- Configure connection settings for local or remote use
- Manage browser/LAN access preferences
- Control machine-level access tokens
- Enable local network discovery and trusted-device access for tablets and browsers

## 3. Core Domain Model

The current app centers around a small set of persisted entities.

| Domain | Purpose |
|---|---|
| Meal | A planned meal entry tied to a date and optional recipe context |
| GroceryList | A collection of grocery items for a household or planning period |
| GroceryItem | An individual grocery item with status and category |
| Recipe | A reusable recipe with ingredients, steps, and metadata |
| RecipeTag | Metadata used to categorize and filter recipes |
| UserPreference | Household-level defaults and dietary settings |
| MealLog | Historical meal records used for stats and trends |
| PrepList / PrepItem | Optional planning artifacts for prep tasks |

These entities should become the foundation of the Rust data layer.

## 4. Behavioral Requirements

### Local-first behavior

- The app should work without a network connection for core planning workflows.
- Data should persist locally in a SQLite database.
- The app should support backup and restore of its local data.

### Home-server / LAN behavior

- The app should be able to run as a local home server on the same Wi-Fi network as the user’s devices.
- The app should expose a local HTTP interface that can be reached from a tablet, browser, or another desktop device on the LAN.
- The app should support a simple onboarding flow for connecting from a second device without requiring a custom setup each time.
- The app should offer a secure, token-based authentication model for LAN access.
- The app should allow the user to optionally restrict access to trusted devices or known origins.

### Reliability

- Database operations should be transactional where possible.
- UI actions should fail gracefully when the database is unavailable.
- The app should preserve user data across restarts.

### Usability

- Calendar-based planning should remain fast and predictable.
- Searching and filtering should feel responsive.
- Common actions such as rescheduling, marking complete, and editing recipes should be obvious.

### Extensibility

- New features should be added as domain services rather than UI-only logic.
- Shared business rules should live in Rust instead of the frontend.

## 5. Recommended Tauri Architecture

A Tauri rebuild should make the desktop shell thin and let Rust own the application state and persistence.

### Suggested structure

```text
src-tauri/
  src/
    main.rs
    commands/
    db/
    models/
    services/
    config/
    auth/
    api/
    state/
```

### Recommended responsibilities

- Tauri commands: expose desktop actions to the frontend
- Rust services: implement meal, recipe, grocery, and preference logic
- SQLite layer: persist the core domain model locally
- Config module: manage app settings and runtime configuration
- Auth module: handle local tokens and optional browser access
- API layer: provide HTTP access for trusted devices over the LAN

### Suggested stack

- Tauri for the desktop shell and window management
- React + TypeScript for the UI layer
- Rust for business logic and persistence
- SQLite via `rusqlite` or `sqlx` for local storage
- `axum` for the local HTTP API and LAN server path
- `tower-http` for CORS, auth middleware, and request layering
- `tokio` for async runtime and background tasks
- `serde` and `serde_json` for API payloads
- `tracing` for logging and diagnostics
- Optional `utoipa` + `utoipa-swagger-ui` if you want an OpenAPI surface for future integrations

### Recommended server architecture

The server should be a thin Rust HTTP layer that sits on top of the same domain services used by the desktop UI. In other words, the desktop app and the LAN/iPad client should call the same core logic, not two separate implementations.

A practical structure is:

```text
app
  ├─ Tauri frontend (React/TypeScript)
  ├─ Tauri commands (invoke from the UI)
  ├─ Domain services (meal, grocery, recipe, preference logic)
  ├─ Repository / DB layer (SQLite access)
  └─ HTTP server (axum) for LAN/browser clients
```

Suggested runtime model:

1. Tauri starts the app and initializes the shared Rust state.
2. The same services are used by:
   - desktop commands invoked from the React frontend
   - HTTP handlers for LAN/iPad clients
3. The HTTP layer exposes endpoints such as:
   - `GET /api/health`
   - `GET /api/meals`
   - `POST /api/meals`
   - `GET /api/grocery`
   - `POST /api/grocery/items/{id}/complete`
   - `GET /api/recipes`
4. Authentication is handled by middleware that validates a bearer token or a local shared secret.
5. The server binds to `127.0.0.1` by default for local desktop use, and optionally `0.0.0.0` when LAN access is enabled.
6. The server advertises the LAN address or exposes a simple connection URL for onboarding from another device.

Recommended middleware layers:

- `auth` — validates bearer tokens and rejects anonymous requests
- `cors` — allows the browser client or trusted origins only when needed
- `request-id` — attaches request IDs for debugging
- `rate-limit` — protects the API from abuse on shared networks
- `trace` — logs requests and errors for supportability

Recommended API shape:

- Keep the API RESTful and JSON-based
- Use stable resource paths for meals, recipes, grocery items, and preferences
- Return consistent error payloads and status codes
- Avoid exposing internal database details through the API

Recommended auth model:

- Generate a machine token once and persist it in the app settings
- Use that token for LAN/iPad access
- Allow the user to rotate or revoke it from the app settings screen
- Prefer a simple token-based approach over a full OAuth implementation for v1

This keeps the architecture simple while still supporting the core home-server use case.

## 6. Migration Strategy

### Phase 1 — Product baseline

- Document the feature set and acceptance criteria
- Freeze the core workflows that must exist in v1
- Decide which capabilities are must-have versus nice-to-have

### Phase 2 — Data model and persistence

- Create the SQLite schema for meals, recipes, grocery items, and preferences
- Add seed data and import/export support
- Validate data integrity and backup behavior

### Phase 3 — Core planning workflows

- Build meal planning views and editing flows
- Implement calendar navigation and meal rescheduling
- Add undo/redo support

### Phase 4 — Grocery and recipe workflows

- Add grocery list management and completion tracking
- Build recipe browsing, search, and detail views
- Support import and editing workflows

### Phase 5 — Insights and settings

- Add stats dashboards and trend views
- Implement preferences, defaults, and local settings management
- Add app-level configuration and backup support

### Phase 6 — Desktop polish and LAN access

- Package the app for desktop platforms
- Ship LAN/home-server support as a core capability, not an optional add-on
- Improve onboarding, error handling, and diagnostics for iPad and browser clients
- Add simple trusted-device controls and token management

## 7. Migration Checklist

- [ ] Define the minimum viable feature set
- [ ] Map each current feature to a Rust service or command
- [ ] Create the SQLite schema for the domain model
- [ ] Rebuild meal planning first
- [ ] Rebuild grocery list next
- [ ] Rebuild recipe book after that
- [ ] Add stats and settings once the core data model is stable
- [ ] Validate with real household-use scenarios

## 8. Recommended Next Step

The best way to begin is to treat this as a product and domain migration, not a code-porting exercise.

Start by turning the current app into a feature specification with clear acceptance criteria, then implement the data model and core workflows in Rust before reintroducing any UI polish.

That approach will make the Tauri version easier to maintain, easier to reason about, and less likely to inherit unnecessary Electron-specific behavior.
