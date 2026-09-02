---
title: "Authenticated Browser QA Harness - Implementation Plan"
status: DRAFT
current_phase: 1
created: 2026-09-01
last_updated: 2026-09-01
---

# Specification & Overview

### 1. Scope & Objective

- **Goal:** Create a deterministic, local-only browser QA harness that lets a coding agent review authenticated application changes through a real browser session without requiring manual pairing or access to a user's personal credentials/data.
- **Why Discovered:** Browser smoke validation currently reaches `/connect` and cannot exercise authenticated routes without a pairing code or machine token. Existing unit tests and production builds provide strong coverage, but they do not prove the complete authenticated browser/runtime path.
- **In-Scope:** A disposable E2E runner, isolated test data/settings, explicit test-only authentication, browser storage/session setup, deterministic fixtures, authenticated smoke workflows, console/error assertions, lifecycle cleanup, npm command(s), and focused documentation.
- **Out-of-Scope:** Changing production `/connect` behavior, weakening normal bearer authentication, adding a permanent public dev-login endpoint, using real user settings/database data, LAN exposure, replacing existing Vitest coverage, or redesigning application workflows.

### 2. Confirmed Findings

- Browser mode uses `localStorage` keys `local-recipe-book.browser.api-url` and `local-recipe-book.browser.api-token` through `src/renderer/lib/platform/browser.ts`.
- Browser authentication verifies `/api/health` and an authenticated `/api/preferences` probe in `src/renderer/pages/connect.tsx`.
- Browser pairing codes are four digits, single-use, and expire after five minutes; machine tokens are persistent settings values. These are appropriate for human onboarding but awkward for deterministic agent runs.
- `npm run dev:web` starts the browser renderer on `127.0.0.1:5173`; the app currently redirects unauthenticated browser sessions to `/connect`.
- `npm run test`, `npm run lint`, `npm run build:web`, and `npm run build` are established repository checks.
- The current package has no Playwright dependency or `qa:browser` command.
- Existing browser connection, platform, route, and Meal Plan tests should remain complementary to E2E coverage.

### 3. Technical Constraints & Architecture

- The harness must bind API and browser services to loopback only and reject LAN binding or remote-mode configuration.
- Test authentication must require an explicit opt-in such as `LOCAL_RECIPE_BOOK_E2E=1`; it must not be active by default and must not be available in packaged builds.
- Each run must use a temporary app-data/settings location and isolated SQLite database, seed deterministic fixtures, and clean up on success, failure, and interruption.
- The test token must not be printed, committed, placed in a query string, included in screenshots/reports, or written to normal application logs.
- Prefer direct browser storage injection or a generated disposable Playwright `storageState` over pairing-code automation. Do not read the user's real machine token from settings files.
- The runner should own browser/API/server lifecycle and dynamically allocate safe local ports to prevent stale-process and port-conflict failures.
- Preserve the existing platform boundary and production auth paths. If a test-only auth hook is needed, keep it in a clearly isolated test runtime boundary and make the disabled/default path reject it.

### 4. Open Decisions

- Choose the browser automation dependency and execution model: add Playwright as a dev dependency, or use an already-supported external browser tool only for manual checks. Playwright is the leading option because the runner needs repeatable navigation, storage state, screenshots/traces, console capture, and process lifecycle control.
- Choose the test-server boundary: launch the real Electron development runtime with test configuration, or expose a loopback-only test bootstrap that starts the existing Hono server without Electron. The latter may be easier to isolate but must preserve the same auth, routes, database bootstrap, and runtime configuration used by the app.
- Choose fixture ownership and reset strategy: seed through a test-only script/service boundary or use authenticated API setup. Avoid fixture creation through fragile UI steps.
- **Decision:** The first implementation should establish a reusable authenticated shell and target the full authenticated browser QA matrix, not only the Meal Plan journey. Native Electron-only capabilities remain outside browser coverage and must be validated separately.
- Decide how failure artifacts are retained without leaking secrets: temporary trace/screenshot directory with explicit redaction and cleanup policy.

### 5. Assumptions and Risks

- **Assumption:** A local test runner can start or connect to the same API routes used by the browser renderer without requiring a packaged Electron installation.
- **Assumption:** Existing database seed/service APIs can create stable recipes, scheduled meals, unscheduled meals, and meal-plan data without production-only side effects.
- **Risk:** A test-only auth hook placed too close to production server startup could accidentally be enabled in a packaged build or LAN mode; explicit guards and tests are required.
- **Risk:** Shared developer ports and browser profiles can make agent results nondeterministic; the runner must own ports and browser context.
- **Risk:** E2E coverage can become brittle if it asserts implementation details rather than visible behavior and network contracts.

---

# Execution Plan & Handoffs

## Phase 1: Design and Runtime Boundary

- **Status:** NOT_STARTED
- **Objective:** Resolve the auth, server, fixture, and automation boundaries and document a minimal implementation-ready design without changing application behavior.

### Tasks

- [ ] Inspect server startup, auth middleware, database bootstrap/seed facilities, and existing test setup to identify the smallest real-runtime entry point.
- [ ] Inspect route/page selectors and existing QA helpers to define stable browser assertions for authenticated startup and Meal Plan workflows.
- [ ] Decide Playwright package/configuration, dynamic port allocation, temporary app-data/database settings, browser context/storage state, and failure-artifact policy.
- [ ] Specify the test-only auth guard and prove the default production/LAN paths cannot accept the test credential.
- [ ] Define deterministic fixture data and the first smoke matrix, including scheduled and unscheduled meals, views, deferred workflows, refetch, route errors, and console assertions.

### Verification & Acceptance Criteria

- [ ] **Automated Checks:** Existing `npm run test` and `npm run lint` remain passing before implementation; exact new runner checks are recorded after the runtime boundary is selected.
- [ ] **Functional Assertions:** The design identifies a real server/API path, an isolated data path, a disposable authenticated browser context, stable selectors, and explicit cleanup behavior.
- [ ] **Security Assertions:** Default, packaged, remote, and LAN-enabled configurations cannot activate the test auth path; no real token or database is read.

### Plan Compliance Checklist

- [ ] **Required Files:** Expected package/config, runner, fixture/bootstrap, browser spec, and documentation paths are named after Phase 1 inspection; no source file is modified before the boundary is approved.
- [ ] **Boundaries:** No production connection UX, normal auth semantics, LAN exposure, database schema, or unrelated UI behavior changes.
- [ ] **Legacy Code Removed:** No existing auth or test path is removed; any temporary experimental hook must be either isolated for Phase 2 or deleted before handoff.
- [ ] **Acceptance Checks:** Design decisions and unresolved risks are recorded before implementation begins.

### Phase 1 Handoff & Verification Report

- **Compliance Check:** PENDING
- **Verification Result:** PENDING
- **Execution Proof / Logs:** Pending.
- **Artifacts Created/Modified:** Pending.
- **Decisions & Deviations:** Pending resolution of the open decisions above.
- **Next Phase Context:** Implementation must wait until the server boundary, auth guard, fixture strategy, and first smoke scope are explicit.

---

## Phase 2: Isolated Authenticated Browser Runner

- **Status:** NOT_STARTED
- **Objective:** Implement a single command that starts the required local runtime, creates a disposable authenticated browser context, seeds fixtures, runs browser checks, captures safe failure artifacts, and always cleans up.

### Tasks

- [ ] Add the selected browser automation dependency/configuration and npm command, with headed/debug mode only when explicitly requested.
- [ ] Implement isolated runtime startup with loopback-only binding, dynamic ports, temporary app data/database, explicit E2E opt-in, and process cleanup.
- [ ] Implement test-only authentication in the selected boundary with guards for environment, packaged builds, LAN mode, and remote mode.
- [ ] Add deterministic fixture setup without exposing secrets or relying on the user's data.
- [ ] Add browser context/storage-state setup and authenticated startup assertions.
- [ ] Add safe console, page-error, network-failure, and optional trace/screenshot capture with secret-safe artifact handling.

### Verification & Acceptance Criteria

- [ ] **Automated Checks:** The new runner passes repeatedly from a clean checkout using its documented command; interrupted and failing runs do not leave owned processes or test data behind.
- [ ] **Functional Assertions:** A fresh browser reaches the authenticated home route without `/connect`; the API health/protected probe works with the test credential; invalid credentials remain rejected.
- [ ] **Security Assertions:** The test credential is accepted only under the explicit isolated E2E conditions and is absent from logs, URLs, screenshots, and packaged/browser build artifacts.

### Plan Compliance Checklist

- [ ] **Required Files:** Only the selected runner/configuration, test-only bootstrap/auth boundary, fixture setup, package metadata/lockfile, and focused docs are changed.
- [ ] **Boundaries:** No permanent dev-login route, no production token behavior change, no LAN/remote support, no personal profile/database access, and no unrelated refactor.
- [ ] **Legacy Code Removed:** Remove abandoned experiments, debug bypasses, temporary credentials, and stale runner processes/configuration before handoff.
- [ ] **Acceptance Checks:** Runner repeatability, invalid-auth rejection, cleanup, and artifact secrecy are tested and recorded.

### Phase 2 Handoff & Verification Report

- **Compliance Check:** PENDING
- **Verification Result:** PENDING
- **Execution Proof / Logs:** Pending.
- **Artifacts Created/Modified:** Pending.
- **Decisions & Deviations:** Pending.
- **Next Phase Context:** Browser workflow coverage depends on a passing isolated runner and stable fixture data.

---

## Phase 3: Authenticated Workflow Coverage and Agent Review Command

- **Status:** NOT_STARTED
- **Objective:** Prove meaningful application behavior in a real browser and make the command practical for an agent reviewing arbitrary application changes.

### Tasks

- [ ] Add the initial authenticated browser smoke matrix: startup, navigation, scheduled/unscheduled Meal Plan data, Day/Week/Month views, Meal Bank, deferred workflows, refetch, and recoverable route/query errors where stable setup is available.
- [ ] Assert no temporary performance diagnostics or unexpected page errors/failed requests occur during covered workflows, while allowing documented operational errors for intentional failure tests.
- [ ] Add a concise agent-facing validation command/documentation sequence combining lint, Vitest, builds, and authenticated browser QA.
- [ ] Document when to use headed mode, traces/screenshots, fixture reset, and manual pairing versus the isolated harness.
- [ ] Run repeated clean and dirty-worktree validations and record residual gaps, including Electron-specific workflows that browser QA cannot cover.

### Verification & Acceptance Criteria

- [ ] **Automated Checks:** `npm run lint`, `npm run test`, required build commands, and the authenticated browser runner pass; repeated runner execution is stable.
- [ ] **Functional Assertions:** Covered workflows work through the real browser renderer and authenticated API, route splitting/deferred boundaries remain observable where applicable, and invalid auth remains rejected.
- [ ] **Agent Usability Assertions:** A local agent can run one documented command without manual token copying, pairing, personal-data access, or process cleanup.
- [ ] **Documentation Assertion:** Active developer documentation explains the harness, security boundary, prerequisites, failure artifacts, and known coverage gaps.

### Plan Compliance Checklist

- [ ] **Required Files:** Browser specs, runner docs, developer-guide/test documentation, and any final configuration are updated; production connection/auth files remain unchanged unless Phase 1 proves a narrowly guarded boundary is necessary.
- [ ] **Boundaries:** No replacement for unit tests, no claim that browser QA covers native Electron-only capabilities, no secret-bearing committed artifacts, and no unrelated feature work.
- [ ] **Legacy Code Removed:** No manual-token-only instructions remain for the automated review path; no stale E2E process or debug-auth instructions remain.
- [ ] **Acceptance Checks:** Full validation, repeatability, security checks, documentation review, and residual-gap recording are complete.

### Phase 3 Handoff & Verification Report

- **Compliance Check:** PENDING
- **Verification Result:** PENDING
- **Execution Proof / Logs:** Pending.
- **Artifacts Created/Modified:** Pending.
- **Decisions & Deviations:** Pending.
- **Next Phase Context:** None if the harness is stable; otherwise record the blocking gap and preserve the smallest reproducible failure.

---

# Overall Plan Completion Status

- **Final State:** IN_PROGRESS
- **Total Phases Completed:** 0 / 3
- **Summary of Outcome:** Deferred plan captured for a loopback-only, isolated authenticated browser QA harness. Implementation has not started. The first resume task is to resolve the server/auth boundary and fixture strategy, then implement the smallest repeatable runner before broadening workflow coverage.
