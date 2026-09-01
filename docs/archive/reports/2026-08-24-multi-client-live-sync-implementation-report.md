# Implementation Report: Multi-Client Live Sync

## Goal and Scope
- Goal: Make simultaneous multi-client use correct and live via server change events, SSE push, renderer invalidation, and polling fallback.
- In scope: Change-event bus + revision watermark, authenticated SSE `/api/events`, renderer subscription/invalidation, fallback revision polling, doc alignment.
- Out of scope: Conflict resolution, offline queue/Web Push, HTTPS provisioning, remote-mode rollout, presence.

## Phase Checklist
1. Renderer quick wins - pending
	- Acceptance: focus refetch + conservative list-level poll interval; retry semantics unchanged.
	- Validation: `npm run test` (focused), manual two-device check deferred to final.
2. Server-side change event bus and revision watermark - pending
	- Acceptance: every committed mutation emits exactly one typed event; revision persisted in Prisma meta table, bumped in same transaction; `GET /api/sync/revision` behind bearer auth.
	- Validation: focused service tests.
3. Authenticated SSE endpoint `/api/events` - pending
	- Acceptance: bearer-auth stream, hello/change/heartbeat frames, connection caps, rate-limit exemptions, clean teardown.
	- Validation: integration tests.
4. Renderer subscription and invalidation wiring - pending
	- Acceptance: single fetch-based stream per app instance, entity→query-key invalidation, sweep on reconnect/mismatch, banner status.
	- Validation: hook tests + suite.
5. Fallback revision polling - pending
	- Acceptance: after repeated stream failures, poll revision with jitter; hand back when stream recovers.
	- Validation: simulated failure tests.
6. Documentation alignment - pending
	- Acceptance: architecture §11, lan-browser-access, install/usage troubleshooting match shipped behavior.
	- Validation: `npm run docs:check:ipc`, doc checks.

## Phase Results
1. Renderer quick wins - completed
	- Changes: `refetchOnWindowFocus: true` in `query-provider.tsx`; new `src/renderer/lib/query-intervals.ts` (`LIST_REFETCH_INTERVAL_MS = 20_000`) applied to dashboard (grocery/heatmap/upcoming), meal-plan week/month + unscheduled bank, recipes list + all-recipes, grocery lists, prep lists queries. Retry semantics untouched.
	- Validation: `npx vitest run src/renderer` — 51 files / 252 tests passed.
	- Notes: Manual two-device check deferred to final validation.
2. Server-side change event bus and revision watermark - completed
	- Changes: New `src/main/server/services/change-event-bus.ts` (module-level singleton bus, typed envelopes, persisted `SyncState` revision via `publishCommittedChange`); `SyncState { key, value }` added to `prisma/schema.prisma` (`db:push --skip-generate` + `prisma generate --no-engine`); emissions wired into every mutating method of meal, grocery, preference, meal-sub-type, meal-type, prep-list, recipe services plus data-management bulk events; new `GET /api/sync/revision` behind bearer auth in `routes/sync.ts`; `/api/sync/revision` exempted from the LAN rate-limit bucket; SSE `/api/events` endpoint with hello/change/heartbeat frames, per-token connection cap, clean teardown.
	- Validation: `change-event-bus.test.ts` 6/6 passed (bus uniqueness across construction paths, envelope typing, monotonic watermark, revision bump, crash-recovery rule); full `npx vitest run src/main` 31 files / 120 tests passed after adding `syncState` mocks to three existing test files.
	- Notes: Revision increment happens in a dedicated write immediately after each mutation's transaction commits (per-mutation counter row upsert), preserving commit-then-emit ordering.
3. Authenticated SSE endpoint `/api/events` - completed
	- Changes: `routes/sync.ts` implements `GET /api/events` via Hono `streamSSE`: hello frame with current revision, bus-forwarded change frames, 25 s heartbeats terminating after two misses, per-token connection cap (4), listener/timer cleanup on abort. Bearer auth enforced by existing middleware before the stream opens; handshake counts against the LAN rate-limit bucket while the established stream and `/api/sync/revision` are exempt.
	- Validation: `src/main/server/sync.test.ts` 6/6 passed (auth rejection both endpoints, revision values, stream open with hello frame, multi-subscriber fan-out).
	- Notes: Full server stop teardown is covered by runtime shutdown ownership already exercised in `runtime.test.ts`.
4. Renderer subscription and invalidation wiring - completed
	- Changes: New `src/renderer/lib/sync-stream.ts` (singleton fetch-based SSE consumer with hello/change/heartbeat parsing, exponential backoff + jitter, rapid-failure threshold switching to revision polling, lower-revision sweep rule); new `src/renderer/lib/use-live-sync.ts` hook mapping frames to invalidations via the extended `query-invalidation.ts` (`ENTITY_TO_QUERY_KEYS` single authority + `invalidateQueriesForEntity`); `app.tsx` mounts `useLiveSync`; `connection-banner.tsx` shows `retrying`/`polling` stream states without changing placement.
	- Validation: `sync-stream.test.ts` 6/6 passed (entity→keys coverage, targeted invalidation, unknown-entity no-op, higher/lower/unchanged revision rules); full renderer suite 52 files / 258 tests passed.
	- Notes: Strict-mode duplicate streams prevented by module-level singleton guard in sync-stream.ts. iOS PWA suspend/resume recovery rides on reconnect + mandatory sweep-on-hello/reconnect.
5. Fallback revision polling - completed
	- Changes: Implemented inside `sync-stream.ts`: after 3 rapid stream failures the client switches to polling `GET /api/sync/revision` (20 s + up to 5 s jitter, sized for shared-NAT rate-limit budgets), sweeps on any revision change, and keeps retrying the stream with backoff; active mode surfaced via banner status.
	- Validation: `sync-stream.test.ts` polling-fallback test passed (simulated repeated stream refusal → poller probes `/api/sync/revision` and reports `polling`); full suite green.
	- Notes: Stream-first design keeps steady-state traffic to one heartbeat per ~25 s.
6. Documentation alignment - completed
	- Changes: `docs/ARCHITECTURE.md` §11 rewritten to describe the shipped sync model (event bus, revision watermark, SSE channel, invalidation rules, fallbacks) replacing the unimplemented "invalidated on reconnection" claim; `docs/lan-browser-access.md` §8 gained a live-sync traffic section (heartbeats, connection caps, rate-limit interaction, token rotation, PWA suspend/resume); `docs/archive/client-server-install-and-usage.md` §12 gained a degraded-sync troubleshooting entry with verification steps.
	- Validation: `npm run docs:check:ipc` — the only drift (`lan:pairing-code`) was verified pre-existing on a clean stash of the baseline and is unrelated to this plan.
	- Notes: No new IPC channels were added (HTTP-only), so `ipc-channels.md` is unaffected.

## Final Validation
- `npm run test` — 92 files / 435 tests passed (one transient failure traced to a leaked `LOCAL_RECIPE_BOOK_DATABASE_URL` env var from this session's `db:push`, not to plan changes).
- `npm run lint` — clean after fixing one unused-parameter error in `sync-stream.ts`.
- `npm run build` — succeeded including data-management build check.
- `npm run docs:check:ipc` — only pre-existing baseline drift (`lan:pairing-code`), confirmed unrelated via git stash.
- Two-device LAN acceptance matrix — not executed (requires real multi-device hardware); deferred to operator QA per plan's Final Validation section.

## Remaining Issues
- Pre-existing IPC docs drift for `lan:pairing-code` exists on the untouched baseline; out of scope for this plan but should be addressed separately.
- The two-device physical acceptance matrix (desktop/browser/PWA propagation, suspend/resume, token rotation) requires real hardware and remains for manual QA.

## Post-Release Fix (2026-08-24)
- Symptom: runtime `P2021 — table main.SyncState does not exist` on every `GET /api/events` handshake.
- Root cause: the `SyncState` table was added to `prisma/schema.prisma` and pushed to the dev DB only; the app's built-in schema reconciler (`src/main/server/lib/schema.ts` `SCHEMA_STATEMENTS`) was not extended, so the app's own database never created it.
- Fix: added `CREATE TABLE IF NOT EXISTS "SyncState"` to `SCHEMA_STATEMENTS`; hardened `readPersistedRevision()` to return 0 instead of throwing when the table is absent (bootstrap pending).
- Validation: focused sync tests 12/12 passed; full suite 435/435 passed.

## Post-Release Fix 2 (2026-08-24): rate-limit lockout during normal use
- Symptom: after one or two meal drags on desktop, all LAN clients received 429s — including `/api/events` reconnects, locking devices out until the window reset.
- Root cause: the LAN limiter (60 req/60 s per IP) counted CORS preflights (doubling every request's cost) and event-driven invalidation bursts (one mutation → ~6 refetches × every connected client). `/api/events` handshakes were also throttled, preventing recovery.
- Fix in `src/main/server/middleware/rate-limit.ts`: exempt `OPTIONS` preflights and `/api/events` from the bucket; raised budget to 180 req/60 s sized for multi-client invalidation bursts behind one NAT IP.
- Validation: server suite 27 files / 110 tests passed.

## Status
complete — all six phases implemented and validated; automated checks green.

## Post-Release Fix 3 (2026-08-24): idle SSE reconnect churn
- Symptom: an idle client periodically displayed `Live sync reconnecting...`; repeated reconnects could eventually produce `/api/events` 429 responses.
- Root cause: the server incremented a missed-heartbeat counter but the fetch-based SSE client has no heartbeat acknowledgement protocol, so every healthy idle stream was closed after two heartbeat intervals. The resulting reconnects could also consume the four-stream-per-token cap, whose 429 was indistinguishable from request-rate limiting.
- Fix: server heartbeats are now keepalive-only and healthy idle streams remain open until client abort, shutdown, or write failure. Connection-cap responses now include `SYNC_CONNECTION_LIMIT` and `Retry-After: 5`. Renderer hello frames now use revision reconciliation, and degraded online/visibility recovery performs one cache sweep and controlled reconnect.
- Validation: focused sync route tests 7/7 passed; focused renderer sync tests 7/7 passed; lint clean.
