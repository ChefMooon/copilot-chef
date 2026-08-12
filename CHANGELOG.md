# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - TBD

### Added

- Added desktop lifecycle controls for launch-at-login, launch minimized, close-to-tray behavior, and theme preferences, along with a Connection section for viewing app and server diagnostics.

### Fixed

- Fixed the Update Default Meal Plan Profile modal, scrolling now works
- Fixed the meal add/edit modal rendering so stray `disabled=` text no longer appears above the form fields.

## [1.0.0] - 2026-05-27

### Changed

- Breaking: Copilot Chef has been rebranded as Local Recipe Book and the Copilot chat workflow has been removed in favor of a local-first meal-planning experience.
- Home and dashboard surfaces were refreshed with clearer upcoming meal summaries, cleaner action layouts, and stronger responsive behavior.
- The meal-planning workflow now supports faster calendar management with day and week quick actions, month popover improvements, batch slot actions, and drag-and-drop stability fixes.
- The browser and LAN experience is more reliable, including better host normalization and a dedicated browser connect route.
- The web and Electron bundles now load more efficiently through chunk splitting and lazy loading for heavier renderer paths.

### Added

- Added meal reordering, meal duplication, linked recipe navigation, meal sub-type management, side default templates, and header-level undo/redo controls to the meal planner.
- Added meal photos, made-history tracking, and recipe library improvements including duplication, lineage tracking, sortable saved views, and preserved fractional ingredient units.
- Added ongoing grocery-list support, shop completion controls, and a prep-list planning workflow.
- Added expanded workspace and IPC documentation to support the current Electron, browser, and LAN architecture.

### Fixed

- Fixed duplicate-recipe conflict handling so recipe-save flows behave more predictably.
- Fixed recipe last-made synchronization so linked meals and recipes stay aligned.
- Fixed the meal-plan drawer drag lifecycle and slot-hover behavior to reduce scheduling glitches.
- Fixed local pre-development startup requirements around Prisma engine binaries.

## [0.1.1] - 2026-04-30

### Added

- Browser clients now detect when their access token has been revoked or expired and are automatically redirected to the pairing screen with a clear reason message.
- Added helpful field hints in Settings for the browser URL and access link to make LAN pairing easier to understand.
- Confirmation dialog added before resetting browser access to prevent accidental disconnects.

### Fixed

- The app now retries loading its server connection on startup (up to 5 attempts) and displays a meaningful error message instead of a blank loading screen when the server is unreachable.
- Pages and components now update immediately after the server reconnects, eliminating stale data shown after a reconnect.
- Progressive web app start URL corrected so that pairing links work correctly when Copilot Chef is installed as a PWA.
- Browser clients connected via old link formats are now recognized and handled automatically without requiring manual re-pairing.

### Changed

- The "Rotate token" button in Settings has been renamed to "Reset browser access" for clarity.

## [0.1.0] - 2026-03-30

Initial release of Copilot Chef.

### Added

**Desktop client** (`client-v0.1.0`)

- Tauri 2 desktop app for Windows, macOS (universal), and Linux
- Meal plan page with day, week, and month calendar views
- Drag-and-drop meal rescheduling and trash-drop deletion with undo
- Grocery list page with categorized checklist and completion progress
- Recipe book with search, filtering, and full recipe detail view
- Stats dashboard with meal heatmap, meal-type breakdown, cuisine breakdown, weekly trend, and top meals
- Settings page with dietary preferences, household size, cuisine preferences, AI persona selection, and reply-length control
- Floating AI chat panel with streaming responses, slash commands, inline choice buttons, and session history browser
- In-app auto-update via Tauri updater plugin

**Server** (`server-v0.1.0`)

- Hono API server with routes for meals, grocery lists, recipes, preferences, personas, stats, chat sessions, and meal logs
- GitHub Copilot SDK integration with streaming chat, multi-session support, and context-aware system prompt
- Copilot tools: add/remove/move meals, suggest meals, manage grocery items, save recipes
- Bearer token authentication middleware with optional machine-auth mode
- SQLite persistence via Prisma with WAL mode
- `copilot-chef-server` CLI with `start`, `version`, `config`, `db`, and `update` commands
- Server self-update check against GitHub Releases (`server-v*` tags)

**Core and shared packages**

- `@copilot-chef/core`: Prisma schema, domain services (MealService, GroceryService, RecipeService, PreferenceService, PersonaService, MealLogService, ChatHistoryService), and CopilotChef orchestration
- `@copilot-chef/shared`: shared Zod schemas, config schema (TOML), and API path constants
