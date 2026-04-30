# Browser-Ready UI + LAN Architecture Plan

## Status

Proposed, decisions resolved, ready for implementation planning.

## Objective

Evolve Copilot Chef into a dual-surface application where:

1. The existing Electron desktop app remains the primary local experience.
2. A browser-ready UI runs from the same React renderer codebase.
3. The embedded API can be exposed safely over LAN for trusted devices, such as iPad Safari.
4. Browser access is served by a separate static web process rather than the API process.

## Decisions

1. Browser connection will support both manual token entry and QR-code onboarding.
2. Browser assets will be served by a separate static process.
3. LAN mode will always be available in both development and packaged builds, but it will remain disabled until the user explicitly enables it.

## Audience

This plan is written for an implementation agent. It should be followed sequentially. Each phase includes suggested subagents, implementation touch points, validation, and exit criteria.

## Current State

1. Electron loads the renderer with `BrowserWindow`; the UI is not served to browsers.
2. The API server is started by Electron main process and currently binds to loopback.
3. The renderer bootstraps server config through `window.api.invoke("server:getConfig")`.
4. Direct Electron IPC usage exists in config, settings, home dashboard preferences, update checks, and PDF export.
5. The API config already accepts multiple auth tokens, including a saved `machine_api_key`, but LAN lifecycle, rotation, and browser onboarding are not fully designed.
6. CORS is currently desktop-focused and does not model a separate browser static origin.

## Target Architecture

### Runtime Processes

1. Electron main process owns lifecycle, settings, tray behavior, auto-update behavior, and process supervision.
2. API process remains the existing in-process Hono server started from Electron main.
3. Static web process serves the built renderer assets for LAN browsers.
4. Electron renderer and browser renderer share React components, route definitions, API client code, shared schemas, and query logic.

### Runtime Modes

1. Desktop Local Mode:
   - Electron renderer connects to the embedded API through IPC-provided config.
   - Default binding remains loopback unless LAN exposure is enabled.
2. Desktop Remote Mode:
   - Electron renderer connects to a configured remote API URL and token.
   - Embedded API and static web process are not required.
3. Browser LAN Mode:
   - Browser opens the static web process URL on the LAN.
   - Browser connects to the API server with a machine token entered manually or imported through a QR code.

### Security Model

1. LAN mode is always available as a feature, but network exposure is opt-in.
2. The API binds to `127.0.0.1` by default and only binds to `0.0.0.0` when LAN exposure is enabled.
3. Non-health API routes require bearer token auth in every mode.
4. Browser clients use a persisted machine token. The session-only random desktop token must not be exposed to LAN clients.
5. QR-code onboarding must place credentials in the URL fragment, not the query string, so the token is not sent to the static process in the HTTP request line.
6. CORS must allow only the configured Electron dev origins, packaged desktop origin, and configured static web origins.
7. Token rotation must invalidate old browser access and force browser reconnection.

## New Settings

Add these settings through `src/main/settings/store.ts` and any shared settings types or schemas introduced by the implementation:

| Key                          |                Default | Purpose                                                                                                   |
| ---------------------------- | ---------------------: | --------------------------------------------------------------------------------------------------------- |
| `lan_enabled`                |                `false` | Enables API LAN binding and static web process startup.                                                   |
| `lan_api_host`               |            `127.0.0.1` | Effective API bind host. Set to `0.0.0.0` only when LAN is enabled.                                       |
| `lan_api_port`               | existing `server_port` | API port exposed on LAN. Keep compatible with current `server_port` unless a separate value is necessary. |
| `lan_web_enabled`            |                `false` | Enables the static web process. This should normally mirror `lan_enabled` in UI.                          |
| `lan_web_host`               |            `127.0.0.1` | Static process bind host. Set to `0.0.0.0` only when LAN is enabled.                                      |
| `lan_web_port`               |                 `4173` | Static browser UI port.                                                                                   |
| `lan_allowed_origins`        |                   `[]` | Extra user-approved CORS origins. Generated static web origins should be added automatically.             |
| `machine_api_key`            |    generated on demand | Browser/LAN bearer token. Store only after the user enables LAN or creates a token.                       |
| `machine_api_key_updated_at` |                  unset | Timestamp used for diagnostics and token rotation messaging.                                              |

## Browser Onboarding Flow

1. User opens Settings in the desktop app and enables LAN access.
2. App requires a non-empty machine API key. If none exists, the app offers to generate one.
3. App starts or restarts both the API server and the static web process with LAN-safe settings.
4. App displays:
   - Browser URL, such as `http://192.168.1.25:4173`.
   - API URL, such as `http://192.168.1.25:3001`.
   - Manual token field with copy action.
   - QR code for a connection URL using a fragment, for example `http://192.168.1.25:4173/#/connect?api=http%3A%2F%2F192.168.1.25%3A3001&token=<machine-token>`.
5. Browser connection page reads the fragment, stores the API URL and token in `localStorage`, clears the token from visible URL state, and verifies `/api/health` plus one authenticated probe. The fragment payload must not be written into the query string at any point, since `#` and everything after it is not sent to the server.
6. Manual entry uses the same connection page with separate API URL and token fields.
7. Token rotation removes the old token from API auth config, generates a new token, restarts affected services if necessary, and shows a new manual token and QR code.

## Implementation Plan

Follow phases in order. Do not skip validation for a later phase if an earlier phase changed public behavior.

### Phase 0: Baseline Audit and Guardrails

Suggested subagents:

1. Use `Explore` for read-only impact analysis of direct `window.api` usage, build outputs, server startup, CORS, and settings access.
2. Use `specialist-qa` to turn the plan into a test checklist before implementation starts.

Implementation steps:

1. Confirm all direct Electron IPC usage under `src/renderer/` and classify each call as config, settings, updates, desktop-only export, or other.
2. Confirm whether generated output under `src/renderer/out/` is source-controlled or should be excluded from searches and lint checks.
3. Record a short implementation checklist in the agent's working notes before modifying code.
4. Add or update an ESLint `no-restricted-imports` rule after Phase 1 so direct `window.api` usage is allowed only in the Electron platform adapter file and tests that intentionally mock it. Prefer this over a grep-based CI guard: ESLint is aware of import aliases and re-exports, and gives immediate editor feedback.

Validation:

1. `npm run lint`
2. `npm run test`

Exit criteria:

1. Known IPC call sites are inventoried.
2. Test checklist exists for platform, LAN, browser, and regression paths.

### Phase 1: Renderer Platform Abstraction

Suggested subagents:

1. Use `Basic Feature` or `general-implement-subagent` for implementation.
2. Use `Frontend Iteration Agent` if Settings or connection UI changes become visually complex.

Implementation steps:

1. Add a renderer platform interface under `src/renderer/lib/platform/` with capabilities for:
   - `getServerConfig`
   - `getSetting`
   - `setSetting`
   - `getAllSettings`
   - `subscribeUpdates`
   - `checkForUpdates`
   - `exportMenuPdf` or an explicit desktop capability flag for PDF export
2. Implement an Electron adapter that wraps existing `window.api` channels.
3. Implement a Browser adapter that:
   - Reads API URL and token from browser storage or the connection fragment.
   - Stores browser-local connection config.
   - Returns unsupported desktop capabilities as disabled states, not runtime crashes.
4. Refactor `src/renderer/lib/config.ts`, settings page calls, home dashboard preference reads, update checks, and menu PDF export to use the platform interface.
5. Keep shared schemas in `src/shared/` when request or page-context payloads cross the renderer/server boundary.
6. Add tests for adapter selection and browser-safe rendering without `window.api`.

Validation:

1. `npm run lint`
2. `npm run test`
3. Build or typecheck the renderer in a browser context without direct `window.api` references outside the Electron adapter.

Exit criteria:

1. Electron desktop behavior is unchanged.
2. Browser renderer can compile without assuming Electron IPC.
3. Desktop-only features render as unavailable or hidden in browser mode.

### Phase 2: LAN API Controls and Token Lifecycle

Suggested subagents:

1. Use `general-implement-subagent` for settings, server startup, and auth changes.
2. Use `specialist-qa` for security edge cases around CORS and auth.

Implementation steps:

1. Update `src/main/server/start.ts` so the configured bind host and the advertised URL can differ correctly:
   - Bind host should be `127.0.0.1` by default.
   - Bind host should be `0.0.0.0` when LAN is enabled.
   - Advertised browser/API URL should use the selected LAN IPv4 address, not `0.0.0.0` and not hardcoded `127.0.0.1` when LAN is enabled.
2. Add a utility that detects candidate LAN IPv4 addresses and exposes them to Settings diagnostics. Allow manual override if automatic detection is wrong.
3. Ensure `getServerInfo()` returns both bind info and advertised URLs needed by desktop and browser UI.
4. Keep the random per-session desktop token for Electron local use.
5. Add machine token lifecycle functions:
   - Generate token.
   - Save token.
   - Rotate token.
   - Clear token.
   - Return token metadata for UI without exposing the token except during generation/explicit reveal.
6. Update auth config so LAN/browser access accepts only the active machine token plus any intentionally supported desktop token.
7. Update CORS config to include:
   - Electron dev origin.
   - Packaged desktop origin.
   - Static web local and LAN origins for the active web port.
   - User-configured allowed origins.
8. Keep `/api/health` unauthenticated and add an authenticated probe endpoint only if an existing lightweight authenticated endpoint is not appropriate.
9. On Windows, binding to `0.0.0.0` is silently blocked by Windows Firewall by default. When LAN is enabled, attempt to detect whether the API port is reachable from another interface. If not, surface a clear user-facing error that links to instructions for adding a firewall allow rule (or automates `netsh advfirewall firewall add rule` with appropriate scope). Do not defer this to Phase 5 documentation only — unreachable LAN will present as a silent failure otherwise.
10. Confirm that the SSE chat streaming path works correctly over LAN. The existing stream uses `fetch` with `ReadableStream`, which is correct, but validate keepalive interval and reconnect behavior under LAN latency. Document expected behavior if the connection drops mid-stream.

Validation:

1. `npm run lint`
2. `npm run test`
3. Manual check: LAN disabled binds only to loopback.
4. Manual check: LAN enabled allows another LAN device to reach health and rejects protected routes without bearer token.
5. Manual check: CORS rejects an unapproved origin.
6. Manual check on Windows: enabling LAN with firewall active produces a visible diagnostic, not a silent failure.

Exit criteria:

1. LAN availability works in development and packaged builds.
2. LAN exposure remains disabled by default.
3. API URL reporting is correct for both desktop and LAN clients.
4. Auth remains enforced for every non-health route.

### Phase 3: Separate Static Web Process

Suggested subagents:

1. Use `general-implement-subagent` for process lifecycle and scripts.
2. Use `specialist-qa` for port conflict and shutdown behavior.

Implementation steps:

1. Add browser build scripts to `package.json`, such as:
   - `build:web` to produce browser renderer assets.
   - `dev:web` if useful for isolated browser development.
   - `serve:web` or an internal static process entry for packaged/static serving.
2. Add a static web server module owned by Electron main process, separate from `src/main/server/start.ts`.
3. Serve built renderer assets from a dedicated output directory. Do not serve API routes from this process.
4. Add SPA fallback to `index.html` for browser routes.
5. Add runtime config delivery that does not expose tokens in static files:
   - Serve non-sensitive config such as API URL candidates and app version.
   - Keep tokens in manual entry or QR fragment only.
6. Supervise process lifecycle from Electron:
   - Start when LAN web access is enabled.
   - Stop on app quit.
   - Restart when LAN web port, host, or advertised address changes.
   - Handle port fallback or clear error reporting.
7. Package browser assets and static process dependencies through electron-builder configuration.
8. Add a PWA manifest (`manifest.webmanifest`) and a minimal service worker to the browser build. This enables home screen install on iPad Safari, which is an explicit target in Phase 6, and provides an offline fallback page when the API is unreachable rather than a blank screen.

Validation:

1. `npm run build:web`
2. `npm run build`
3. Manual check: static URL serves the app on desktop browser.
4. Manual check: static URL serves the app from a second LAN device when enabled.
5. Manual check: static process is stopped when LAN web access is disabled or the app quits.

Exit criteria:

1. Browser UI is served by a separate process.
2. Static process and API process have independent ports, lifecycle, and error reporting.
3. Browser assets are included in packaged builds.

### Phase 4: Browser Connection UX

Suggested subagents:

1. Use `Frontend Iteration Agent` for connection page and Settings UI.
2. Use `Accessibility Expert` for QR/manual entry accessibility review.

Implementation steps:

1. Add a browser connection page or route that supports:
   - Empty state with API URL and token fields.
   - QR fragment import.
   - Token verification.
   - Reconnect and clear connection actions.
   - Clear user-facing errors for invalid URL, invalid token, unreachable server, and CORS rejection.
2. Update Settings in Electron to include LAN controls:
   - Enable LAN access.
   - Show API URL and static web URL.
   - Generate/reveal/copy/rotate machine token.
   - Show QR code for browser onboarding.
   - Show current bind host, selected LAN IP, ports, and last health check.
3. Ensure browser mode hides or disables desktop-only update actions and PDF export if they cannot run outside Electron.
4. Clear QR/import token fragments from browser history after storing the token. Use `history.replaceState` to replace the current entry with a clean path immediately after reading the fragment. The app uses history routing (`createBrowserRouter`), not hash routing. Do not switch to hash routing: it would conflict with the fragment-based token delivery mechanism.
5. Use `localStorage` for persisting the API URL and machine token. `sessionStorage` would force re-authentication on every new tab, which is poor UX for a meal planning app. Provide a visible disconnect action that removes both values and redirects to the connection page.

Validation:

1. `npm run lint`
2. `npm run test`
3. Manual check: QR onboarding works from iPad Safari or another LAN browser.
4. Manual check: manual token entry works from desktop browser.
5. Manual check: token rotation invalidates an already-connected browser until it reconnects.

Exit criteria:

1. Browser users can connect by manual token or QR code.
2. Connection failures are recoverable without developer tools.
3. Desktop-only features do not crash in browser mode.

### Phase 5: Security, Diagnostics, and Operational Hardening

Suggested subagents:

1. Use `specialist-qa` for adversarial security and failure-mode testing.
2. Use `Documentation Specialist` for runbook updates.

Implementation steps:

1. Add rate limiting or request throttling for authenticated API routes when LAN is enabled.
2. Add request logging that avoids printing bearer tokens, QR URLs, or authorization headers.
3. Add diagnostics for:
   - API server running state.
   - Static server running state.
   - Bind host and advertised URLs.
   - Last health check.
   - Auth probe status.
   - CORS origin used by the browser.
4. Document Windows firewall requirements and local IP discovery. The Phase 2 implementation handles automatic detection and user-facing diagnostics; this step covers runbook documentation and known edge cases such as guest networks, multiple NICs, and VPN-active scenarios.
5. Ensure all sensitive UI copy states that reveal tokens require explicit user action.
6. Add error handling for port conflicts, network changes, sleep/resume, and token rotation while browser clients are connected.

Validation:

1. `npm run lint`
2. `npm run test`
3. Manual check: logs do not include secrets.
4. Manual check: firewall-blocked or port-conflict states produce useful user-facing diagnostics.

Exit criteria:

1. LAN mode is understandable and recoverable for non-technical users.
2. Diagnostics distinguish API, static serving, auth, and CORS failures.
3. No secrets are written to logs or static build artifacts.

### Phase 6: Cross-Mode Validation and Rollout

Suggested subagents:

1. Use `specialist-qa` for the final test matrix.
2. Use `haiku-code-review-subagent` or another review subagent for code review before merge.
3. Use `Documentation Specialist` for final docs consistency.

Implementation steps:

1. Run the full test matrix:
   - Electron local, LAN disabled.
   - Electron local, LAN enabled.
   - Electron remote mode.
   - Browser LAN on desktop Chrome or Edge.
   - Browser LAN on iPad Safari.
2. Smoke test core workflows in each supported mode:
   - Settings and connection diagnostics.
   - Recipes.
   - Meal plans.
   - Grocery lists.
   - Chat streaming.
   - Chat session history.
   - Menu export behavior by platform.
3. Verify package output includes Prisma resources, browser assets, and static process entry points.
4. Update docs:
   - `docs/architecture.md`
   - `docs/developer-guide.md`
   - `docs/pa-machine-runbook.md` or a dedicated LAN runbook
   - `README.md` only if user-facing setup changes need top-level discovery

Validation:

1. `npm run lint`
2. `npm run test`
3. `npm run build`
4. `npm run build:win` when packaging behavior changes are complete and Windows build tools are available.

Exit criteria:

1. Desktop default behavior has no critical regression.
2. Browser LAN mode completes core workflows from a second device.
3. Implementation docs match the shipped behavior.

## Acceptance Criteria

1. A single shared React codebase supports Electron and browser runtime targets.
2. LAN mode is available in development and packaged builds.
3. LAN network exposure is disabled by default and requires explicit user action.
4. Browser clients can connect through manual token entry or QR-code onboarding.
5. Browser assets are served by a separate static process.
6. API and static process lifecycles are independently observable and recoverable.
7. iPad Safari on the same network can open the browser UI and complete core workflows.
8. Auth and CORS protections are enforced outside local desktop-only scenarios.
9. Token rotation invalidates existing browser clients until they reconnect with the new token.
10. Desktop app behavior remains unchanged when LAN/browser features are disabled.

## Adversarial Review Findings and Fixes Applied

### Finding: Direct IPC Usage Is Broader Than Initial Plan

The original plan mentioned config and settings, but renderer IPC usage also includes home dashboard preferences, update events, and PDF export.

Fix applied:

1. Phase 0 requires an IPC inventory.
2. Phase 1 platform abstraction includes update subscriptions and desktop-only export capabilities.
3. Browser mode must disable unsupported desktop features without crashes.

### Finding: Separate Static Process Changes CORS and Runtime Config

The original plan treated browser hosting as a choice and recommended API-hosted assets. The decision is now a separate static process, which means API CORS must trust the static origin and runtime config must not leak tokens.

Fix applied:

1. Phase 3 adds a dedicated static process with independent lifecycle.
2. Phase 2 includes static web origins in CORS.
3. Browser runtime config is explicitly non-sensitive.

### Finding: LAN Binding and Advertised URLs Can Diverge

Binding to `0.0.0.0` is correct for listening but wrong for URLs shown to users. The current code also hardcodes loopback URLs.

Fix applied:

1. Phase 2 requires separate bind host and advertised URL handling.
2. Phase 2 requires LAN IPv4 detection plus manual override.
3. Diagnostics must show bind host and advertised URLs separately.

### Finding: QR Codes Can Leak Tokens If Implemented Naively

Putting a token in a query string sends it to the static process and may place it in logs or browser history.

Fix applied:

1. QR onboarding uses a URL fragment.
2. Browser connection flow clears token fragments after import.
3. Logging requirements prohibit token, QR URL, and authorization header logging.

### Finding: Token Lifecycle Was Underspecified

The original plan required a machine API key but did not define generation, reveal, rotation, invalidation, or connected browser behavior.

Fix applied:

1. Phase 2 defines token lifecycle functions.
2. Phase 4 defines manual and QR token UX.
3. Acceptance criteria require rotation to invalidate existing browser clients.

### Finding: Always Available Could Be Misread As Always Enabled

The decision says LAN mode should always be available, but secure defaults still require opt-in exposure.

Fix applied:

1. Decisions clarify availability in development and packaged builds.
2. Security model keeps LAN exposure disabled by default.
3. Acceptance criteria separate feature availability from network exposure.

### Finding: Browser Build Could Drift From Desktop Behavior

The original plan did not force platform contract tests or cross-mode smoke tests for chat and shared schemas.

Fix applied:

1. Phase 1 requires adapter tests and shared schema discipline.
2. Phase 6 includes cross-mode smoke testing for chat streaming and chat session history.
3. Phase 6 includes implementation docs updates after behavior is validated.

## Remaining Risks

1. LAN IP detection can be wrong on VPNs, multiple NICs, or guest networks. Mitigation: show candidates and allow manual advertised host override.
2. HTTP over LAN is convenient but not encrypted. Mitigation: scope to trusted LAN, communicate clearly in Settings, and keep remote/cloud TLS out of this phase unless separately planned. TLS should be planned if the app ever handles sensitive dietary, medical, or account data, or if a remote cloud mode is added.
3. iPad Safari storage behavior can differ from desktop browsers. Mitigation: include iPad Safari in the required validation matrix.
4. Static process packaging may miss assets or dependencies. Mitigation: verify packaged output in Phase 6, not only dev mode.
5. Existing generated renderer output may contain stale direct IPC references. Mitigation: classify generated output in Phase 0 and exclude or regenerate it consistently.
6. mDNS / Bonjour discovery is not implemented in this plan. Users must know the LAN IP to connect a browser. For a future improvement, consider advertising the static web process URL via mDNS using `bonjour-service` or equivalent so browsers can reach `copilot-chef.local` without knowing the IP. This substantially reduces onboarding friction, especially on iPad.
