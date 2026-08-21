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

---

## 9. Related Documentation

- `docs/architecture.md`
- `docs/local-recipe-book-config.md`
- `docs/client-server-install-and-usage.md`
- `docs/ipc-channels.md`
