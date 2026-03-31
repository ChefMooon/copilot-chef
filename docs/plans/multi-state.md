> Historical note: This document is retained as integration research history. It may describe assumptions from earlier surrounding systems and is not the current source of truth for the Electron app.

**Multi-Turn State Machine Adoption Report (For Copilot-Chef Integration)**

**Purpose**
This report defines the minimum architecture your other project must implement so Copilot-Chef workflows work reliably when a response requires follow-up user input.

**Why this is required**
In Archie, message handling is single-turn and lock-serialized per user. A tool call cannot pause mid-execution, ask the user a question, and continue in the same running call. That constraint is visible in:
- text.ts
- sessions.ts
- streaming.ts

Because of this, the correct pattern is a multi-turn continuation model.

---

**Executive Decision**
Adopt a multi-turn state machine for Copilot-Chef interactions.

- Turn A: call chat endpoint
- If Chef needs more info: return needs_input payload and persist pending state
- Turn B: user replies in a new message
- Turn B processing: call respond-to-input endpoint using stored request/session state
- Continue normal completion

This keeps transport and endpoint usage intact while changing orchestration control flow.

---

**Required Architecture Capabilities**

1. Persistent pending-turn state
- Store per user (and per conversation if your app supports multiple parallel conversations):
- copilotSessionId
- chatSessionId
- pendingInputRequestId
- pendingQuestion
- updatedAt
- Optional: retryCount, lastErrorCode, lastRequestId

2. Explicit state machine states
- idle
- waiting_for_input
- completing_input
- completed
- failed

3. Deterministic message router
- On new incoming user message:
- If state is waiting_for_input, route to respond-to-input flow
- Else route to normal chat flow

4. Tool/adapter contract
- Normal success result: assistant text and optional action payload
- Needs-input result: status = needs_input, question, requestId
- Never block waiting for user input in-process

5. Retry and recovery policy
- 404 session expired: clear session id and retry once
- 429/5xx: exponential backoff, max bounded retries
- 401/403: fail fast, surface auth issue
- Stream interruption: one bounded retry strategy

6. Observability
- requestId
- endpoint
- statusCode
- responseMode
- latencyMs
- retries
- hadPendingInput flag
- session ids present flags (do not log secret values)
- input roundtrip completion rate metric

7. Secret handling
- No secret/token in logs
- Header redaction required
- Config loaded from secure runtime source (.env or stronger mechanism)

---

**Reference Architecture Mapping (from Archie)**
Use these files as implementation guidance patterns:
- Tool registration and async handler model: tools.ts
- Session serialization/locking behavior: sessions.ts
- Per-message flow and lock scope: text.ts
- Streaming response delivery constraints: streaming.ts
- Persistence/migrations pattern: db.ts
- Runtime config model: config.ts

---

**Protocol-Level Contract You Should Enforce**

Normal chat request
- Send user message with current copilotSessionId/chatSessionId when available
- Parse response
- Update stored session ids if returned

Needs-input detection
- If provider indicates input request:
- Return needs_input result immediately
- Persist pendingInputRequestId and question
- Ask user question in normal outbound assistant message

Respond-to-input request
- On next user message:
- Read pendingInputRequestId
- Send user answer to respond-to-input endpoint
- Clear pending fields on success
- Return assistant completion

---

**Acceptance Criteria (Must Pass Before Rollout)**

1. New conversation creates and persists session ids.
2. Follow-up conversation reuses session ids.
3. Needs-input response creates waiting_for_input state.
4. Next user reply resolves pending input and clears state.
5. No deadlock when user replies during long-running interactions.
6. 404 session expiration self-heals with one clean retry.
7. 429/5xx retries stay bounded and observable.
8. No auth token leakage in logs or traces.
9. End-to-end meal and recipe workflows complete successfully in both normal and needs-input paths.

---

**Common Failure Modes to Avoid**

- Trying to pause a running tool call and wait for user input in the same call stack
- Holding a per-user lock while expecting a second user message to arrive for continuation
- Not persisting pending input state durably
- Losing session ids between turns
- Logging authorization headers

---

**Implementation Readiness Checklist**

- State table/schema exists and is indexed for fast lookup by user/conversation
- Router checks pending state before normal chat dispatch
- Tool/adapter returns explicit needs_input shape
- Respond-to-input handler exists and is wired to next-turn path
- Retry policy implemented and bounded
- Logging redaction tested
- Integration tests include multi-turn and expired-session scenarios
- Dashboard includes input-roundtrip success metric
