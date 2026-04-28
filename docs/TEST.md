# Test Coverage Status

## Purpose

This document summarizes the current state of automated test coverage in Copilot Chef.
It is a practical coverage map, not a line-by-line percentage report.

## Current Snapshot (2026-04-28)

- Test runner: Vitest
- Last full run: passing
- Result: 13 test files, 96 tests passed
- Runtime: about 6.3 seconds

Command used:

- npm run test

## Coverage Metrics Availability

Percentage coverage reporting is not currently configured.

When coverage was requested with npm run test -- --coverage, Vitest reported a missing dependency:

- @vitest/coverage-v8

Because of that, this document reports qualitative coverage by feature area.

## What Is Covered Today

### Shared Schemas and Config

- Recipe schema validation, including backward-compatible import handling
  - src/shared/schemas/recipe-schemas.test.ts
- Chat request schema validation for page context payloads
  - src/shared/schemas/chat.test.ts
- Server and client config loading from TOML and environment variables
  - src/shared/config/__tests__/loader.test.ts

### Main Process Server Logic

- Recipe ingest HTML parsing helpers (ingredient lines and cook notes)
  - src/main/server/services/recipe-service.ingest-parser.test.ts
- Copilot session lifecycle behavior (create, resume, fallback)
  - src/main/server/copilot/copilot-chef.session.test.ts
- Copilot tool handlers, including meal CRUD/tool flows and history recording
  - src/main/server/copilot/copilot-chef.tools.test.ts

### Renderer Logic and UI Behavior

- Instruction annotation logic for matching ingredient amounts in steps
  - src/renderer/lib/recipe-instruction-annotations.test.ts
- Calendar profile date behavior and profile resolution logic
  - src/renderer/lib/calendar.test.ts
- Page context routing and serialization behavior
  - src/renderer/context/page-context-routing.test.ts
- Chat provider payload behavior with active route context
  - src/renderer/context/chat-context.test.tsx
- Page-level context producers across major routes
  - src/renderer/pages/page-context-producers.test.tsx
- Meal plan profile-aware rendering behaviors in day/week/month views
  - src/renderer/components/meal-plan/ProfileViews.test.tsx
- Settings meal type profile management UI flows
  - src/renderer/components/settings/MealTypesSection.test.tsx

## Coverage Gaps and Risk Areas

The following areas currently have little or no automated coverage.

### Electron and App Shell

- Main process startup lifecycle in src/main/index.ts
- Tray lifecycle and close-to-tray behavior
- Preload bridge contract in src/preload/index.ts
- IPC handler wiring in src/main/ipc/index.ts

### Server Integration and API Surface

- End-to-end route tests for src/main/server/routes/*
- Auth middleware behavior under real request flows
- Integration tests around Prisma persistence and data serialization
- Failure-mode tests for server startup/port fallback in src/main/server/start.ts

### Renderer Breadth

- Many pages and components outside the currently targeted contexts and profile workflows
- Data fetching and mutation flows that depend on full API integration
- Error state and retry UX coverage across the app

### Packaging and Distribution

- Build artifact validation for packaged Electron outputs
- Auto-update behavior and updater event handling

## Current Testing Strategy (Observed)

The current suite is strongest at:

- Business logic and schema validation
- Focused UI interaction tests for high-value workflows
- Isolated testing with mocks to keep tests deterministic and fast

The current suite is weakest at:

- Cross-layer integration (renderer -> IPC -> server -> database)
- Electron runtime behavior in realistic app lifecycle scenarios
- Quantitative coverage tracking over time

## Recommended Next Steps

1. Enable numeric coverage reporting by adding a Vitest coverage provider and a coverage script.
2. Add integration tests for core API routes and middleware behavior.
3. Add focused tests for IPC channels and preload contract stability.
4. Add smoke tests for Electron startup, tray behavior, and updater flows.
