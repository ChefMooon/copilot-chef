---
title: "Auto-update UX Polish - Implementation Plan"
status: READY_FOR_IMPLEMENTATION
current_phase: 1
created: 2026-09-03
last_updated: 2026-09-03
---

# Specification & Overview

## 1. Scope & Objective

- **Goal:** Give desktop users control over update downloads, allow version-specific deferral, and provide understandable release information before installation.
- **In scope:** Electron updater lifecycle, updater IPC/platform contracts, persisted deferred-version preference, Settings update surface, `ModalShell` release-notes dialog, controlled GitHub changelog link, updater tests, IPC documentation, and style-guide compliance.
- **Out of scope:** Automatic downloading or installation, download cancellation, forced updates, browser-mode updates, bundling the complete changelog offline, and release publishing changes.

## 2. Technical Constraints & Decisions

- Preserve the existing main/preload/shared/renderer boundaries.
- Use the existing generic settings IPC and settings schema for deferral persistence; do not create a second storage mechanism.
- Set both `autoUpdater.autoDownload` and `autoUpdater.autoInstallOnAppQuit` to `false`.
- Installation must occur only through the explicit `updates:install` operation.
- Add an explicit typed `updates:download` operation. Define repeated-call behavior as idempotent while a download is already in progress.
- Keep startup and manual checks distinguishable in the main-process service. Startup checks respect the deferred version; manual checks always surface the available version.
- Persist one validated deferred version string or `null`. A newer version must not be suppressed by an older deferred version. Clear the value after successful installation or an explicit manual override.
- Use updater-provided release metadata when available. Normalize missing, string, array, or malformed release notes into readable plain text with a stable fallback; do not fetch arbitrary URLs or add a GitHub API dependency.
- Use `src/renderer/components/ui/ModalShell.tsx` for update details and release notes.
- Use the existing secure external-link path for the canonical GitHub `CHANGELOG.md` URL.
- Follow `docs/STYLE-GUIDE.md`, existing Settings cards and controls, semantic theme tokens, responsive density, and keyboard/accessibility requirements.
- Preserve the concise developer-side missing-`latest.yml` error behavior and full main-process diagnostics.
- Preserve browser-mode update capability gating and no-op behavior.

---

# Execution Plan & Handoffs

## Phase 1: Updater Contract and Persistence Foundation

- **Status:** NOT_STARTED
- **Objective:** Define the typed capabilities and validated persistence needed for explicit download and version-specific deferral.

### Tasks

- Update `src/shared/ipc.ts`:
  - Add the `updates:download` invoke channel and exact return contract.
  - Define any check-origin payload needed to distinguish startup from manual checks.
  - Update `UpdateInfo`/release-note typing and `UpdateState` metadata as needed for deferred and error states.
  - Keep channel and event maps canonical.
- Add a setting such as `updates_deferred_version: string | null` to `src/shared/config/settings.ts`, including its key schema, default, type map, and normalization.
- Update the preload bridge and `RendererPlatform` contract.
- Update Electron and browser platform adapters. Browser mode must continue to report updates as unsupported and return safe no-op behavior.
- Define release-note normalization and fallback behavior in the shared/provider-owned contract before UI work begins.

### Verification & Acceptance Criteria

- **Automated checks:** Run focused shared IPC and platform tests.
- **Functional assertions:** Download and check-origin operations have typed contracts; the deferred value is validated and version-specific; browser mode remains update-unsupported.

### Compliance Checklist

- **Required files:** `src/shared/ipc.ts`; `src/shared/config/settings.ts`; the preload bridge; `src/renderer/lib/platform/types.ts`; `src/renderer/lib/platform/electron.ts`; `src/renderer/lib/platform/browser.ts`; related focused tests.
- **Boundaries:** Do not bypass `getPlatform()`, create parallel persistence, or alter browser-mode update capability.
- **Legacy code removed:** Replace old contracts that assume availability implies downloading.

---

## Phase 2: Main-process Update Lifecycle

- **Status:** NOT_STARTED
- **Objective:** Make discovery non-downloading by default and implement explicit download, deferral, retry/error, and installation transitions.

### Tasks

- Update `src/main/updates/service.ts`:
  - Set `autoUpdater.autoDownload = false`.
  - Set `autoUpdater.autoInstallOnAppQuit = false`.
  - Add explicit download handling and preserve progress/downloaded state behavior.
  - Keep startup and manual checks distinct. Suppress only startup notification for the persisted deferred version.
  - Preserve update metadata on download errors where available.
  - Guard concurrent checks/downloads and define deterministic repeated-call behavior.
  - Clear stale progress/error state on a new check where appropriate.
  - Keep `updates:install` as the only path to `quitAndInstall()`.
- Update the startup wiring in `src/main/index.ts` only as necessary to pass the startup-check context.
- Keep concise `latest.yml` user-facing errors while logging complete diagnostics in the main process.
- Extend `src/main/updates/service.test.ts` for no auto-download, no auto-install-on-quit, explicit download, deferral, manual override, newer-version behavior, retries, progress, concurrency, and failure paths.

### Verification & Acceptance Criteria

- **Automated checks:** `npm test -- --run src/main/updates/service.test.ts`.
- **Functional assertions:** Startup discovery never starts a download; explicit download does; startup deferral suppresses only the remembered version; manual checks bypass deferral; installation is never automatic; missing `latest.yml` remains concise.

### Compliance Checklist

- **Required files:** `src/main/updates/service.ts`; `src/main/updates/service.test.ts`; `src/main/index.ts` if startup wiring changes; Phase 1 contract files required for compilation.
- **Boundaries:** Do not add cancellation, force installation, or change release publishing behavior.
- **Legacy code removed:** Remove background-download assumptions and any automatic-install path.

---

## Phase 3: Settings Update Surface and Release Notes Dialog

- **Status:** NOT_STARTED
- **Objective:** Provide a clear, accessible, user-controlled update workflow in Settings without duplicate lifecycle prompts.

### Tasks

- Update `src/renderer/components/providers/update-provider.tsx`:
  - Expose check, download, defer, retry, and install actions.
  - Subscribe before state replay, or otherwise prove replay makes the subscription race safe.
  - Persist deferral through platform settings.
  - Deduplicate lifecycle toasts by version/status so replay and remounts do not duplicate notifications.
  - Preserve available metadata on errors and clean up listeners on unmount.
- Update `src/renderer/components/settings/categories/GeneralSettings.tsx`:
  - Replace background-download copy with explicit Download, Defer, Retry, and Install & Restart controls.
  - Show available, deferred, downloading, downloaded, error, and no-update states.
  - Clamp valid progress to a bounded percentage and show an indeterminate state when percent is unavailable.
  - Preserve the existing `updatesSupported` capability gate.
- Update `src/renderer/pages/settings.tsx` to wire platform actions, persisted deferred-version state, manual override behavior, and settings refresh.
- Use `ModalShell` for update details and release notes. Ensure keyboard focus, Escape dismissal, overlay behavior, accessible labeling, and focus restoration remain intact.
- Normalize missing or structured release notes into readable text with a useful fallback.
- Add the canonical GitHub `CHANGELOG.md` link through the existing secure external-link mechanism.
- Do not redesign unrelated Settings sections or introduce another modal primitive.

### Verification & Acceptance Criteria

- **Automated checks:** Run focused provider, Settings, platform, release-note, and modal tests plus the applicable lint command.
- **Functional assertions:** Users can inspect notes before downloading, defer a version, manually override deferral, explicitly download, observe progress, retry failures, and explicitly install. The modal is keyboard accessible and browser mode shows no desktop update actions.

### Compliance Checklist

- **Required files:** `src/renderer/components/providers/update-provider.tsx`; `src/renderer/components/settings/categories/GeneralSettings.tsx`; `src/renderer/pages/settings.tsx`; related focused renderer/platform tests; `ModalShell.tsx` only if integration changes are necessary; related styles only where required.
- **Legacy code removed:** Remove background-download copy, obsolete automatic-download controls, duplicate prompts, and contradictory actions.

---

## Phase 4: Documentation and Integrated Verification

- **Status:** NOT_STARTED
- **Objective:** Align documentation and verify the complete update flow without changing release publication behavior.

### Tasks

- Update `docs/ipc-channels.md` with exact download/check payloads, event payloads, state transitions, deferral semantics, and explicit installation behavior.
- Update directly related updater/release troubleshooting documentation if user-visible behavior changed.
- Run targeted tests, then the complete applicable validation set:
  - `npm test -- --run src/main/updates/service.test.ts`
  - focused shared/platform/renderer tests
  - `npm run docs:check:ipc`
  - `npm run lint`
  - `npm run build`
- Review the final diff against every scope, style, accessibility, persistence, browser-mode, no-auto-download, no-auto-install, and non-goal requirement.

### Verification & Acceptance Criteria

- **Automated checks:** Existing updater, shared/platform, renderer, documentation drift, lint, and build checks pass.
- **Functional assertions:** Documentation matches the implemented IPC contract; no automatic download or install occurs; release notes, deferral, retry, and explicit installation work; unrelated Settings and browser-mode behavior remain unchanged.

### Compliance Checklist

- **Required files:** `docs/ipc-channels.md`; directly related updater documentation only if required; all prior-phase files.
- **Boundaries:** Do not modify release tags/assets, publish a release, or add new tooling.
- **Legacy code removed:** Remove contradictory documentation describing automatic background downloads.

---

# Acceptance and Verification Matrix

- Startup checks do not download updates — verify `autoDownload === false` and that startup discovery does not call `downloadUpdate()`.
- Quitting after a downloaded update does not install it — verify `autoInstallOnAppQuit === false`; only `updates:install` calls `quitAndInstall()`.
- Explicit Download reaches `downloading` and `downloaded` — verify service and provider action tests.
- Deferring version `X` suppresses only startup notification for `X` — verify startup and manual-check tests.
- A newer version is not suppressed by an older deferred version — verify with two distinct versions.
- Retry works after check and download failures without concurrent updater calls — verify failure/retry and in-flight guard tests.
- Missing, string, array, and malformed release notes remain readable — verify normalization tests.
- Update details modal supports focus containment, Escape, dismissal, and focus restoration — verify ModalShell and integration tests.
- Browser mode remains unsupported — verify `src/renderer/lib/platform/browser.test.ts` and Settings capability tests.
- IPC documentation matches implementation — verify `npm run docs:check:ipc`.
- Existing behavior remains intact — verify targeted tests, `npm run lint`, `npm run build`, and final diff review.

# Open Decisions

- **Release-note source:** Use `electron-updater` metadata and local normalization. Do not add a GitHub API fetch unless a separate requirement demands unavailable content.
- **Check-origin representation:** Keep startup/manual origin explicit in the main-process service API and expose only the minimum renderer-facing contract needed for manual checks.

# Handoff

The plan is ready for implementation after the revisions above. Implementation must preserve explicit download and installation, validated version-specific deferral, browser-mode gating, accessible release-note presentation, and the existing concise updater error behavior.
