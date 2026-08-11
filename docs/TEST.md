# Test Coverage Status

## Purpose

This document summarizes the current state of automated test coverage in Local Recipe Book.
It is a practical coverage map, not a line-by-line percentage report.

## Current Snapshot

- Test runner: Vitest
- Last full run: passing
- Result: 45 test files, 217 tests passed

Command used:

- npm run test

## Coverage Metrics Availability

Percentage coverage reporting is not currently configured.

When coverage was requested with npm run test -- --coverage, Vitest reported a missing dependency:

- @vitest/coverage-v8

Because of that, this document reports qualitative coverage by feature area.

## What Is Covered Today

### Shared Schemas and Config

- Recipe and menu-export schema validation, including backward-compatible import handling
  - `src/shared/schemas/recipe-schemas.test.ts`
  - `src/shared/schemas/menu-export-schemas.test.ts`
- Menu export formatting and escaping
  - `src/shared/menu-export.test.ts`
- Server and client config loading from TOML and environment variables
  - `src/shared/config/__tests__/loader.test.ts`

### Main Process Server Logic

- Recipe ingest HTML parsing helpers, ingredient normalization, and unit conversion
  - `src/main/server/services/recipe-service.ingest-parser.test.ts`
  - `src/main/server/lib/ingredient-normalizer.test.ts`
  - `src/main/server/lib/unit-converter.test.ts`
- Meal ordering, meal-bank operations, last-made synchronization, and analytics
  - `src/main/server/services/meal-service.reorder.test.ts`
  - `src/main/server/services/meal-service.last-made.test.ts`
  - `src/main/server/services/meal-service.analytics.test.ts`
- Grocery service behavior and route validation
  - `src/main/server/services/grocery-service.test.ts`
  - `src/main/server/routes/grocery-lists.test.ts`
- Route behavior for meals, prep lists, menu export, and stats
  - `src/main/server/routes/meals.reorder.test.ts`
  - `src/main/server/routes/meals.slot-batch.test.ts`
  - `src/main/server/routes/prep-lists.test.ts`
  - `src/main/server/routes/menu-export.test.ts`
  - `src/main/server/routes/stats.test.ts`
- LAN runtime settings resolution
  - `src/main/server/lib/lan.test.ts`

### Renderer Logic and UI Behavior

- Application shell, connection, browser platform, and core utility behavior
  - `src/renderer/components/layout/app-shell.test.tsx`
  - `src/renderer/lib/platform/browser.test.ts`
  - `src/renderer/lib/calendar.test.ts`
  - `src/renderer/lib/grocery.test.ts`
  - `src/renderer/lib/recipe-instruction-annotations.test.ts`
- Meal-plan conflict, drag/drop, duplicate, edit, meal-bank, profile, menu-export, and undo/redo flows
  - `src/renderer/components/meal-plan/`
  - `src/renderer/pages/meal-plan.conflict-flow.test.tsx`
- Recipe detail, cards, and add-recipe workflows
  - `src/renderer/pages/recipes/detail.test.tsx`
  - `src/renderer/components/recipes/`
- Settings, LAN onboarding, and meal-type management
  - `src/renderer/components/settings/`
- Accessibility and browser QA behavior for selected controls and routes
  - `src/renderer/components/ui/accessible-heatmap-cell.test.tsx`
  - `src/renderer/pages/connect.qa.test.tsx`
  - `src/renderer/pages/throttling-ui.qa.test.tsx`

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
