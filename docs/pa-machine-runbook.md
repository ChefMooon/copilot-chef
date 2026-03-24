# PA Machine API Runbook

This runbook covers deployment toggles, smoke checks, and recovery actions for PA machine integrations.

## Environment Toggles

- `PA_MACHINE_AUTH_ENABLED`
  - `1` or `true` requires bearer token auth.
- `PA_MACHINE_STRICT_ROUTES`
  - `1` or `true` disallows fallback `web-default` identity on machine routes.
  - Enable this in PA-only environments.
- `PA_MACHINE_AUTH_TOKENS`
  - Comma-separated `token=callerId[:source]` mappings.

Recommended production baseline:

- `PA_MACHINE_AUTH_ENABLED=1`
- `PA_MACHINE_STRICT_ROUTES=1`
- `PA_MACHINE_AUTH_TOKENS` configured with at least one PA token

## Health Smoke (Curl)

Set variables first:

```bash
BASE_URL="http://localhost:3000"
TOKEN="<machine-token>"
REQ_ID="smoke-$(date +%s)"
```

1. Start chat in JSON mode:

```bash
curl -sS "$BASE_URL/api/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-request-id: $REQ_ID-1" \
  -d '{"message":"Plan 3 dinners for this week","responseMode":"json"}'
```

Capture `sessionId` and `chatSessionId` from the response.

2. Start chat in stream mode:

```bash
curl -i -N "$BASE_URL/api/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-request-id: $REQ_ID-2" \
  -d '{"message":"Give me one quick dinner idea","responseMode":"stream"}'
```

Verify headers include:

- `x-session-id`
- `x-chat-session-id`
- `x-request-id`

3. Resolve pending input request (if prompted by assistant):

```bash
curl -sS "$BASE_URL/api/chat/respond-to-input" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-request-id: $REQ_ID-3" \
  -d '{"sessionId":"<sessionId>","chatSessionId":"<chatSessionId>","answer":"Yes","wasFreeform":true}'
```

4. End session intentionally:

```bash
curl -sS "$BASE_URL/api/chat/end-session" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-request-id: $REQ_ID-4" \
  -d '{"sessionId":"<sessionId>","chatSessionId":"<chatSessionId>"}'
```

Expected result:

- `{"ok":true,...}`
- Retry should return `alreadyEnded=true`.

## Failure Matrix

- `401 Unauthorized machine request`
  - Token missing/invalid, or strict mode enabled without bearer token.
- `404 Session not found`
  - Session not owned by caller, wrong IDs, or stale mapping.
- `400 Unable to ...`
  - Body shape invalid or route-level validation error.

Use `requestId` from response body/headers to correlate server logs.

## Recovery Actions

1. Token rotation
- Add new token mapping to `PA_MACHINE_AUTH_TOKENS`.
- Deploy.
- Shift PA callers to new token.
- Remove old token mapping in next deploy.

2. Stale session mapping
- Call `/api/chat/end-session` with current IDs to clear mapping.
- Start a new `/api/chat` conversation and continue with returned IDs.

3. Strict mode rollout
- Enable `PA_MACHINE_AUTH_ENABLED=1` first.
- Verify smoke tests.
- Enable `PA_MACHINE_STRICT_ROUTES=1`.
- Re-run smoke tests before production promotion.

## Post-Restart Verification

After a process restart, existing `chatSessionId → copilotSessionId` mappings
are preserved in the database. Use the session probe endpoint to confirm the
mapping is intact before asking the PA to continue a conversation.

```bash
curl -sS "$BASE_URL/api/session-probe?chatSessionId=<chatSessionId>" \
  -H "Authorization: Bearer $TOKEN"
```

**Status values:**

| Status | Meaning |
|---|---|
| `resumable` | Mapping found; next `chat()` will attempt `resumeSession` |
| `disconnected` | Session was explicitly ended — start a new conversation |
| `not_found` | Session not owned by this caller or ID is wrong |

**Typical restart sequence:**

1. Restart the process.
2. Probe each active `chatSessionId` via the endpoint above.
3. If `resumable`, send the next message normally — the server will call `resumeSession` automatically.
4. If `disconnected`, start a new `/api/chat` conversation and update your stored IDs.
5. If `not_found`, verify the token maps to the same `callerId` as when the session was created.
