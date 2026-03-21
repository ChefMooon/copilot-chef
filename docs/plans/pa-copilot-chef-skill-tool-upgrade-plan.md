# PA Upgrade Plan: Robust Skill/Tool for Copilot Chef

## Objective

Upgrade the PA so it can reliably call Copilot Chef as an external capability for:

- Adding, editing, and removing meal plans
- Asking meal-plan questions
- Asking recipe questions
- Creating and updating recipe records through Copilot Chef flows

The PA should be resilient to mixed response modes, session continuity requirements, and user-input follow-up prompts.

## Success Criteria

- PA can execute end-to-end meal and recipe workflows from natural-language user requests.
- PA preserves conversation continuity by storing and reusing sessionId + chatSessionId.
- PA handles both JSON and streaming responses without data loss.
- PA supports input-request interruptions and resumes correctly.
- PA tool usage is observable, retry-safe, and testable.

## Recommended Integration Pattern

Use both a Skill and a Tool:

1. Skill (knowledge): teaches the PA when/how to call Copilot Chef endpoints, how to choose context, and how to recover from failures.
2. Tool (capability): performs authenticated HTTP calls, streaming assembly, session-id persistence, and structured result mapping.

## Target Capability Map

### Meal plan actions

- Add meals (day/date/meal-type aware)
- Move or replace meals
- Remove meals
- Undo/redo when exposed by Copilot Chef chat actions
- Ask planning questions (e.g., "what is planned for Thursday?")

### Recipe actions

- Ask recipe questions (ingredients, substitutions, steps)
- Trigger save/modify/delete recipe actions via Copilot Chef chat pathways
- Query recipe list/details through Copilot Chef conversationally

## Tool Contract (PA Side)

Define one primary tool, for example: copilot_chef_chat.

### Inputs

- userMessage: string
- userId: string
- conversationId: string
- pageContext: optional string
- pageContextData: optional object
- preferredMode: optional enum (auto | json | stream)

### Internal state the tool manages

- copilotSessionId per PA conversation/user
- chatSessionId per PA conversation/user
- lastKnownContext metadata (optional)

### Outputs

- assistantText: string
- action: optional structured action payload
- choices: optional array of assistant choices
- sessionState:
  - copilotSessionId
  - chatSessionId
  - hadInputRequest (boolean)
- diagnostics:
  - responseMode
  - statusCode
  - retryCount

## Skill Design

Create a dedicated skill (example slug: copilot-chef-bridge) containing:

- Purpose and boundaries
- Endpoint contract summary
- Rules for when to send pageContext/pageContextData
- Session continuity rules
- Error recovery and retry strategy
- Input-request follow-up handling instructions
- Privacy constraints (never log secrets; redact headers)

### Skill decision rules

- If user request is meal-plan or recipe related, prefer copilot_chef_chat tool.
- Reuse stored ids when available; create new session only when needed.
- If response indicates missing context, ask concise clarifying question.
- If input_request is emitted, gather user answer and call respond-to-input endpoint.

## Session and State Strategy

Persist mappings in PA storage:

- key: userId + conversationId + "copilot-chef"
- value:
  - copilotSessionId
  - chatSessionId
  - updatedAt

### Lifecycle rules

- On first call, send without ids and store returned ids.
- On subsequent calls, always send both ids.
- On invalid/expired session response, clear copilotSessionId and retry once.
- Preserve chatSessionId unless server indicates it is invalid.

## Response Handling Strategy

### JSON response path

- Parse message, choices, and action directly.
- Update ids from payload fields if present.

### Streaming response path

- Buffer text stream to final assistant text.
- Capture x-session-id and x-chat-session-id headers.
- Parse sentinel control events if present.
- If input request is emitted:
  - pause completion
  - ask user via PA interface
  - POST /api/chat/respond-to-input
  - resume and finalize result

## Error Handling and Retry Policy

- 401/403:
  - do not retry blindly
  - raise auth configuration issue
- 400 validation errors:
  - provide user-facing correction question
- 404 session not found:
  - clear local ids and retry once with new session
- 429/5xx:
  - exponential backoff retries (max 2)
- stream interruption:
  - attempt one resume by reissuing last user turn with same ids

## Observability Requirements

Log (without secrets):

- requestId
- userId hash
- conversationId
- endpoint
- statusCode
- responseMode
- latencyMs
- retries
- sessionId/chatSessionId presence

Emit PA-level metrics:

- success rate per endpoint
- retry rate
- auth failure count
- average latency
- input-request completion rate

## Security Requirements

- Store Copilot Chef auth tokens in secure secret storage.
- Never expose tokens in prompt context, logs, or user-visible traces.
- Redact authorization headers in debug output.
- Enforce allowlist for base URL and endpoint paths.

## Test Plan (PA Side)

### Unit tests

- Session state read/write
- JSON parser and stream assembler
- Retry classifier by status code
- Sentinel/input-request parser

### Integration tests

- New conversation creates ids
- Continued conversation reuses ids
- Meal add/edit/remove flows return expected PA output
- Recipe query and recipe-save flow works end to end
- Input-request roundtrip succeeds

### Resilience tests

- Simulate expired session ids
- Simulate transient 500 and confirm retries
- Simulate stream interruption and verify fallback behavior

## Implementation Sequence

1. Build PA tool wrapper for /api/chat and /api/chat/respond-to-input.
2. Add persistent session state storage adapter.
3. Implement response-mode handlers (json + stream).
4. Add input-request roundtrip handling.
5. Add retry/error policy.
6. Create and register copilot-chef-bridge skill instructions.
7. Add automated tests and smoke-test scripts.
8. Run staged rollout with one PA persona, then expand.

## Rollout Plan

1. Dev: test against local Copilot Chef instance.
2. Staging: enable for internal PA traffic only.
3. Production canary: 5-10% of meal/recipe requests.
4. Full rollout after stability window.

## Deliverables

- New PA tool implementation for Copilot Chef chat calls.
- New PA skill instructions for meal/recipe orchestration.
- Session persistence and retry framework.
- Automated test suite and smoke-test checklist.
- Operational dashboard/metrics for ongoing reliability.
