# Implementation Plan: Multi-Client Live Sync Over LAN

> Status: Proposed. This document records implementation intent only. It does not authorize or include application code changes until its phases are approved and scheduled.

## Source

- Basis: multi-client sync review of `docs/lan-browser-access.md`, `docs/architecture.md`, and live source (`src/main/server`, `src/renderer/lib`, `src/renderer/components/providers`).
- Related docs: `docs/plans/local-recipe-book-architecture-improvement-plan.md` (injectable services direction), `docs/client-server-install-and-usage.md`.

## Objective

Make simultaneous use by multiple connected clients correct and live. When any authenticated client (desktop renderer, mobile browser, installed PWA) creates or changes data through the API, every other connected client should reflect that change within roughly a second without manual refresh or navigation, and each client must recover cleanly after server restarts, network drops, or backgrounded PWA suspensions.

## Current Baseline (verified findings)

| Finding | Evidence | Consequence |
|---|---|---|
| No push channel from server to clients | No WebSocket/SSE/long-poll endpoints under `src/main/server/app.ts`; only scoped single-request SSE on `POST /api/recipes/ingest` (`src/main/server/routes/recipes.ts`) | Clients never learn about other clients' writes |
| No server-side change events | Route handlers are fire-and-return (e.g., `PATCH /api/preferences` in `src/main/server/routes/preferences.ts`) | Even if clients listened, the server has nothing to tell them |
| Data polling disabled by design | `staleTime: 30_000`, `refetchOnWindowFocus: false` in `src/renderer/components/providers/query-provider.tsx` | Idle clients show stale data indefinitely |
| Health polling stops when connected and refreshes status only, never data | `src/renderer/lib/connection.ts` (backoff loop exits on first OK; visibility retry gated on non-connected state) | Reconnect does not resync caches |
| Per-client cache coherence only | Local `invalidateQueries` calls after own mutations across `src/renderer/pages/*`, helper `src/renderer/lib/query-invalidation.ts` | Cross-client staleness bounded only by navigation/remount past staleTime |
| Docs/reality gap | `docs/architecture.md` §11 claims "React Query caches are invalidated on reconnection"; `connection-banner.tsx` is display-only and no code invalidates on status change | Documented behavior does not exist |

Consistency today is entirely pull-based and lazy. There is no divergence risk (single shared SQLite DB behind one authenticated Hono API), only staleness.

## Scope

- In scope:
  - A server-side change-event mechanism covering all mutating API surfaces (meals, meal types/sub-types, recipes, grocery lists, prep lists, preferences, stats-affecting writes, data-management restore/import).
  - A server-to-client push channel using Server-Sent Events over the existing embedded API and auth model.
  - Renderer subscription wiring from push events to React Query cache invalidation.
  - Reconnection behavior: full cache invalidation when connectivity is restored or the SSE channel re-establishes.
  - Fallback polling of a lightweight revision indicator for environments where long-lived streams fail (aggressive battery managers, restrictive intermediaries).
  - Documentation alignment (`docs/architecture.md` §11, `docs/lan-browser-access.md`, `docs/ipc-channels.md` unaffected unless new IPC channels are added).
- Out of scope:
  - Conflict resolution / optimistic locking (last-write-wins remains). Concurrent edits to the same record are acceptable for the household use case; revisit separately if field-level merge is requested.
  - Offline mutation queue, Background Sync, or Web Push in the service worker.
  - HTTPS/certificate provisioning for LAN pairing.
  - Remote mode server implementation; the protocol must be designed so a remote server *could* adopt it later, but remote-mode rollout is not validated here.
  - Presence indicators (who else is connected).

## Assumptions and Open Decisions

- All clients share one API instance in local/LAN modes; an in-process event bus is therefore sufficient (no external broker).
- Browser/PWA clients hold the persistent `machine_api_key` and send it as `Authorization: Bearer`. Native `EventSource` cannot set headers, so the push channel will consume a fetch-based stream (the renderer already has a proven fetch-stream reader for recipe ingest in `src/renderer/lib/api.ts`). If a query-parameter token variant is ever added for native `EventSource`, matching must be timing-safe and the decision recorded here first.
- The LAN rate limiter (`src/main/server/middleware/rate-limit.ts`, imported via ESM as `./middleware/rate-limit.js`) is a fixed-window bucket of 60 requests / 60 s keyed by client IP (first `x-forwarded-for` hop) and mounted only in LAN mode. It must not count idle heartbeats or disconnect/reconnect churn against clients in a way that locks devices out during normal operation. Note: multiple clients behind one NAT share a single bucket, so budgets must be sized for households, not per-device.
- Resolved decision: change events are emitted from domain services, not route handlers, because internal writers (e.g., `PrepListService` constructing `MealService`, bootstrap seeding, data-management restore) bypass route handlers.
- Resolved decision (bus sharing): the bus is a **module-level singleton consumed inside every service constructor**, including the internal fallback paths (`PrepListService`'s `?? new MealService()` at `src/main/server/services/prep-list-service.ts` and the analogous fallbacks in `data-management-service.ts`). A unit test must assert that all constructed services share exactly one bus instance. Do not mix this with per-factory injection only — factory-only injection would miss the legacy fallback constructions and silently drop events.
- Resolved decision (revision source): a monotonically increasing counter persisted in a minimal Prisma meta table (`SyncState { key, value }`) alongside the database files. The increment happens **inside the same Prisma transaction as each mutation batch**; the event is emitted after commit. This closes the crash-between-commit-and-emit gap (a committed mutation without a revision bump), which is recoverable via the client sweep-on-reconnect rule.
- Resolved decision (revision endpoint auth): `GET /api/sync/revision` requires standard bearer-token auth via the existing middleware. It does not reuse the unauthenticated `/api/health` pattern, to avoid leaking activity cadence on LAN.
- Naming note: `GET /api/health` already returns `{ ok, version }` where `version` is the app package version. The freshness endpoint must not reuse that name; see Phase 2 task 4.

## Phases

### Phase 1: Renderer quick wins (independent, shippable alone)

- Goal: Reduce worst-case staleness immediately with no protocol work, making multi-user usable before push lands.
- Tasks:
	1. Enable `refetchOnWindowFocus: true` in `src/renderer/components/providers/query-provider.tsx` (or scope it to data queries if desktop-only noise becomes a problem).
	2. Add a conservative default `refetchInterval` (15–30 s) for list-level queries (recipes list, meals week view, grocery lists, prep lists) while leaving detail views on focus-refetch only.
	3. Confirm retry semantics remain unchanged (`shouldRetryQuery`) and that 401/403 still suppress retries.
- Dependencies: None.
- Validation: Existing suite passes; manual two-device check shows a browser edit appearing on an idle desktop window within one interval after focus, and vice versa.
- Exit criteria: No code path relies on navigation/remount alone to see another client's committed write within one poll interval.

### Phase 2: Server-side change event bus and revision watermark

- Goal: Give the server something to announce: a typed change-event stream source and a cheap freshness probe.
- Tasks:
	1. Introduce a `ChangeEventBus` (Node `EventEmitter` wrapper) with a typed envelope: `{ entity: "recipe" | "meal" | "mealType" | ... , id?, action: "create" | "update" | "delete" | "bulk", revision: number }`. The bus is a module-level singleton imported directly by every domain service constructor (see resolved decisions above).
	2. Extend `createApplicationServices()` in `src/main/server/services.ts` to accept and inject the bus into every domain service (aligning with the injectable-services direction in `docs/plans/local-recipe-book-architecture-improvement-plan.md`); keep temporary compatibility exports working. The internal `?? new MealService()` / `?? new PrepListService()` fallbacks must also consume the shared singleton bus. Add a unit test asserting one bus instance across all construction paths.
	3. Emit exactly once per successful committed mutation, after the transaction commits and before/with the HTTP response; data-management restore/import emits one `bulk` event per affected entity family.
	4. Persist a monotonically increasing revision counter (bumped per emitted event batch) in a minimal Prisma meta table (e.g., `SyncState { key, value }`) so it survives restarts alongside the database files; run `db:push` then `db:generate` after the schema change. The increment occurs **inside the same Prisma transaction as the mutation**; the event is emitted after commit. Expose `GET /api/sync/revision` returning `{ revision }`, **behind the standard bearer-token auth middleware** — deliberately *not* named `/api/version`, since `GET /api/health` already returns a package `version` field and reusing the name would confuse support.
	5. Unit-test emission ordering, failure atomicity (no event on failed mutation), revision monotonicity across restart, crash-between-commit-and-emit recovery (committed data without a revision bump must be recoverable via the client sweep rule), bus-instance uniqueness across all service construction paths (including internal fallbacks), and the regression rule: an observed revision *lower* than last seen must trigger a client sweep (treated as "unknown"), never be ignored. Tests follow the existing colocated convention (`src/main/server/**/*.test.ts`, covered by the default vitest glob).
- Dependencies: None hard; benefits from Phase 1 being merged so UI improvements land independently.
- Validation: Focused service tests assert emitted envelopes for representative create/update/delete/bulk paths in every service; revision endpoint returns increasing values across mutations and app restarts.
- Exit criteria: Every committed mutation produces exactly one well-typed event and advances the revision; no mutation path can commit silently.

### Phase 3: Authenticated SSE endpoint `/api/events`

- Goal: Stream change events to any authenticated client over the existing embedded API.
- Tasks:
	1. Add `eventsRoutes` mounted in `src/main/server/app.ts` implementing `GET /api/events` as an SSE stream, reusing the framing/header pattern already proven by `POST /api/recipes/ingest`.
	2. Enforce the same bearer-token auth middleware on the stream; reject before opening the stream.
	3. Send an initial `hello` frame containing the current revision, then forward bus events as `change` frames; emit heartbeat frames (e.g., every 25–30 s) and terminate connections missed for two heartbeats.
	4. Cap concurrent connections per token and clean up listeners/streams on close, on server stop, and on Electron quit (coordinate with runtime shutdown ownership in the architecture improvement plan).
	5. Verify interaction with the LAN rate-limit middleware (`src/main/server/middleware/rate-limit.ts`, 60 req/60 s per IP, LAN mode only): **exempt the established stream after handshake and exempt `/api/sync/revision` from the bucket entirely**; each reconnect handshake still counts as one request against the bucket, bounding reconnect storms. Size budgets for households sharing one NAT IP (note the limiter's `x-forwarded-for`/"unknown" keying means unproxied clients may share one bucket), not per-device.
	6. Integration-test: two simulated clients; a mutation on one appears as a frame on the other; restart/stop closes streams cleanly.
- Dependencies: Phase 2 (bus and revision exist); app assembly and shutdown lifecycle knowledge.
- Validation: Automated integration tests for auth rejection, frame delivery, heartbeat, backpressure-free fan-out to multiple simultaneous subscribers, and clean teardown.
- Exit criteria: Any authenticated client can hold a stable event stream that delivers every committed mutation with its revision.

### Phase 4: Renderer subscription and invalidation wiring

- Goal: Turn received events into targeted React Query invalidation on all platforms identically.
- Tasks:
	1. Add a shared stream consumer module in `src/renderer/lib` that opens the long-lived fetch-based stream with standard auth headers (mirroring the existing ingest stream reader), parses frames, and exposes status (`connecting`/`live`/`retrying`).
	2. Map `entity` values onto the existing query-key prefixes in `src/renderer/lib/query-invalidation.ts`; extend that helper with an entity-to-keys map so both bulk invalidation and event-driven invalidation share one source of truth.
	3. On `hello`, compare the served revision to the last seen value; on mismatch — including a *lower* served revision, which is treated as "unknown" — or on any reconnect (`retrying` → `live`, network regain, visibility regain while disconnected), run the full `invalidateDataManagementQueries` sweep once. Note: once connected, `useServerConnection()` performs no ongoing health polling, so the stream status becomes the primary liveness signal; define how banner state reconciles stream status (`live`/`retrying`) with the existing connection status rather than showing conflicting states.
	4. Wire status into the existing connection banner so `live`/`retrying` states are visible without changing banner placement.
	5. Ensure exactly one stream per app instance (guard against React strict-mode double-mount and duplicate hooks in layout providers), with exponential-backoff reconnect and jitter.
	6. Verify behavior on iOS Safari and installed iPadOS PWA: suspended tabs drop the socket; on resume the client must reconnect and sweep-invalidates rather than trusting missed events.
- Dependencies: Phase 3; Phase 1 merged (focus/interval refetch acts as the safety net beneath event delivery).
- Validation: Two-device manual matrix (desktop→browser, browser→desktop, PWA→desktop, desktop→PWA) shows sub-second reflection for recipes, meals/meal plan, grocery lists, prep lists, and preferences; suspend/resume and airplane-mode toggles recover with a full sweep; `npm run test` green including new hook tests.
- Exit criteria: An idle client on any platform reflects any other client's committed change without user action, and recovers correctly after every tested interruption class.

### Phase 5: Fallback revision polling and graceful degradation

- Goal: Guarantee eventual consistency even where long-lived streams are unavailable.
- Tasks:
	1. When the stream cannot establish or keeps failing (threshold, e.g., 3 rapid failures), switch to polling `GET /api/sync/revision` on a modest interval (15–30 s with jitter — sized so several devices behind one NAT stay within the 60 req/60 s LAN rate-limit bucket); on revision change, sweep-invalidate and attempt stream re-establishment periodically.
	2. Prefer stream whenever available; log which mode is active (debug level) to aid support.
	3. Add tests simulating stream refusal/failure to confirm the poller takes over and hands back cleanly.
- Dependencies: Phases 2–4.
- Validation: Simulated hostile environment tests (stream blocked mid-handshake, stream dropped repeatedly); observed convergence via polling alone.
- Exit criteria: With the SSE channel fully unavailable, clients still converge within one poll interval; with it available, polling stays idle.

### Phase 6: Documentation alignment

- Goal: Make active documentation describe implemented reality.
- Tasks:
	1. Update `docs/architecture.md` §11 to describe the actual sync model: event-driven invalidation, focus/interval fallbacks, revision watermark, and remove or implement the "invalidated on reconnection" claim as shipped behavior.
	2. Update `docs/lan-browser-access.md` with a section on the live-sync channel: what it adds to LAN traffic, connection caps, heartbeats, and expected PWA suspend/resume reload behavior.
	3. Update `docs/client-server-install-and-usage.md` troubleshooting: symptoms of stream-degraded mode and how to verify live sync between devices.
	4. Run the repository documentation link/check workflow used by other plans.
- Dependencies: Phases 1–5 merged.
- Validation: `npm run docs:check:ipc` and repo doc checks pass; reviewed wording matches shipped defaults.
- Exit criteria: No active doc claims behavior that does not exist; operators can diagnose sync degradation from documentation alone.

## Cross-Phase Dependencies

- Phase 1 is independent and should merge first; all later phases assume its safety net.
- Phase 2 precedes Phase 3 (no stream without an event source and revision).
- Phase 4 depends on Phase 3 and must ship with Phase 1's fallbacks active; the entity-to-query-key map from Phase 4 must become the single invalidation authority to prevent drift with `query-invalidation.ts`.
- Phase 5 requires both the revision contract (Phase 2) and the client state machine (Phase 4).
- Phase 6 is last and blocks release notes claiming live multi-user support.
- If `createApplicationServices()` signature changes, coordinate with the architecture-improvement plan to avoid two competing factory shapes.

## Risks and Mitigations

- **EventSource header limitation:** native `EventSource` cannot send `Authorization`. Mitigation: fetch-based stream consumption reusing the proven ingest reader; never move the machine token to query strings without revisiting this plan.
- **Rate limiter vs. long-lived connections:** LAN-mode throttling (60 req/60 s per IP, shared across NAT'd clients) could evict healthy stream clients or allow reconnect storms. Mitigation: explicit exemptions/budgets in Phase 3 with integration tests.
- **iOS PWA suspension:** streams die silently in background; timers throttle. Mitigation: heartbeat detection, resume-triggered reconnect, and mandatory sweep-on-reconnect instead of event replay/backfill.
- **Duplicate subscriptions:** React strict mode or remounted providers can open parallel streams, causing duplicate invalidations or server connection-cap exhaustion. Mitigation: singleton guard at module/provider level and connection cap alerts server-side.
- **Missed emissions:** a new mutating route added later could bypass the bus and reintroduce silent staleness. Mitigation: emit inside domain services (not routes) with the bus as a module-level shared instance consumed by every service constructor — including the internal `?? new MealService()` / `?? new PrepListService()` fallbacks in `prep-list-service.ts` and `data-management-service.ts` — so no construction path can produce a bus-less service; add a test convention/lint rule checklist for new mutation methods.
- **Revision persistence loss/corruption:** if the counter resets backward, clients may ignore legitimate changes. Mitigation: persist durably in a Prisma meta table with the database files, increment it inside the same transaction as the mutation (so a committed mutation always has its revision), and treat a *lower* observed revision as equivalent to "unknown" (force a sweep) rather than ignoring it.
- **Battery/data concerns on mobile:** aggressive polling drains devices. Mitigation: intervals only as fallback; stream-first design keeps steady-state traffic to one heartbeat per ~30 s.
- **Scope creep toward conflict handling:** concurrent edits remain last-write-wins. Mitigation: documented as out of scope; revisit via a separate plan if real data-loss reports appear.

## Final Validation

- Run the complete automated suite: `npm run test`, `npm run lint`, `npm run build`, and `npm run docs:check:ipc`.
- Execute the two-device acceptance matrix on a real LAN (desktop Windows + Android Chrome + iPadOS Safari and installed PWA):
	1. Recipe create/edit/delete on each device reflects on all others within ~1 s while idle.
	2. Meal plan drag/add/remove and grocery/prep list edits propagate likewise.
	3. Preferences changes reflect; theme/device-local settings do not falsely sync.
	4. Server restart: all clients recover to `live` and sweep-refresh without manual action.
	5. Network interruption and PWA background/resume: recovery converges with no stale screens.
	6. Token rotation: existing streams terminate with 401 and clients surface the reconnect state instead of retry-looping.
- Confirm degraded mode by blocking the stream endpoint and verifying convergence within the polling interval.
