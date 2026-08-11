# Local Recipe Book Architecture Improvement Plan

> Status: Ready for phased implementation. This document records implementation intent only. It does not authorize or include application code changes.

## 1. Decision

Keep the current Electron architecture and improve its boundaries incrementally.

The supported product is Local Recipe Book, an Electron desktop application with:

- React and React Router in the renderer
- A Hono API running in the Electron main process
- Prisma and SQLite for persistence
- A preload context bridge for desktop-only operations
- A browser platform adapter for trusted LAN access
- Shared TypeScript types, Zod schemas, and API path constants

A Tauri/Rust rewrite is out of scope for this work. The current application already has working local, remote, and browser/LAN runtime modes, so replacing the shell would recreate behavior before the existing ownership problems were solved.

Copilot integration is paused. Copilot must remain an optional future adapter and is not a current startup prerequisite, request path, chat workflow, or architecture dependency.

## 2. Current Baseline

The current repository baseline was verified with:

```bash
npm run test
```

Result: 45 test files passed and 217 tests passed.

The current runtime has these important boundaries:

| Boundary | Current owner |
|---|---|
| Electron window, tray, updater, startup | `src/main/index.ts` |
| IPC registration | `src/main/ipc/index.ts` |
| API lifecycle | `src/main/server/start.ts` |
| Hono route composition | `src/main/server/app.ts` |
| Domain service construction | `src/main/server/services.ts` |
| Prisma client and SQLite pragmas | `src/main/server/lib/prisma.ts` |
| Bootstrap, schema repair, defaults, and seed logic | `src/main/server/lib/bootstrap.ts` |
| Settings persistence | `src/main/settings/store.ts` |
| Renderer platform selection | `src/renderer/lib/platform/` |
| Shared contracts | `src/shared/` |

These boundaries exist, but several are currently implicit or split across modules. The plan below makes ownership explicit without changing the product workflow or public runtime modes.

## 3. Findings To Address

| Finding | Evidence | Risk |
|---|---|---|
| Runtime ownership is split across the Electron entry point, IPC handlers, and server lifecycle globals | `src/main/index.ts`, `src/main/ipc/index.ts`, `src/main/server/start.ts` | Startup, restart, and shutdown behavior can diverge across local, remote, and LAN modes |
| Server lifecycle uses mutable module state and does not make every failure/stop path explicit | `src/main/server/start.ts` | Port fallback, failed starts, and shutdown races can leave resources or stale configuration behind |
| API and static browser servers resolve runtime settings independently | `src/main/server/start.ts`, `src/main/server/static-web.ts` | A fallback API port can be advertised incorrectly to browser/LAN clients |
| Electron quit cleanup is attached to an asynchronous `before-quit` listener without an explicit quit gate | `src/main/index.ts` | Electron may exit before API and static web resources finish closing |
| Configuration is resolved through settings, environment variables, and server-local state | `src/main/settings/store.ts`, `src/main/server/lib/lan.ts`, `src/shared/config/` | Different callers can observe different effective settings |
| Runtime settings, application settings, and user preferences do not have one typed ownership model | `src/main/settings/store.ts`, `src/renderer/pages/settings.tsx`, `src/main/server/services/preference-service.ts` | New theme and interface settings can be persisted inconsistently or become coupled to runtime configuration |
| Domain services are global singletons | `src/main/server/services.ts` | Tests and future runtime instances cannot choose their database or storage dependencies cleanly |
| `PrepListService` constructs its own `MealService` | `src/main/server/services/prep-list-service.ts` | Related operations can use different service instances and hide dependency ownership |
| `MealService` and `RecipeService` each combine persistence, serialization, normalization, coordination, and business rules | `src/main/server/services/meal-service.ts`, `src/main/server/services/recipe-service.ts` | Changes have a wide blast radius and are difficult to test at one boundary |
| Bootstrap and compatibility schema repair are implicit and cyclic | `src/main/server/lib/bootstrap.ts`, `src/main/server/lib/schema.ts` | Initialization order and repair behavior are hard to reason about and easy to duplicate |
| Route validation and error mapping are not represented by one shared contract | `src/main/server/routes/`, `src/shared/schemas/` | Clients can receive inconsistent error shapes and status behavior |
| Preload IPC is exposed through a generic variadic `invoke` function | `src/preload/index.ts` | Channel payload drift is discovered late and renderer calls are weakly typed |
| The renderer adapter boundary is useful but not every future capability is guaranteed to use it | `src/renderer/lib/platform/`, renderer call sites | Browser mode can regress when a component reaches directly for Electron globals |

## 4. Architecture Decisions To Lock

### 4.1 Runtime coordinator

Introduce a `LocalRecipeBookRuntime` coordinator as the composition root for the main process. It owns or coordinates:

- Effective settings resolution
- Database/bootstrap initialization
- Service construction
- Embedded API start and stop
- Static browser server start and stop
- Runtime status and connection configuration
- Serialized restarts

`src/main/index.ts` remains responsible for Electron window and tray concerns. It delegates application runtime concerns to the coordinator instead of duplicating lifecycle decisions.

### 4.2 Explicit lifecycle state

Represent server/runtime state explicitly rather than relying on loosely related module globals. The state model must distinguish at least:

- `stopped`
- `starting`
- `running`
- `restarting`
- `stopping`
- `failed`

Start, restart, and stop operations must be awaited and serialized. A failed port attempt must close its listener before the next attempt. Shutdown must be idempotent.

Electron shutdown must have an explicit quit gate. The first `before-quit` event prevents default exit, awaits runtime shutdown, and then permits or initiates one final quit. Repeated quit events must share the same shutdown promise. Close-to-tray remains a window concern and must not trigger runtime shutdown.

### 4.3 One effective configuration snapshot

Resolve settings into a typed effective configuration object at the runtime boundary. The precedence rules remain compatible with current behavior, but callers should consume the resolved snapshot rather than independently reading settings and environment variables.

The existing `COPILOT_CHEF_*` environment variable names remain compatibility identifiers. They do not represent active Copilot functionality.

The snapshot must distinguish configured values from runtime values where they can differ. In particular, the actual API port selected after fallback must be the value used by status responses and static browser `/runtime-config.json` output. The static web server must consume the runtime API connection rather than independently reconstructing it.

### 4.4 Injectable application services

Replace global service construction with a factory such as:

```ts
createApplicationServices({ database, storage })
```

The factory returns the shared service graph for one runtime. Related services, including `PrepListService` and `MealService`, receive their dependencies from that graph.

Migration is incremental: introduce the factory, adapt one route/service group at a time, and retain temporary compatibility exports only until all consumers and tests have moved. The factory must not become a second global singleton.

### 4.5 Bounded database initialization

Keep compatibility repair logic, but give it an explicit owner and lifecycle:

1. Resolve the database location.
2. Initialize the Prisma client and SQLite pragmas.
3. Run versioned compatibility checks/repairs once.
4. Apply defaults and seed behavior under an explicit policy.
5. Mark the runtime database ready.

Feature services must not independently decide whether schema repair or seeding runs. `prisma/schema.prisma` remains the declarative schema source, while `src/main/server/lib/schema.ts` remains a bounded compatibility layer until its responsibilities can be retired safely.

Preserve the current concurrency and retry contract: concurrent callers initialize once, a failed initialization can be retried, and compatibility repair/defaults/seed/migrations do not run more than once per successful runtime initialization. Fresh, current, repair-required, seed-enabled, seed-disabled, and failed-then-retried databases are separate behaviors to test.

### 4.6 Shared API contracts and errors

Keep request schemas and response types in `src/shared/` where they are useful to both transports. Establish a stable error envelope for validation, authentication, not-found, conflict, and internal failures. Routes remain responsible for HTTP status mapping; services remain transport-agnostic.

The error envelope must define a stable machine-readable code, human-readable message, optional request ID, and optional validation details. Unexpected internal errors must not expose sensitive implementation details. The plan must preserve or deliberately version the current renderer-facing `{ error: string }` behavior during migration.

### 4.7 Typed IPC and platform isolation

Define a channel-to-payload/result map shared by preload and the Electron platform adapter. Renderer code continues to use `getPlatform()` and must not call `window.api.invoke(...)` directly. Browser mode returns capability-aware results for desktop-only operations.

### 4.8 Copilot remains optional

Do not add Copilot startup checks, chat routes, streaming assumptions, or required configuration to the current architecture. Historical Copilot material stays under `docs/archive/copilot/`.

### 4.9 Settings and UI preference boundary

Establish a typed settings contract before adding new interface settings. Settings must be classified by ownership:

- **Runtime settings**: server mode, ports, LAN, remote URL, and other values required to construct or restart the runtime.
- **Application settings**: close-to-tray, update behavior, and desktop application behavior.
- **UI preferences**: theme, density, landing page, date/week display, layout choices, and other renderer behavior preferences.
- **Domain preferences**: household, dietary, grocery, recipe, and planning preferences already represented by the preference service or database model.

Runtime settings remain owned by the main-process configuration boundary. UI preferences must be exposed through a typed preference contract and consumed by a renderer-level preference provider or equivalent boundary. Domain preferences remain transport-agnostic and must not be duplicated as arbitrary renderer settings.

The settings boundary must define:

- Typed keys, values, defaults, and validation rules.
- Persistence ownership for Electron and browser/LAN modes.
- A version or migration strategy for settings stored by older app releases.
- Invalid-value fallback and reset-to-default behavior.
- Whether a preference is device-local, runtime-local, or shared through the API.
- Safe behavior when the browser client is unauthenticated or has limited platform capabilities.

Theme is an architectural contract, not a visual redesign. Define a constrained value such as `"light" | "dark" | "system"`, document system-theme resolution, and apply the resolved theme at the renderer root before or during initial render to avoid a flash of the wrong theme. The future frontend plan owns token design, component migration, and visual direction.

## 5. Documentation Disposition

The current documentation set should describe Local Recipe Book and the active Electron runtime. Historical documents remain available for rationale but must not be linked as current implementation guidance.

Already moved by the user:

- `docs/client-server-install-and-usage.md` -> `docs/archive/client-server-install-and-usage.md`
- `docs/burkeholland-max-skills-and-tools-1-2-2.md` -> `docs/archive/copilot/burkeholland-max-skills-and-tools-1-2-2.md`
- `docs/copilot-sdk-tool-test-plan.md` -> `docs/archive/copilot/copilot-sdk-tool-test-plan.md`
- `docs/plans/copilot-sdk-full-surface-upgrade.md` -> `docs/archive/copilot/copilot-sdk-full-surface-upgrade.md`
- `docs/plans/multi-state.md` -> `docs/archive/copilot/multi-state.md`

Moved or already duplicated in the historical plans archive:

- `docs/tauri-rebuild-blueprint.md` -> `docs/archive/plans/tauri-rebuild-blueprint.md`
- Completed calendar, grocery, recipe book, settings, modal, and meal-plan plans under `docs/archive/plans/`

Active documentation updates required by this plan:

- Correct current source paths and Local Recipe Book branding.
- Remove standalone server and active Copilot setup instructions.
- Keep internal `copilot-chef` filenames and environment variable names documented as compatibility identifiers where needed.
- Keep `docs/architecture.md`, `docs/developer-guide.md`, `docs/lan-browser-access.md`, `docs/ipc-channels.md`, and `docs/copilot-chef-config.md` as the operational sources of truth for their topics.
- Document the settings categories, ownership, persistence, and migration rules in `docs/copilot-chef-config.md` when the settings foundation is implemented.
- Keep visual direction, component standards, theme tokens, and page redesign requirements in the separate frontend plan and `docs/copilot-chef-style-guide.md`.
- Keep this document as the reviewable architecture improvement proposal until implementation is approved.

## 6. Implementation Phases

Each phase is designed for a separate agent session. An agent may modify only the phase scope and its directly required tests/docs. Before handing off, the agent must complete the phase report at the end of that phase. The next agent should treat that report, the committed code, and passing checks as the phase contract.

The phase numbers remain stable identifiers for discussion and handoff. The recommended implementation order is **0 -> 1 -> 4 -> 3 -> 9 -> 2 -> 5 -> 6 -> 7 -> 8**. Database readiness and the injectable service graph are established before the runtime coordinator so the coordinator does not need to be rebuilt around temporary global dependencies. The settings and UI-preference contract is established before the frontend plan begins, while the visual redesign remains a separate workstream. A team may split or overlap phases only when the completion report documents the dependency and validation boundary.

### Phase 0: Baseline and decision records

Goal: establish a stable reference point before changing ownership.

Scope:

- Record the current runtime modes, effective settings precedence, and shutdown behavior.
- Add focused tests for the current lifecycle behavior where a regression would otherwise be hard to detect.
- Create short ADRs for runtime ownership, database initialization, and paused Copilot scope after this plan is approved.

Required characterization coverage:

- Configured API port, occupied port, fallback port, and exhausted ports.
- Repeated stop and restart requests.
- Startup failure followed by a retry.
- Local, remote, and LAN/browser mode startup decisions.
- Close-to-tray versus full application quit.
- Bootstrap concurrent callers and failed initialization retry, if practical without changing production code.

Relevant files and symbols:

- `src/main/index.ts`
- `src/main/server/start.ts`
- `src/main/server/lib/bootstrap.ts`
- `src/main/settings/store.ts`

Acceptance checks:

- `npm run test`
- `npm run lint`
- The documented current behavior matches a manual local-mode and LAN-mode smoke test.

#### Phase 0 Completion Report

The implementing agent must add:

- Status: `complete`, `partial`, or `blocked`.
- Files changed and the behavior each change characterizes.
- Tests and commands run, including pass/fail results.
- Confirmed current behavior and any behavior that could not be characterized.
- Risks, open decisions, and the recommended next phase from the dependency order above.

### Phase 1: Effective configuration boundary

Goal: make one typed configuration snapshot the input to runtime startup.

Scope:

- Define the effective runtime configuration type in `src/shared/config/`.
- Consolidate settings and environment precedence at one boundary.
- Make LAN resolution pure and testable while preserving current advertised-host behavior.
- Keep settings storage responsible for persistence, not runtime orchestration.
- Distinguish configured API/web ports from actual bound runtime ports.
- Make the resolved API connection available to the static web server and `/runtime-config.json`.

Relevant files and symbols:

- `src/main/settings/store.ts`
- `src/main/server/lib/lan.ts`
- `src/shared/config/`
- `src/shared/schemas/`

Acceptance checks:

- Existing config and LAN tests pass.
- Tests cover defaults, environment overrides, persisted settings, invalid values, and LAN host selection.
- Local, remote, and LAN mode effective configurations are inspectable without starting a second runtime.

#### Phase 1 Completion Report

The implementing agent must add:

- Status: `complete`, `partial`, or `blocked`.
- Effective configuration shape and precedence rules implemented.
- Files changed and any compatibility exports retained.
- Tests and commands run, including pass/fail results.
- Confirmed fallback-port and browser runtime-config behavior.
- Risks, open decisions, and the recommended next phase from the dependency order above.

### Phase 2: Runtime coordinator and lifecycle

Goal: centralize startup, restart, status, and shutdown ownership.

Scope:

- Add the coordinator described in section 4.1.
- Move lifecycle decisions out of `src/main/index.ts` and broad IPC handlers.
- Replace mutable lifecycle globals with explicit state and awaited operations.
- Ensure static web server cleanup is part of the same runtime stop path.
- Preserve close-to-tray behavior while replacing the implicit asynchronous `before-quit` cleanup with an explicit quit gate.
- Ensure a failed listener is closed before the next port attempt.
- Ensure partial startup cleans up every resource it already acquired.
- Pass actual API runtime configuration to the static web server.

Relevant files and symbols:

- `src/main/index.ts`
- `src/main/server/start.ts`
- `src/main/static-web.ts`
- `src/main/ipc/index.ts`
- `src/renderer/lib/platform/electron.ts`

Acceptance checks:

- Unit tests cover start, failed port fallback, restart serialization, repeated stop, and cleanup after partial startup.
- Manual smoke tests cover local mode, remote mode, LAN mode, close-to-tray, and full quit.
- Electron quit waits for API and static web shutdown; repeated quit events do not duplicate cleanup.
- `npm run test` and `npm run lint` pass.

#### Phase 2 Completion Report

The implementing agent must add:

- Status: `complete`, `partial`, or `blocked`.
- Lifecycle state model and serialized operation behavior.
- Startup, fallback, partial-failure, restart, and shutdown behavior implemented.
- Electron quit-gate behavior and close-to-tray behavior verified.
- Files changed and any transitional lifecycle APIs retained.
- Tests, smoke checks, and commands run, including pass/fail results.
- Risks, open decisions, and the recommended next phase from the dependency order above.

### Phase 3: Application service graph

Goal: make service dependencies explicit and shared within one runtime.

Scope:

- Add `createApplicationServices({ database, storage })`.
- Inject shared instances into routes and related services.
- Remove the private `MealService` construction from `PrepListService`.
- Define a narrow storage boundary for recipe photos and other file-backed data.
- Split only the highest-risk serialization or coordination helpers from `MealService` and `RecipeService`; do not perform a broad rewrite.

Relevant files and symbols:

- `src/main/server/services.ts`
- `src/main/server/services/meal-service.ts`
- `src/main/server/services/recipe-service.ts`
- `src/main/server/services/prep-list-service.ts`
- `src/main/server/routes/`

Acceptance checks:

- Existing route and service tests pass without global singleton setup.
- A test can construct an isolated service graph with a test database/storage implementation.
- Meal, recipe, grocery, prep-list, and photo behavior remains unchanged.

#### Phase 3 Completion Report

The implementing agent must add:

- Status: `complete`, `partial`, or `blocked`.
- Service factory dependency graph and route groups migrated.
- Temporary compatibility exports and their removal criteria.
- Files changed and behavior preserved.
- Tests and commands run, including pass/fail results.
- Risks, open decisions, and the recommended next phase from the dependency order above.

### Phase 4: Database and bootstrap ownership

Goal: make database readiness explicit and prevent feature-level bootstrap duplication.

Scope:

- Move bootstrap invocation to the runtime/application boundary.
- Separate schema compatibility repair, defaults, and seed policy into named operations.
- Document the supported relationship between `prisma/schema.prisma` and `src/main/server/lib/schema.ts`.
- Resolve the current bootstrap circular dependency without deleting compatibility repair behavior.
- Preserve SQLite WAL, busy timeout, synchronous, and foreign-key settings.

Relevant files and symbols:

- `src/main/server/lib/prisma.ts`
- `src/main/server/lib/bootstrap.ts`
- `src/main/server/lib/schema.ts`
- `prisma/schema.prisma`
- `src/main/server/services/meal-type-service.ts`

Acceptance checks:

- Fresh database startup, existing database startup, and compatibility repair are covered separately.
- Startup does not seed or repair more than once per runtime.
- Concurrent initialization runs once, and failed initialization can be retried.
- Seed-enabled and seed-disabled behavior is covered explicitly.
- SQLite pragma tests or diagnostics confirm the existing concurrency settings.
- Windows development instructions continue to cover Prisma engine locking.

#### Phase 4 Completion Report

The implementing agent must add:

- Status: `complete`, `partial`, or `blocked`.
- Database readiness lifecycle and named operations.
- Fresh, existing, repair-required, seed, concurrency, and retry behavior verified.
- Confirmation that SQLite pragmas and compatibility repair behavior remain intact.
- Files changed and any transitional bootstrap APIs retained.
- Tests and commands run, including pass/fail results.
- Risks, open decisions, and the recommended next phase from the dependency order above.

### Phase 5: API contracts and error boundary

Goal: make HTTP behavior predictable for the Electron renderer and browser clients.

Scope:

- Inventory route request/response schemas and move shared contracts into `src/shared/` where appropriate.
- Define the common error envelope and status mapping.
- Define the migration policy for the current `{ error: string }` response shape.
- Ensure internal errors do not expose sensitive implementation details.
- Keep authentication and transport concerns in middleware/routes; keep domain services independent of Hono.
- Add route tests for validation, authentication, not-found, conflict, and unexpected service failures.

Relevant files and symbols:

- `src/main/server/app.ts`
- `src/main/server/routes/`
- `src/main/server/middleware/`
- `src/shared/api/`
- `src/shared/schemas/`

Acceptance checks:

- `npm run docs:check:ipc` remains passing.
- Representative local and browser API calls return the same contract for equivalent requests.
- Existing renderer error and retry behavior remains functional.

#### Phase 5 Completion Report

The implementing agent must add:

- Status: `complete`, `partial`, or `blocked`.
- Shared contracts and error codes/envelope implemented.
- Compatibility behavior for existing renderer and browser clients.
- Files changed and route groups migrated.
- Tests and commands run, including pass/fail results.
- Risks, open decisions, and the recommended next phase from the dependency order above.

### Phase 6: Typed IPC and platform contract

Goal: prevent preload, IPC, and renderer adapter drift.

Scope:

- Replace the generic variadic IPC surface with a typed channel map.
- Define payload/result types for settings, server configuration/status, LAN operations, machine-token operations, window actions, PDF export, and updates.
- Keep channel registration in `src/main/ipc/index.ts` and bridge exposure in `src/preload/index.ts`.
- Update `src/renderer/lib/platform/electron.ts` and browser capability handling together.
- Keep `docs/ipc-channels.md` synchronized with the type map.

Relevant files and symbols:

- `src/preload/index.ts`
- `src/main/ipc/index.ts`
- `src/renderer/lib/platform/electron.ts`
- `src/renderer/lib/platform/browser.ts`
- `src/renderer/lib/platform/types.ts`
- `src/renderer/vite-env.d.ts`
- `docs/ipc-channels.md`

Acceptance checks:

- Type checking rejects an invalid channel name or payload.
- IPC documentation drift check passes.
- Browser mode never evaluates Electron-only IPC calls.
- Focused tests cover capability absence and representative Electron channel calls.

#### Phase 6 Completion Report

The implementing agent must add:

- Status: `complete`, `partial`, or `blocked`.
- Channel map coverage, including legacy channels and payload/result types.
- Confirmation that renderer calls remain behind `getPlatform()`.
- Files changed and any temporary bridge compatibility retained.
- Tests and commands run, including pass/fail results.
- Risks, open decisions, and the recommended next phase from the dependency order above.

### Phase 7: Reliability, observability, and integration coverage

Goal: verify the new ownership model across process boundaries.

Scope:

- Add structured lifecycle diagnostics without exposing tokens or sensitive settings.
- Add integration coverage for route -> service -> persistence flows.
- Add startup/shutdown smoke coverage for Electron where the test environment permits it.
- Add packaging checks for Prisma resources and the browser bundle.
- Add a coverage provider only if the team wants a numeric coverage gate; do not make it a prerequisite for the boundary refactor.

Relevant files and symbols:

- `src/main/index.ts`
- `src/main/server/start.ts`
- `src/main/server/routes/`
- `src/main/ipc/index.ts`
- `package.json`
- `scripts/`

Acceptance checks:

- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run docs:check:ipc`
- A packaged Windows build contains the Prisma schema, query engine resources, and browser renderer output.

#### Phase 7 Completion Report

The implementing agent must add:

- Status: `complete`, `partial`, or `blocked`.
- Diagnostics added and confirmation that tokens/settings are not logged.
- Integration, Electron smoke, and packaging checks completed or deferred.
- Files changed and residual test gaps.
- Tests and commands run, including pass/fail results.
- Risks, open decisions, and recommended next step for Phase 8.

### Phase 8: Cleanup and documentation lock

Goal: remove transitional paths only after the new boundaries are proven.

Scope:

- Remove obsolete lifecycle globals, duplicate configuration readers, and compatibility shims that are no longer needed.
- Update architecture, developer, configuration, IPC, LAN, test, style, and release docs from verified behavior.
- Keep historical plans in `docs/archive/` and do not relink them as current guidance.
- Update changelog/release notes only when the implementation is actually delivered.

Acceptance checks:

- Active-doc stale-reference search finds no Tauri, standalone server, `src/web`, or active Copilot setup instructions outside archive/history references.
- Full test, lint, build, and IPC documentation checks pass.
- Manual local, remote, LAN/browser, tray, and update smoke checks are recorded.

#### Phase 8 Completion Report

The implementing agent must add:

- Status: `complete`, `partial`, or `blocked`.
- Transitional paths removed and any intentionally retained compatibility paths.
- Active documentation updated and stale-reference search results.
- Tests, smoke checks, and commands run, including pass/fail results.
- Remaining risks and explicit follow-up work outside this plan.

### Phase 9: Settings and UI preference foundation

Goal: establish the typed, validated, and platform-aware settings boundary required by future interface settings without implementing the visual redesign.

Scope:

- Inventory current settings and preferences and classify them as runtime, application, UI, or domain-owned.
- Define typed setting keys, values, defaults, validation, and reset behavior in the appropriate shared/main modules.
- Keep runtime settings in the effective configuration boundary and prevent renderer-only preferences from controlling server lifecycle.
- Define persistence behavior for Electron, browser/LAN, and remote modes.
- Add a versioned migration path for settings stored in `settings.json`, browser storage, or other existing preference representations.
- Define the initial theme preference contract, including `light`, `dark`, and `system` behavior, without choosing the final visual design or token palette.
- Add a renderer-level preference context/provider or equivalent access boundary so components do not independently parse settings.
- Ensure the resolved theme is applied at the renderer root early enough to avoid a visible incorrect-theme flash where practical.
- Update configuration documentation with settings ownership and migration rules.

This phase must not redesign pages, replace the design system, migrate every component to new tokens, or decide the future frontend visual language. Those belong to the separate frontend plan.

Relevant files and symbols:

- `src/main/settings/store.ts`
- `src/main/server/services/preference-service.ts`
- `src/shared/config/`
- `src/shared/schemas/`
- `src/renderer/lib/platform/types.ts`
- `src/renderer/lib/platform/electron.ts`
- `src/renderer/lib/platform/browser.ts`
- `src/renderer/pages/settings.tsx`
- `src/renderer/app.tsx`
- `src/renderer/globals.css`
- `docs/copilot-chef-config.md`

Acceptance checks:

- Every existing setting has an explicit owner and category.
- Typed settings reject invalid keys and values at compile time or validation boundaries.
- Defaults, malformed stored values, reset-to-default, and migration from existing stored values are tested.
- Runtime settings cannot be changed through a UI-preference path without going through the runtime coordinator/configuration boundary.
- Electron and browser modes follow the documented persistence and capability rules.
- Theme preference resolves consistently for `light`, `dark`, and `system`, including an unavailable or malformed stored value.
- Renderer components can read the preference contract without directly reading `window.api`, raw browser storage, or settings JSON.
- `npm run test`, `npm run lint`, and `npm run docs:check:ipc` pass.

#### Phase 9 Completion Report

The implementing agent must add:

- Status: `complete`, `partial`, or `blocked`.
- Settings categories, ownership rules, and persistence behavior implemented.
- Typed contract, validation, defaults, migration, and reset behavior implemented.
- Theme contract and renderer preference boundary implemented without visual redesign.
- Files changed and any compatibility settings paths retained.
- Tests and commands run, including pass/fail results.
- Confirmed inputs and constraints for the separate frontend plan.
- Risks, open decisions, and recommended next step from the dependency order above.

## 7. Dependencies and Risks

| Risk | Mitigation |
|---|---|
| Lifecycle refactor changes close-to-tray or updater timing | Preserve Electron window/tray ownership in `src/main/index.ts`; add stop-path tests before moving code |
| Runtime coordinator becomes another broad god object | Keep it as a composition/lifecycle coordinator; domain rules stay in services and route policy stays in the server layer |
| Database repair changes existing user data behavior | Characterize current repair/default/seed behavior first; keep compatibility tests and require an explicit migration decision for behavior changes |
| Service injection creates large constructor churn | Introduce a factory and adapt one route/service group at a time |
| Typed IPC exposes undocumented legacy calls | Inventory existing channel registrations and renderer adapter calls before changing the bridge |
| LAN/browser behavior regresses | Preserve `RendererPlatform`, test token/config onboarding, and run a real browser smoke test after lifecycle changes |
| New interface settings become coupled to server/runtime settings | Classify settings by ownership; keep UI preferences behind a renderer preference boundary and runtime changes behind the coordinator |
| Theme work becomes an accidental visual redesign inside the architecture refactor | Limit this phase to the typed preference contract, persistence, migration, and root application; defer tokens, components, and visual direction to the frontend plan |
| Existing settings storage contains malformed, unknown, or legacy values | Validate at the boundary, apply documented defaults, preserve unknown values only when explicitly supported, and test migration/reset behavior |
| Prisma engine files are locked on Windows during development | Stop the Electron dev process before normal generation; when only client/types need updating, use `npx prisma generate --no-engine` and use `npm run db:push -- --skip-generate` for schema application |
| Paused Copilot code is accidentally made required | Keep Copilot out of runtime composition, current docs, and acceptance criteria; retain only archived historical references |

## 8. Scope Exclusions

This plan does not include:

- A Tauri or Rust rewrite
- A standalone server/client package split
- Re-enabling Copilot chat, streaming, tools, or login requirements
- A public package or internal identifier rename from `copilot-chef`
- A new database schema design or destructive migration
- A visual redesign of the renderer
- Frontend visual redesign, page/component migration, design-token selection, and visual language decisions; these belong to a separate frontend plan after the settings foundation is complete
- New product features unrelated to architecture reliability
- A commit, branch, release, or production rollout

## 9. Verification Command Set

Run the narrowest relevant command after each phase, then the full set before merging:

```bash
npm run test
npm run lint
npm run docs:check:ipc
npm run build
```

For documentation-only changes, also run an active-doc search that excludes `docs/archive/` and confirms that historical terms appear only where explicitly described as compatibility or history.

For implementation sessions, the agent must run the narrowest relevant check first, then the phase checks. A phase is not complete when only a diff review has been performed and an executable check was available.

## 10. Review Gate

Implementation should begin only after review confirms:

- The runtime coordinator owns the intended lifecycle surface.
- The configuration precedence rules are preserved.
- Database repair and seeding remain backward-compatible.
- Typed IPC includes every currently supported channel.
- Browser/LAN behavior remains a supported runtime mode.
- Copilot remains paused and optional.
- Each phase has an agreed acceptance check and rollback point.

## 11. Multi-Agent Handoff Contract

Each implementation session must:

1. Read the current plan and the previous phase completion report before editing.
2. Confirm the previous phase status is `complete` or identify the exact accepted partial/blocked condition.
3. Keep changes within the current phase unless a directly required dependency is documented in the completion report.
4. Run focused validation immediately after the first substantive edit and repair local failures before expanding scope.
5. Update the current phase completion report before ending the session.
6. Leave unrelated user changes untouched and do not commit, branch, or perform destructive resets unless explicitly requested.

The completion report is the handoff record. It must be factual, concise, and specific enough for another agent to continue without reconstructing the entire session from chat history.
