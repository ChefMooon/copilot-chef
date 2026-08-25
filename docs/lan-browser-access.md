# Local Recipe Book LAN and Browser Access

## 1. Purpose and Scope

This document is the canonical reference for LAN and browser access in Local Recipe Book.

It covers:
- Trusted-device browser access on local networks
- Machine token lifecycle for browser clients
- LAN runtime settings and connection flow
- Operational and troubleshooting guidance

It does not cover legacy machine-integration workflows outside LAN/browser access.

---

## 2. Runtime Model

Local Recipe Book supports local, remote, and LAN/browser access patterns.

- Local mode:
  - The embedded API runs inside the Electron app.
  - The renderer receives API URL and auth token from IPC.
- LAN mode:
  - API binds to `0.0.0.0` when `lan_enabled` is enabled.
  - Static web server can be enabled independently for browser UI.
  - LAN clients connect over HTTP using a persistent browser access token.
- Remote mode:
  - Embedded API is skipped.
  - Renderer connects to `remote_server_url` with `remote_api_key`.

When LAN is enabled, the app advertises a selected LAN IPv4 host and can probe local reachability for firewall diagnostics.

---

## 3. Authentication Model for Browser/LAN Clients

All `/api/*` routes except `/api/health` require `Authorization: Bearer <token>`.

Browser/LAN clients use a persistent token stored in Electron settings:
- `machine_api_key`
- `machine_api_key_updated_at`

This token differs from the per-session local desktop token:
- Desktop token: ephemeral, generated each app session
- Browser access token (`machine_api_key`): persistent until rotated or cleared

Token matching is timing-safe in auth middleware.

---

## 4. Connection Methods

### Manual connection

Use the browser Connect page and enter:
- API URL
- Bearer token

The app verifies:
1. `GET /api/health` for server reachability
2. Authenticated probe (`/api/preferences`) for token validity

### QR and connection-link onboarding

The Settings page can generate a link with URL fragment credentials:

```text
http://<browser-host>:4173/connect#api=http%3A%2F%2F<api-host>%3A3001&token=<encoded-token>
```

Notes:
- Token is in URL fragment (`#...`), not query params.
- Browser imports credentials from fragment and then strips it from address bar/history.
- Credentials are persisted in browser local storage for reconnects.

### Installed PWA pairing

Safari tabs and installed iPadOS PWAs can use separate browser storage. A
connection saved in Safari therefore cannot silently authenticate an installed
PWA. To pair the installed app:

1. Connect Safari using the current connection link or saved credentials.
2. Open the Connect page and create a one-time pairing code. Desktop Settings
  can also create a code as a recovery path.
3. Open the installed PWA and enter the API URL and pairing code on its Connect
  page.
4. The PWA redeems the code, verifies the API, and stores the existing browser
  access token in its own storage context.

Pairing codes contain exactly four numeric digits, including leading zeroes
such as `0042`. They expire after five minutes, are single-use, and are
invalidated when the server restarts. These short codes are intended for
convenience rather than high security, so use them only on a trusted LAN. A
rotated or cleared machine token invalidates all previously paired browser and
PWA clients. The pairing code itself does not contain the machine token and is
not placed in a URL.

Desktop Settings can show a countdown and renew the code automatically after
you explicitly create one. Automatic renewal runs only while the Settings
Connection tab is active and visible. It pauses when the tab or document is
hidden, when Settings is closed, or when you stop auto-renewal. Returning to the
visible Connection tab can create one replacement if auto-renewal is still
enabled. The Stop auto-renew control can be used to prevent further automatic
issuance; each displayed code remains subject to the server's five-minute
expiry and single-use rules.

Pairing-code requests already accepted by the desktop main process cannot be
cancelled by the renderer. If the page is hidden, navigated away from, or
closed while a request is in flight, the renderer ignores the eventual result,
but the server may still consume that unshown code.

---

## 5. Settings and Keys

LAN and browser access behavior is controlled by app settings stored in `settings.json`.

| Key | Purpose |
|---|---|
| `lan_enabled` | Enables LAN API binding (`0.0.0.0`) |
| `lan_web_enabled` | Enables static browser UI server |
| `lan_api_port` | LAN API port override |
| `lan_web_port` | Browser UI server port (default `4173`) |
| `lan_advertised_host` | Optional advertised LAN host override |
| `lan_allowed_origins` | Extra CORS origins |
| `machine_api_key` | Persistent browser access token |
| `machine_api_key_updated_at` | ISO timestamp of last generate/rotate/clear event |

Related connection settings:
- `server_mode`
- `server_port`
- `remote_server_url`
- `remote_api_key`

---

## 6. Operational Workflows

### Generate browser access token

From Settings:
- Use **Generate token** to create `machine_api_key`.
- Connection URL and QR become available for trusted devices.

### Reset browser access (rotate token)

From Settings:
- Use **Reset browser access**.
- A new token is generated.
- Existing browser sessions and older links are invalidated.
- Connected devices must re-pair using the new QR/link.

### Clear token

From Settings/internal tooling:
- Clear token removes browser access until a new token is generated.

---

## 7. Troubleshooting

### 401 Unauthorized on browser clients

Likely causes:
- Token was rotated/reset
- Invalid token pasted
- Stale saved credentials

Fix:
1. Open current QR/link from desktop Settings.
2. Reconnect via `/connect`.

### Firewall warning or unreachable LAN endpoint

Likely causes:
- OS firewall blocks inbound LAN port
- Wrong advertised host selected

Fix:
1. Verify `lan_enabled` and selected host.
2. Confirm API and web ports.
3. Add firewall allow rule for LAN API/web ports as needed.

### Bookmark opens but asks to reconnect

Likely causes:
- Browser storage cleared
- Different browser profile/PWA storage partition
- Token rotated from desktop app

Fix:
- Re-open current QR/link and reconnect.

### Installed PWA asks to reconnect after Safari was paired

This can be expected when Safari and the installed PWA have separate storage,
or when the PWA's storage was cleared or evicted. Open the current pairing code
from Safari or desktop Settings, then redeem it from the PWA Connect page.

The pairing handoff remains plain HTTP in LAN mode. The successful redemption
response necessarily carries the existing browser access token to the PWA, so
pair only on a trusted local network and rotate browser access if the network
or device is no longer trusted. HTTPS and certificate provisioning are outside
the current LAN pairing implementation.

### Installed PWA shows an older interface

The browser renderer uses a service worker to detect updated web assets. The worker script and the document entry point are revalidated, while hashed JavaScript and CSS assets remain immutable because each build gives them new filenames.

After rebuilding the browser UI:
1. Restart the LAN web server if it was already running.
2. Reopen the installed PWA or wait for it to reload after the service-worker update is activated.
3. If the old interface remains, use the browser's reload or installed-app update action, then reopen the PWA.

The PWA may briefly reload when a new service worker takes control. This prevents an already-open installed app from continuing to run an older renderer bundle.

### Remote mode confusion

In remote mode:
- Local embedded API and LAN static web services are not started.
- LAN/browser access controls in desktop local runtime do not apply.

---

## 8. Security Notes

- Treat browser access tokens as secrets.
- Share QR/link only with trusted devices on trusted networks.
- Prefer token rotation when devices are lost or trust changes.
- Keep LAN disabled when external browser access is not needed.

### Live-sync channel traffic

Connected clients hold one long-lived SSE stream to `GET /api/events` (bearer-authenticated). Steady-state traffic is one keepalive heartbeat frame every ~25 s plus change frames when another client writes. Connections are capped at four per token; the stream endpoint, its reconnect handshakes, and `GET /api/sync/revision` are exempt from the LAN request-rate bucket (60 req/60 s per IP, shared across clients behind one NAT). Exceeding the stream cap returns a distinct 429 response with a short retry hint. Rotating a token terminates existing streams with 401 and clients surface a reconnect state instead of retry-looping.

Installed PWAs and backgrounded mobile tabs suspend their streams; on resume the client reconnects, receives a fresh revision via the `hello` frame, and sweep-refreshes all data caches rather than trusting missed events.

---

## 9. Related Documentation

- `docs/architecture.md`
- `docs/local-recipe-book-config.md`
- `docs/client-server-install-and-usage.md`
- `docs/ipc-channels.md`
