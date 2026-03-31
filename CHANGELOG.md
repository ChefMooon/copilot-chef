# Changelog

All notable changes to this project will be documented in this file.

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
