# Copilot Chef Service + API Upgrade Plan

## Objective

Run Copilot Chef as a durable service that can be safely called by an external personal assistant (PA), with secure auth, identity scoping, stable session behavior, and a documented machine-facing contract for meal-plan and recipe operations.

## Success Criteria

- PA can start and continue chat sessions over HTTP using persistent session identifiers.
- PA can add, edit, remove, and query meals, grocery items, and recipes through the existing Copilot orchestration.
- All PA calls are authenticated and authorized.
- Chat/session data is scoped to a caller identity and cannot leak across identities.
- Input-request loops (ask-user flow) are fully supported via API.
- Behavior is verified with automated tests for auth, session continuity, and CRUD actions.

## Current State Summary

- Stateful chat entrypoint exists at /api/chat with mixed response modes (JSON action responses and text streaming).
- Session continuity exists via sessionId and chatSessionId.
- Chat history persistence exists, but with no owner/tenant field on chat models.
- Input request resolution endpoint exists at /api/chat/respond-to-input.
- API routes currently do not enforce service-to-service authentication.

## Non-Goals

- Replacing Copilot SDK orchestration internals.
- Rewriting all command fallback logic in /api/chat.
- Multi-region deployment in this phase.

## Architecture Decision

1. Keep Next.js API routes as the machine-facing integration layer.
2. Add service-to-service auth middleware/helper on machine endpoints.
3. Add identity ownership to chat session data and enforce row-level filtering in services.
4. Preserve existing dual-session model:
   - sessionId: Copilot SDK session continuity
   - chatSessionId: app-level history and undo/redo continuity
5. Standardize response contract documentation for both JSON and streaming mode.

## Workstreams

## Workstream A: Security and Caller Identity

### A1. Add machine auth for PA access

- Introduce a shared secret or signed token validation (preferred: Bearer token with HMAC/JWT).
- Implement a reusable auth helper for machine routes.
- Apply auth to:
  - /api/chat
  - /api/chat/respond-to-input
  - /api/chat-sessions
  - /api/chat-sessions/[id]
  - any newly added machine endpoints for session operations

### A2. Identity propagation

- Define caller identity shape:
  - callerId (required)
  - source (optional, e.g. "max-pa", "web")
- Extract identity from auth token and pass it into service methods.

### A3. Authorization checks

- Enforce that session read/delete/update operations require matching callerId ownership.
- Return 404 for unknown sessions and 403 only when useful for debugging in non-production.

## Workstream B: Data Model Hardening

### B1. Prisma schema updates

- Add ownership fields:
  - ChatSession.ownerId (required)
  - Optionally ownerType/source for analytics and future partitioning
- Add index for owner-scoped queries:
  - @@index([ownerId, updatedAt])
- Keep existing relations intact.

### B2. Service updates

- Update ChatHistoryService methods to require ownerId where relevant:
  - createSession(ownerId, title?)
  - getSession(ownerId, id)
  - listSessions(ownerId, limit?)
  - deleteSession(ownerId, id)
  - addMessage(ownerId, chatSessionId, ...)
  - recordAction(ownerId, ...)
- Add centralized helper to resolve a session by id + owner.

### B3. Migration and seeding strategy

- For local SQLite, use db:push for iterative schema update.
- Backfill strategy:
  - assign existing records to a default owner for dev migration (configurable value)
  - include script note for one-time conversion

## Workstream C: API Contract Stabilization

### C1. Define PA request/response contract

- Request fields:
  - message
  - sessionId (optional)
  - chatSessionId (optional)
  - pageContext (optional)
  - pageContextData (optional)
- Response modes:
  - JSON action response
  - text/plain streaming response
- Headers in stream mode:
  - x-session-id
  - x-chat-session-id

### C2. Add endpoint documentation in-repo

- Create docs for:
  - auth requirements
  - mode handling (JSON vs stream)
  - input-request lifecycle
  - error codes and retry behavior

### C3. Optional hardening enhancement

- Add explicit request field responseMode: "auto" | "json" | "stream".
- Default auto keeps compatibility.
- PA can request json for deterministic parsing.

## Workstream D: Session Reliability

### D1. Runtime model

- Deploy in a persistent process environment (not aggressively ephemeral).
- Ensure writable session config directory is available to runtime.

### D2. Resume behavior validation

- Verify chat continuation after process restart using persisted sessionId.
- Verify graceful fallback when a Copilot SDK session cannot be resumed.

### D3. Operational controls

- Add endpoint or admin mechanism to end sessions intentionally when needed.
- Add logs with correlation ids:
  - requestId
  - callerId
  - sessionId
  - chatSessionId

## Workstream E: Test Plan

### E1. Unit tests

- Auth helper token validation
- ownerId scoping in ChatHistoryService methods
- session resolution rules

### E2. Route integration tests

- Unauthorized requests are rejected
- Authorized requests can create/list/get/delete only own sessions
- /api/chat returns expected session headers in stream mode
- /api/chat/respond-to-input resolves pending input requests

### E3. End-to-end tests (happy path)

- Start new conversation (no ids)
- Perform meal add/edit/remove intents
- Ask recipe question and save/modify recipe
- Continue same session across multiple turns
- Validate persisted history and action records under owner

## Implementation Sequence

1. Add auth helper and token config.
2. Update Prisma schema with ownerId and indexes.
3. Refactor ChatHistoryService for owner-scoped methods.
4. Update chat and session routes to pass caller identity.
5. Add/adjust tests for auth and ownership.
6. Add API contract doc for PA integration.
7. Run manual PA smoke tests with curl/Postman script.

## Risk Register

- Risk: breaking current web UI flow while introducing required ownerId.
  - Mitigation: support a web default owner identity path during transition.
- Risk: PA fails to parse mixed response modes.
  - Mitigation: add responseMode option and provide client reference implementation.
- Risk: session resume inconsistency across deployment environments.
  - Mitigation: document runtime requirements and add restart/resume tests.

## Rollout Plan

1. Merge behind feature flag PA_MACHINE_AUTH_ENABLED.
2. Enable in dev and run PA integration smoke tests.
3. Enable in staging with one PA identity.
4. Observe logs and error rates for 48 hours.
5. Enable in production.

## Deliverables

- Updated schema and services with owner scoping.
- Authenticated machine endpoints for chat/session operations.
- Documented PA integration contract.
- Automated tests for auth, ownership, and session continuity.
- Operational runbook notes for deployment/runtime requirements.
