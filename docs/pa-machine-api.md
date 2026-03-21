# PA Machine API Contract (Slice 2)

This document defines the current machine-facing contract for authenticated PA calls.

## Auth Model

Machine endpoints use bearer token auth and caller identity mapping.

- `PA_MACHINE_AUTH_ENABLED`: `1` or `true` to require machine auth.
- `PA_MACHINE_AUTH_TOKENS`: comma-separated token mappings in this format:
  - `token=callerId[:source]`
  - Example: `token-a=max-pa:max-assistant,token-b=ops-bot:automation`
- Fallback single-token mode:
  - `PA_MACHINE_AUTH_TOKEN`
  - Optional: `PA_MACHINE_CALLER_ID` (default `max-pa`)
  - Optional: `PA_MACHINE_SOURCE` (default `machine`)

When machine auth is disabled, requests without bearer auth are treated as:

- `callerId = web-default`
- `source = web`

## Protected Endpoints

- `POST /api/chat`
- `POST /api/chat/respond-to-input`
- `POST /api/chat/end-session`
- `GET /api/chat-sessions`
- `POST /api/chat-sessions`
- `GET /api/chat-sessions/:id`
- `DELETE /api/chat-sessions/:id`
- `DELETE /api/chat/history`

## Identity Scoping

Chat history data is owner-scoped by `ChatSession.ownerId`.

All session and action operations are filtered by owner identity. If a caller requests a session it does not own:

- Session reads/deletes return `404`.
- Unauthorized/missing machine auth returns `401` when auth is enabled.

## Chat Request/Response

`POST /api/chat` request body (existing contract):

- `message` (required)
- `responseMode` (optional): `auto` | `json` | `stream`
- `sessionId` (optional)
- `chatSessionId` (optional)
- `pageContext` (optional)
- `pageContextData` (optional)

Response modes:

- JSON action response with `sessionId` and optional `chatSessionId`
- If `responseMode=json`, SDK text output is returned as JSON with `message`
- Streaming text response with headers:
  - `x-session-id`
  - `x-chat-session-id` (when available)
  - `x-request-id`

## Input Request Lifecycle

`POST /api/chat/respond-to-input` body:

- `sessionId` (required): Copilot session id to resolve
- `chatSessionId` (required): owner-scoped app session id
- `answer` (required)
- `wasFreeform` (required)

The route verifies that `chatSessionId` belongs to the caller and is mapped to `sessionId` before resolving the pending input request.

## Session End Control

`POST /api/chat/end-session` body:

- `sessionId` (required)
- `chatSessionId` (required)

Behavior:

- Verifies caller ownership and session mapping
- Ends the in-memory Copilot session
- Clears persisted `copilotSessionId` mapping for that chat session

## Notes

- After Prisma schema updates, run:
  - `npm run db:push`
  - `npm run db:generate`
- Existing sessions default to `ownerId = web-default` unless explicitly backfilled.
