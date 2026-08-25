# Plan: PWA Connection Screen Input Improvements

## Goal

Improve the `/connect` page (`src/renderer/pages/connect.tsx`) so that:

1. The API address is entered as a **single host field + separate port field** — no manual `http://` typing.
2. The pairing code uses an **OTP-style segmented input** (4 digit boxes) with auto-advance forward on entry and backspace-to-previous when the current box is empty.
3. The token field gets **matched styling and a show/hide toggle** (single input, not segmented).

## Decisions (closed)

| ID | Decision | Choice |
|---|---|---|
| d1-host-format | Address entry format | Single host text field (IP or hostname allowed) + separate port field |
| d2-paste | Paste handling | Smart paste: pasting `http://host:port` into host/port fields parses and distributes values |
| d3-port-default | Port default | Prefill `3001`, editable |
| d4-token-input | Token field treatment | Styled single field with show/hide toggle; not segmented |
| d5-next-step | Handoff | This plan file, then implementation |

## Non-Goals

- No backend changes: `/api/pairing/redeem`, `createPairingCode` IPC, and platform methods (`redeemBrowserPairingCode`) are unchanged.
- No HTTPS support; scheme is always composed as `http://`.
- No changes to deep-link import (`importBrowserConnectionFromLocation`) format.

## Implementation

### 1. Shared components

Create `src/renderer/components/ui/segmented-code-input.tsx`:

- Props: `length` (number of segments), `value: string`, `onChange(value: string)`, `label`, `id`.
- Behavior:
  - Each segment is `<input inputMode="numeric" maxLength={1}>`; digits only.
  - Typing a digit fills current segment and advances focus to next.
  - Backspace on empty segment moves focus to previous segment (and clears it).
  - Arrow Left/Right navigate between segments.
  - Full-value paste distributes digits across segments starting at focus position (or index 0).
  - Accessible: single visually-hidden label announcing "X-digit code"; each segment has `aria-label="Digit N of X"`.

### 2. Connect page changes (`src/renderer/pages/connect.tsx`)

State changes:

- Replace `apiUrl` state with `host: string` and `port: string` (port initialized to `"3001"`).
- On mount / hydration from `saved?.apiUrl` or `cachedConfig?.url`: parse full URL via `new URL()` to extract hostname and port (default port `3001` if absent). Wrap in try/catch; fall back to empty host + `3001`.

Composition:

- Add helper `composeApiUrl(host, port): string` → `` `http://${host.trim()}:${port.trim() || "3001"}` `` with trailing-slash normalization (reuse existing `normalizeApiUrl` semantics).
- `handleConnect` and `handlePair` validate: host non-empty, port numeric 1–65535; error messages updated ("Enter the server address." etc.).

Smart paste:

- On paste in host or port field: if clipboard matches `^https?:\/\/[^\/]+:\d+`, parse and set both `host` and `port`, prevent default.

Pairing code:

- Replace single pairing input with `SegmentedCodeInput length={4}` bound to existing `pairingCode` state. Auto-submit is NOT enabled; user still clicks "Pair with code".

Token field:

- Keep single password input; add eye/eye-off toggle button (Phosphor icons per project convention) switching `type` between `password` and `text`. Match border/focus styling used by host/port fields.

### 3. Tests (`src/renderer/pages/connect.qa.test.tsx`)

Update/add:

- Existing label queries updated: host field labeled "Server address", port labeled "Port".
- New tests:
  - Hydration: saved connection URL populates host/port correctly.
  - Validation: empty host blocks connect with visible message.
  - Smart paste distributes `http://192.168.1.25:3001` into both fields.
  - SegmentedCodeInput: type-forward auto-advance, backspace-back navigation, paste distribution (component-level test file `src/renderer/components/ui/segmented-code-input.test.tsx`).

## Acceptance Criteria

- [ ] User can connect by entering only an IP/host and confirming prefilled port; no `http://` typing required.
- [ ] Pasting a full URL into either field populates host and port.
- [ ] Pairing code entry auto-advances forward and backspaces backward between boxes.
- [ ] Token field has show/hide toggle and consistent styling.
- [ ] Saved connections and `#api=` deep links hydrate the new fields correctly.
- [ ] All QA tests pass (`npm run test`); no regressions in existing connect flows.

## Risks

- `new URL()` parsing of bare IPs requires a scheme — always prepend `http://` before parsing during hydration.
- jsdom focus behavior differs slightly from browsers; keep component logic testable via value assertions plus focus checks where reliable.

## Verification

1. `npm run test`
2. Manual: build web (`npm run build:web`), open `/connect`, exercise smart paste, segmented code entry, token toggle, saved-connection hydration.
