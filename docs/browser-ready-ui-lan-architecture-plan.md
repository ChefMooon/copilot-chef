# Browser-Ready UI + LAN Architecture Plan

## Status
Proposed

## Objective
Evolve Copilot Chef into a dual-surface application where:
1. The existing Electron desktop app remains the primary local experience.
2. A browser-ready UI can run from the same codebase.
3. The in-process API server can be exposed safely over LAN for trusted devices (for example, iPad Safari).

## Why This Change
The current architecture has two strengths already in place:
1. Most renderer data interactions already use HTTP API calls.
2. The embedded Hono server can serve multiple clients once host binding and network access are configured.

The current blocker is platform coupling:
1. The renderer assumes Electron IPC for config and some settings/update flows.
2. The API server currently binds to loopback only.
3. CORS is constrained to desktop-focused origins.

## Current State Summary
1. Electron UI is loaded by BrowserWindow and is not browser-served by default.
2. API is embedded in Electron main process and binds to 127.0.0.1.
3. Renderer config bootstrap requires window.api IPC.
4. A small set of UI features are desktop-specific (auto-update events, app settings channels).

## Target Architecture
## High-Level Shape
1. Shared React UI codebase for both desktop and browser targets.
2. Platform adapter layer that abstracts desktop-only capabilities.
3. LAN-capable API service mode with explicit auth and CORS policy.
4. Optional static web serving path for easy browser access on same network.

## Runtime Modes
1. Desktop Local Mode:
   Electron + embedded API + loopback or LAN bind (configurable).
2. Desktop Remote Mode:
   Electron renderer connects to remote API URL.
3. Browser LAN Mode:
   Browser-hosted UI connects to LAN API using machine token.

## Plan
## Phase 0: Guardrails and Non-Goals
1. Keep all current Electron UX behavior unless explicitly changed.
2. Do not require cloud deployment for browser mode.
3. Do not expose LAN mode by default; require explicit opt-in.

Exit criteria:
1. Scope approved and non-goals recorded in roadmap.

## Phase 1: Platform Abstraction in Renderer
1. Introduce a renderer platform interface:
   - getServerConfig
   - getSetting
   - setSetting
   - subscribeUpdates
   - checkForUpdates
2. Implement Electron platform adapter using existing window.api channels.
3. Implement Browser platform adapter using HTTP endpoints and/or local storage fallbacks.
4. Refactor settings and config modules to depend on the platform interface, not window.api directly.

Suggested touch points:
1. src/renderer/lib/config.ts
2. src/renderer/pages/settings.tsx
3. src/renderer/lib (new platform adapter files)

Exit criteria:
1. Renderer builds and runs in Electron with no regression.
2. Renderer can compile in browser context with no direct window.api references.

## Phase 2: API LAN Exposure Controls
1. Make API host configurable (127.0.0.1 vs 0.0.0.0).
2. Add explicit setting key for LAN exposure toggle.
3. Update CORS strategy for browser clients on LAN:
   - allow configured origins list, not unrestricted wildcard by default.
4. Keep bearer token auth required for non-health routes.
5. Document Windows firewall setup requirements.

Suggested touch points:
1. src/main/server/start.ts
2. src/main/ipc/index.ts
3. src/main/settings/store.ts

Exit criteria:
1. API reachable from another LAN device when LAN mode is enabled.
2. API not reachable from LAN when LAN mode is disabled.
3. Auth still enforced on protected routes.

## Phase 3: Browser Build Target and Hosting Path
1. Add browser build scripts to package.json.
2. Produce static assets from renderer for browser delivery.
3. Choose one hosting approach:
   - Option A: API server also serves static UI assets.
   - Option B: separate lightweight static server process.
4. Add runtime configuration for browser clients (API base URL + token handling approach).

Decision recommendation:
1. Start with Option A for simplicity and fewer moving parts.

Exit criteria:
1. Browser UI opens from LAN URL on iPad.
2. Browser UI successfully performs authenticated API operations.

## Phase 4: UX and Security Hardening
1. Add LAN mode warnings in Settings UI.
2. Require non-empty machine API key before enabling LAN mode.
3. Add token rotation UX (regenerate token action).
4. Add connection diagnostics screen:
   - server URL
   - mode
   - auth status
   - last health check
5. Add rate limiting and request logging guidance for LAN mode.

Exit criteria:
1. LAN mode can be enabled safely by non-technical users.
2. Security posture is clearly communicated in-product.

## Phase 5: Validation and Rollout
1. Test matrix:
   - Electron local
   - Electron remote
   - Browser LAN (iPad Safari, laptop Chrome)
2. Regression tests for settings, chat, recipes, meal plans, grocery flows.
3. Performance checks on streaming chat and large payload screens.
4. Release behind feature flag, then default-on after validation window.

Exit criteria:
1. No critical regressions in desktop mode.
2. Browser LAN mode stable across target devices.

## Risks and Mitigations
## Risk: Direct IPC assumptions remain in renderer
Mitigation:
1. Add lint rule or CI grep check for direct window.api usage outside adapter layer.

## Risk: LAN exposure weakens security posture
Mitigation:
1. LAN mode opt-in only.
2. Mandatory machine API key for LAN mode.
3. Tight CORS allowlist.

## Risk: Browser and desktop behavior drift over time
Mitigation:
1. Shared platform contract tests.
2. Per-release cross-mode smoke test checklist.

## Risk: Operational complexity for users
Mitigation:
1. Provide setup wizard and diagnostics.
2. Add clear docs for firewall and local IP discovery.

## Deliverables
1. Platform abstraction layer and adapter implementations.
2. LAN-capable server configuration with secure defaults.
3. Browser build and hosting path.
4. Settings UI updates for LAN controls and diagnostics.
5. Updated docs:
   - architecture
   - developer guide
   - runbook for LAN mode

## Acceptance Criteria
1. Single shared UI codebase supports Electron and browser runtime targets.
2. iPad on same network can open browser UI and complete core workflows.
3. Desktop app behavior remains unchanged when LAN/browser features are disabled.
4. Auth and CORS protections are enforced in all non-local scenarios.

## Suggested Implementation Order
1. Platform abstraction first (lowest risk, highest leverage).
2. LAN server controls second.
3. Browser build and hosting third.
4. Security and UX hardening fourth.
5. Full validation and staged rollout last.

## Open Decisions
1. Whether browser token entry should be manual or QR-code assisted.
2. Whether to serve browser assets from embedded server or separate static process long-term.
3. Whether LAN mode should be packaged-only or available in dev mode as well.
