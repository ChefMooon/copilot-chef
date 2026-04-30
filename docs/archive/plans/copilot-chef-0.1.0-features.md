# Copilot Chef v0.1.0 — Feature Inventory

> **Purpose:** This document catalogs every server and client feature present in the v0.1.0 codebase. It is the baseline for verifying feature parity after the rewrite to a single Electron application.

---

## Table of Contents

1. [API Endpoints](#1-api-endpoints)
2. [UI Pages](#2-ui-pages)
3. [UI Components](#3-ui-components)
4. [Core Services](#4-core-services)
5. [CLI Commands](#5-cli-commands)
6. [Auth Middleware](#6-auth-middleware)
7. [Chat & AI Features](#7-chat--ai-features)
8. [Configuration](#8-configuration)
9. [Database Schema](#9-database-schema)
10. [Background Behaviors & Utilities](#10-background-behaviors--utilities)

---

## 1. API Endpoints

### Health & Status

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | None | Returns `{ status: "ok", version, uptime, databaseType }` |

### Meals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/meals` | Required | List meals in date range. Query: `from` (ISO), `to` (ISO). Returns `{ data: Meal[] }` |
| `POST` | `/api/meals` | Required | Create meal. Body: `{ name, mealType, date?, notes?, ingredients?, ingredientsJson? }`. Returns `{ data: Meal }` (201) |
| `PATCH` | `/api/meals/:id` | Required | Update meal (partial). Returns `{ data: Meal }` |
| `DELETE` | `/api/meals/:id` | Required | Delete meal by ID. Returns `{ data: { id } }` |

### Grocery Lists

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/grocery-lists` | Required | List all grocery lists. Query: `current=1` returns only current list |
| `POST` | `/api/grocery-lists` | Required | Create list. Body: `{ name, date?, favourite?, items? }` |
| `GET` | `/api/grocery-lists/:id` | Required | Get single list with all items |
| `PATCH` | `/api/grocery-lists/:id` | Required | Update list metadata (`name?`, `date?`, `favourite?`) |
| `DELETE` | `/api/grocery-lists/:id` | Required | Delete list and cascade-delete all items |
| `POST` | `/api/grocery-lists/:id/items` | Required | Add item. Body: `{ name, qty?, unit?, category?, notes?, meal?, checked? }` |
| `PATCH` | `/api/grocery-lists/:id/items/:itemId` | Required | Update item (partial) |
| `DELETE` | `/api/grocery-lists/:id/items/:itemId` | Required | Remove item from list |
| `POST` | `/api/grocery-lists/:id/reorder` | Required | Reorder items. Body: `{ itemIds: string[] }` |

### Recipes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/recipes` | Required | List/search recipes. Query: `query`, `origin`, `tags`, `difficulty`, `maxCookTime`, `rating` |
| `POST` | `/api/recipes` | Required | Create recipe (Zod validated via `CreateRecipeInputSchema`) |
| `GET` | `/api/recipes/export` | Required | Export recipes as JSON. Query: `ids` (comma-separated, optional) |
| `POST` | `/api/recipes/import` | Required | Bulk import. Body: `RecipeExportJsonSchema`. Returns `{ imported: [], skipped: [] }` |
| `POST` | `/api/recipes/ingest` | Required | Scrape recipe from URL. Body: `{ url: string }`. Returns `IngestResult` |
| `POST` | `/api/recipes/ingest/confirm` | Required | Confirm and save scraped recipe. Body: `CreateRecipeInputSchema` |
| `POST` | `/api/recipes/grocery` | Required | Add recipe ingredients to existing grocery list. Body: `{ recipeIds: string[], groceryListId: string }` |
| `POST` | `/api/recipes/grocery/new` | Required | Create new grocery list from recipe ingredients. Body: `{ recipeIds: string[], name: string }` |

### Preferences

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/preferences` | Required | Get user preferences (singleton; always `id: "default"`) |
| `PATCH` | `/api/preferences` | Required | Update preferences (partial; any `PreferenceUpdateInput` field) |
| `POST` | `/api/preferences/reset` | Required | Reset all preferences to defaults |
| `GET` | `/api/preferences/detect-region` | Required | Auto-detect seasonal region from IP |

### Chat (Streaming)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/chat` | Required | Main chat endpoint. Body: `{ message, sessionId?, pageContext?, pageContextData?, chatSessionId? }`. Response: `text/plain` UTF-8 delta stream **or** `application/json` for errors/special responses. Response headers: `x-session-id`, `x-chat-session-id`, `x-request-id`. Stream may contain `\x00COPILOT_CHEF_EVENT\x00` sentinel lines for control messages |

### Chat Sessions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/chat-sessions` | Required | List sessions for authenticated `ownerId` |
| `POST` | `/api/chat-sessions` | Required | Create new session. Body: `{ title? }` |
| `GET` | `/api/chat-sessions/:id` | Required | Get session details (ownership check enforced) |
| `DELETE` | `/api/chat-sessions/:id` | Required | Delete session (ownership check enforced) |

### Personas

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/personas` | Required | List all custom personas |
| `POST` | `/api/personas` | Required | Create persona. Body: `{ emoji, title, description, prompt }` |
| `PATCH` | `/api/personas/:id` | Required | Update persona (partial) |
| `DELETE` | `/api/personas/:id` | Required | Delete custom persona |

### Meal Logs & Stats

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/meal-logs` | Required | Get heatmap (`weeks=13`) or recent meals (`recent=N`) |
| `POST` | `/api/meal-logs` | Required | Record a meal eaten. Body: `{ date, mealType, mealName, cooked? }` |
| `GET` | `/api/stats` | Required | Full stats dashboard — runs 8 parallel queries. Returns: `heatmap`, `mealTypeBreakdown`, `cuisineBreakdown`, `weeklyTrend`, `dayOfWeekBreakdown`, `planVsLog`, `topMeals`, `topIngredients` |
| `GET` | `/api/stats/meal-summary` | Required | Current week's total meal count |

### Session Probe

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/session-probe` | Required | Check if Copilot session is resumable. Query: `chatSessionId`. Returns `{ status: "not_found" \| "disconnected" \| "resumable", sessionId?, chatSessionId, requestId }` |

---

## 2. UI Pages

| Route | Component | Purpose | Key Features |
|-------|-----------|---------|--------------|
| `/` | `HomePage` | Dashboard landing | Home dashboard with key stats and quick actions |
| `/meal-plan` | `MealPlanPage` | Calendar-based meal scheduling | Day/Week/Month views, drag-drop meal cards, edit/delete modals, AI suggestions, undo/redo history, view persisted to localStorage |
| `/grocery-list` | `GroceryListPage` | Grocery list management | Multi-list sidebar, quick filters (today/upcoming/favorites/recent), item editing, check-off tracking |
| `/grocery-list/shop/:id` | `ShoppingPage` | Mobile shopping mode | Optimized full-screen shopping checklist view |
| `/recipes` | `RecipesPage` | Recipe library | Search, filters (origin/tags/difficulty/cook time/rating), multi-select bulk operations, ingest from URL, edit/delete/export/import |
| `/recipes/:recipeId` | `RecipeDetailPage` | Single recipe view | Full recipe with scaling, cooking mode, instructions, metadata |
| `/stats` | `StatsPage` | Analytics dashboard | Heatmap, meal type breakdown, cuisine analysis, weekly trends, day-of-week patterns, plan vs. log comparison, top meals, ingredient frequency |
| `/settings` | `SettingsPage` | User preferences & configuration | Household preferences, dietary tags, cuisines, nutrition, skill level, budget, personas, AI tuning, tray/icon config, data export/import, clear history |

---

## 3. UI Components

### Chat (`src/client/src/components/chat/`)

| Component | Purpose |
|-----------|---------|
| `ChatPanel` | Main chat interface — scrollable messages, text input, size toggle (compact/medium/fullscreen), session browser, slash command menu |
| `ChatWidget` | Floating action button (🍳) that toggles the chat panel |
| `SessionBrowser` | List, load, and delete previous chat sessions with timestamps |
| `SlashCommandMenu` | Context menu triggered by typing `/` — shows all 7 slash commands |
| `slash-commands.ts` | `SLASH_COMMANDS` const array (source of truth for available commands) |

### Layout (`src/client/src/components/layout/`)

| Component | Purpose |
|-----------|---------|
| `AppShell` | Root layout — header nav, hamburger menu, main content outlet, chat widget. Nav links: Home, Meal Plan, Recipes, Grocery List, Stats, Settings |
| `ConnectionBanner` | Persistent banner showing server connection status (connecting/connected/disconnected) with retry button |

### Meal Plan (`src/client/src/components/meal-plan/`)

| Component | Purpose |
|-----------|---------|
| `DayView` | Single-day timeline grid of meal type slots |
| `WeekView` | 7-day calendar grid |
| `MonthView` | Month calendar with per-day meal counts |
| `EditModal` | Edit meal details (name, type, date, notes, ingredients) |
| `DeleteConfirmationModal` | Confirm before deleting a meal |
| `TrashDropZone` | Drag-and-drop zone for deleting meals |
| `use-meal-undo-redo.ts` | Hook managing local undo/redo stack (max 50 actions) |

### Grocery List (`src/client/src/components/grocery-list/`)

| Component | Purpose |
|-----------|---------|
| `ListsSidebar` | Multi-list panel with quick filters and new list button |
| `ListEditor` | Main list view — inline item editor, drag-to-reorder, checkboxes |
| `ItemRow` | Single grocery item (name, qty, unit, category, checked state) |
| `NewListModal` | Modal to create a new grocery list |
| `QuickReference` | Category summary sidebar showing counts and completion |

### Recipes (`src/client/src/components/recipes/`)

| Component | Purpose |
|-----------|---------|
| `RecipeGrid` | Card-based recipe library (filterable, searchable) |
| `RecipeCard` | Individual card — title, origin badge, difficulty, rating, cook time |
| `RecipeDetail` | Full recipe view with ingredients, instructions, metadata |
| `RecipeForm` | Create/edit recipe form |
| `AddRecipeModal` | Modal wrapping recipe creation |
| `IngestModal` | URL paste form for scraping recipes from the web |
| `CookingMode` | Full-screen step-through view for active cooking |
| `IngredientRow` | Single ingredient display inside a recipe |
| `ServingsScaler` | Adjust serving count — scales all ingredient quantities proportionally |
| `UnitToggle` | Switch between metric and imperial units |
| `RecipeFilterSidebar` | Filters: origin, difficulty, cook time, rating, tags |
| `SourceBadge` | Badge showing recipe origin (manual/imported/ai_generated) |

### Settings (`src/client/src/components/settings/`)

| Component | Purpose |
|-----------|---------|
| `PersonaGrid` | Display built-in and custom chef personas |
| `PersonaModal` | Create/edit custom persona (emoji, title, description, prompt) |
| `ChipList` | Multi-select chip input for dietary tags, cuisines, etc. |
| `TagCloud` | Tag cloud visualization for ingredient/cuisine data |
| `SegmentedControl` | Radio-button group for cooking length, skill level, budget |
| `CollapsibleSection` | Expandable/collapsible settings group |
| `ToggleSwitch` | Boolean toggle for feature preferences |

### Home (`src/client/src/components/home/`)

| Component | Purpose |
|-----------|---------|
| `HomeDashboard` | Landing dashboard — key stats, quick action buttons |

### Stats

| Component | Purpose |
|-----------|---------|
| `StatsDashboard` | Charts and data display for heatmap, trends, breakdowns |

### UI Primitives (`src/client/src/components/ui/`)

`Button`, `Input`, `Textarea`, `AlertDialog`

---

## 4. Core Services

All services follow the same pattern: `await bootstrap()` → Prisma query → serialize (Date to ISO string, parse `ingredientsJson`).

### MealService

| Method | Description |
|--------|-------------|
| `getMeal(id)` | Get single meal with serialized ingredients |
| `listMealsInRange(from, to)` | Meals in ISO date range |
| `createMeal({ id?, name, date?, mealType, notes?, ingredients? })` | Create with auto UUID |
| `updateMeal(id, patch)` | Update partial fields |
| `deleteMeal(id)` | Delete meal |
| `getTopIngredients(limit)` | Most-used ingredients across all meals |
| `getMealCountInRange(from, to)` | Count for analytics |

### GroceryService

| Method | Description |
|--------|-------------|
| `listGroceryLists()` | All lists, ordered by date/updatedAt |
| `getGroceryList(id)` | Single list with items, includes completion % |
| `getCurrentGroceryList()` | Latest list by date |
| `createGroceryList({ name, date?, favourite?, items? })` | Create with optional nested items |
| `updateGroceryList(id, { name?, date?, favourite? })` | Update metadata |
| `deleteGroceryList(id)` | Cascade delete items |
| `createGroceryItem(listId, item)` | Add item to list |
| `updateGroceryItem(listId, itemId, patch)` | Update item fields |
| `deleteGroceryItem(listId, itemId)` | Delete item |
| `reorderGroceryItems(listId, itemIds)` | Reorder by ID array |
| `restoreGroceryListSnapshot(snapshot)` | Restore list from snapshot (undo/redo) |

### RecipeService

| Method | Description |
|--------|-------------|
| `listRecipes(filters?)` | All recipes with optional filter: origin, tags, difficulty, maxCookTime, rating |
| `searchRecipes(query)` | Full-text search by title/description/ingredients |
| `getRecipe(id)` | Single recipe with all relations |
| `createRecipe(input)` | Create with ingredients, tags, sub-recipe links |
| `updateRecipe(id, input)` | Update recipe and nested data |
| `deleteRecipe(id)` | Cascade delete ingredients, tags, links |
| `ingestFromUrl(url)` | Scrape recipe via defuddle CLI → returns `IngestResult` for confirmation |
| `addToGroceryList(recipeIds, listId)` | Add recipe ingredients to existing grocery list |
| `generateGroceryList(recipeIds, name)` | Create new list from recipes (consolidates duplicate ingredients) |
| `exportRecipes(ids?)` | Export as `RecipeExportJson` |
| `importRecipes(input)` | Bulk import with duplicate handling |

### PreferenceService

| Method | Description |
|--------|-------------|
| `getPreferences()` | Get singleton user preferences |
| `updatePreferences(patch)` | Update any fields |
| `resetPreferences()` | Reset to hardcoded defaults |

### PersonaService

| Method | Description |
|--------|-------------|
| `list()` | All custom personas, ordered by createdAt |
| `findById(id)` | Single persona |
| `create({ emoji, title, description, prompt })` | Create custom persona |
| `update(id, patch)` | Update persona fields |
| `delete(id)` | Delete persona |

### ChatHistoryService

| Method | Description |
|--------|-------------|
| `listSessions(ownerId)` | All sessions for caller |
| `createSession(ownerId, title?)` | Create new chat session |
| `getSession(ownerId, id)` | Get session with current state |
| `deleteSession(ownerId, id)` | Delete session |
| `recordAction(...)` | Save undo-able action (forwardJson + inverseJson) |
| `getLatestUndoAction(ownerId, sessionId, domain?)` | Latest action eligible for undo |
| `getLatestRedoAction(ownerId, sessionId, domain?)` | Latest action eligible for redo |
| `markActionUndone(ownerId, actionId)` | Set `undoneAt` timestamp |
| `markActionRedone(ownerId, actionId)` | Clear `undoneAt` timestamp |

### MealLogService

| Method | Description |
|--------|-------------|
| `listAll()` | All meal log entries |
| `getHeatmap(weeks)` | Activity grid by week and day |
| `listRecent(count)` | Recent N meals eaten |
| `recordMealLog({ date, mealType, mealName, cooked? })` | Log a meal as eaten |
| `getMealTypeBreakdown()` | % breakdown of meal types |
| `getCuisineBreakdown()` | % breakdown by cuisine |
| `getWeeklyTrend(weeks)` | Meal count trend over N weeks |
| `getDayOfWeekBreakdown()` | Meals per day-of-week |
| `getPlanVsLogStats(days)` | Planned vs. actually eaten comparison |
| `getTopMeals(limit)` | Most-frequently cooked meals |

---

## 5. CLI Commands

**Binary:** `copilot-chef-server`

| Command | Alias | Description |
|---------|-------|-------------|
| `start` | (default, no subcommand) | Start the API server |
| `version` | `--version`, `-v` | Print server version |
| `config` | | Print loaded configuration as JSON |
| `db status` | | Verify database is initialized and accessible |
| `update` | `check-update` | Check GitHub Releases for a newer server version |

---

## 6. Auth Middleware

Applied to all `/api/*` routes except `/api/health`.

### Token Resolution Order

1. Config tokens from `ServerConfig.auth.tokens`
2. CSV env var `PA_MACHINE_AUTH_TOKENS` (`token=callerId:source` format)
3. Single fallback env vars `PA_MACHINE_AUTH_TOKEN` / `PA_MACHINE_CALLER_ID` / `PA_MACHINE_SOURCE`
4. No token configured → defaults to `{ callerId: "web-default", source: "web" }`

### Behavior

- Extracts `Authorization: Bearer <token>` header
- If auth is enabled and token is missing or invalid → `401 { error: "Unauthorized" }`
- Uses timing-safe comparison to prevent timing attacks
- Sets `callerId` and `source` on the Hono context (accessible via `getCallerId(c)`)

### CallerIdentity Type

```ts
type CallerIdentity = {
  callerId: string;   // e.g. "web-default", "api-client", "max-pa"
  source?: string;    // e.g. "web", "api-key", "machine"
};
```

---

## 7. Chat & AI Features

### Copilot Orchestration (`CopilotChef`)

- **Sessions:** `Map<sessionId, CopilotSession>` — created lazily on first chat call
- **State persistence:** SDK session state stored in `.copilot-sessions/` directory
- **Context building:** `buildContext()` parallel-fetches meals, grocery list, preferences, recipes, personas before each turn
- **System prompt:** `buildSystemPrompt(context)` injects live kitchen state — current week meals, grocery completion %, dietary preferences, chef persona, household size, seasonal region

### AI Tools Available to the Model

| Domain | Tools |
|--------|-------|
| Meals | `create`, `list`, `get`, `update`, `delete`, `move`, `replace`, `suggest`, `apply_pending`, `undo`, `redo` |
| Grocery | `create_list`, `get_current`, `get`, `update_list`, `delete_list`, `add_item`, `update_item`, `delete_item`, `reorder_items` |
| Recipes | `list`, `get`, `save`, `delete` |
| Utilities | `ask_user`, `update_preferences` |

All tool calls emit `domain_update` sentinel events for client-side cache invalidation.

### Streaming Protocol

- **Normal output:** Raw UTF-8 text delta stream
- **Control events:** Newline-delimited sentinels encoded as `\x00COPILOT_CHEF_EVENT\x00` + JSON payload

| Event Type | Payload | Purpose |
|-----------|---------|---------|
| `input_request` | `{ question, choices, allowFreeform }` | Pause stream, request user input |
| `domain_update` | `{ domain, toolName, toolResult }` | Tool executed — trigger UI cache invalidation |

### Chat Response Modes

1. **Streaming** (default): `Content-Type: text/plain`, UTF-8 delta stream with embedded sentinels
2. **JSON** (error or special response): `Content-Type: application/json`, `{ message, choices?, sessionId, chatSessionId }`

### Chat Session Lifecycle

1. Session created on first message if no `chatSessionId` provided
2. Stored in `ChatSession` DB record with `ownerId`, `copilotSessionId`, title, state
3. Title auto-generated from first message (max 72 chars)
4. Messages persisted if `saveChatHistory` preference is enabled
5. Previous sessions resumable — client calls `/api/session-probe` to check status

### Input Request Handling

1. Model calls `ask_user` tool → emits `input_request` event
2. Streaming pauses; client renders `QuestionCard` with choices and optional free-form input
3. User answers → sent back via `/api/chat` with pending request context
4. Streaming resumes with user's answer as context

### Undo/Redo System

- `ChatAction` DB table stores `forwardJson` and `inverseJson` per operation
- Undo/redo surfaced only from the meal-plan page (context-aware)
- Client-side: `useMealUndoRedo` hook manages local stack (max 50 actions)

### Slash Commands (7 built-in)

| Command | Label | Purpose |
|---------|-------|---------|
| `/plan-week` | Plan My Week | Generate a full week of meals |
| `/new-grocery-list` | New Grocery List | Create grocery list from scheduled meals |
| `/suggest-meals` | Suggest Meals | Get 5 personalized meal suggestions |
| `/check-pantry` | Check Pantry | Review what you likely have on hand |
| `/nutrition` | Nutrition Overview | Nutritional analysis of current meals |
| `/quick-shop` | Quick Shop | Category-organized summary of unchecked items |
| `/open-recipe-book` | Recipe Book | Navigate to recipes and get a summary |

---

## 8. Configuration

### Server Config (`copilot-chef-server.toml`)

```toml
[server]
port = 3001
host = "127.0.0.1"
logLevel = "info"            # debug | info | warn | error

[database]
url = "sqlite://./copilot-chef.db"

[auth]
tokens = []                  # Array of bearer tokens; empty = auth disabled
copilotModel = "gpt-4o-mini"

[updates]
feedUrl = ""                 # GitHub Releases URL (auto-detected from package)
checkOnStartup = true

[cors]
origins = ["tauri://localhost", "http://localhost:5173"]
```

### Client Config (`copilot-chef-client.toml` in Tauri app data dir)

```toml
[connection]
serverUrl = "http://localhost:3001"
apiKey = ""
autoLaunchServer = true
serverBinaryPath = ""

[updates]
checkOnStartup = true

[ui]
theme = "system"             # system | light | dark
```

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `COPILOT_CHEF_DATABASE_URL` | (unset) | Optional preferred override for `database.url` |
| `COPILOT_MODEL` | `gpt-4o-mini` | Override AI model |
| `COPILOT_CHEF_SERVER_PORT` | `3001` | Server port override |
| `PA_MACHINE_AUTH_ENABLED` | `false` | Require bearer tokens for API |
| `PA_MACHINE_AUTH_TOKEN` | (unset) | Single bearer token |
| `PA_MACHINE_CALLER_ID` | `max-pa` | Caller ID for single token |
| `PA_MACHINE_SOURCE` | `machine` | Source label for single token |
| `PA_MACHINE_AUTH_TOKENS` | (unset) | CSV of `token=callerId:source` pairs |

### User Preferences (DB Singleton `id: "default"`)

| Group | Fields |
|-------|--------|
| Household | `householdSize` (int), `seasonalRegion` (string) |
| Cooking | `cookingLength` (quick\|weeknight\|relaxed), `skillLevel` (home-cook\|intermediate\|advanced), `budgetRange` (budget\|moderate\|premium) |
| Dietary | `dietaryTags` (CSV), `favoriteCuisines` (CSV), `avoidCuisines` (CSV), `avoidIngredients` (JSON array), `pantryStaples` (JSON array), `nutritionTags` (CSV) |
| AI Tuning | `chefPersona` (coach\|scientist\|entertainer\|minimalist\|professor\|michelin), `replyLength` (brief\|balanced\|detailed), `emojiUsage` (none\|occasional\|frequent), `reasoningEffort` (low\|medium\|high\|xhigh) |
| Features | `autoImproveChef`, `contextAwareness`, `seasonalAwareness`, `proactiveTips`, `autoGenerateGrocery`, `consolidateIngredients`, `saveChatHistory` |
| Defaults | `defaultPlanLength` (7), `groceryGrouping` (category), `defaultRecipeView` (basic), `defaultUnitMode` (cup) |
| Notes | `planningNotes` (string) |

---

## 9. Database Schema

**Provider:** SQLite with WAL mode  
**ORM:** Prisma

### Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `Meal` | Scheduled meals | `id` (cuid), `name`, `date?`, `mealType` (enum), `notes`, `ingredientsJson` (JSON string), `createdAt`. Index on `date` |
| `GroceryList` | Shopping lists | `id` (cuid), `name`, `date`, `favourite` (bool), `createdAt`, `updatedAt`. Cascade deletes `GroceryItem` |
| `GroceryItem` | Items in a list | `id` (cuid), `groceryListId` (FK), `name`, `qty?`, `unit?`, `category`, `notes?`, `meal?`, `checked`, `sortOrder` |
| `UserPreference` | Settings singleton | `id` ("default"), 30+ preference fields as strings/bools, `createdAt`, `updatedAt` |
| `Recipe` | Saved recipes | `id` (cuid), `title`, `description?`, `servings`, `prepTime?`, `cookTime?`, `difficulty?`, `instructions` (JSON string), `sourceUrl?`, `sourceLabel?`, `origin` (manual\|imported\|ai_generated), `rating?`, `cookNotes?`, `lastMadeAt?`. Index on `title`, `origin`, `sourceUrl` |
| `RecipeIngredient` | Ingredients in a recipe | `id` (cuid), `recipeId` (FK), `name`, `quantity?`, `unit?`, `notes?`, `order`. Index on `recipeId+order` and `name` |
| `RecipeTag` | Tags on recipes | `id` (cuid), `recipeId` (FK), `tag`. Unique on `recipeId+tag`. Index on `tag` |
| `RecipeLink` | Sub-recipe references | `id` (cuid), `parentId` (FK), `subRecipeId` (FK). Unique on `parentId+subRecipeId` |
| `MealLog` | Meals actually eaten | `id` (cuid), `date`, `mealType` (enum), `mealName`, `cooked` (bool), `mealId?` (FK SetNull). Index on `date` |
| `ChatSession` | Chat history sessions | `id` (cuid), `ownerId`, `copilotSessionId?`, `title?`, `state` (enum), pending input fields (`requestId`, `question`, `choicesJson`, `allowFreeform`, `requestedAt?`, `retryCount`, `errorCode?`, `lastRequestId?`). Index on `ownerId+updatedAt` and `ownerId+state+updatedAt` |
| `ChatMessage` | Messages in a session | `id` (cuid), `chatSessionId` (FK), `role`, `content`, `createdAt`. Index on `chatSessionId+createdAt` |
| `ChatAction` | Undo-able AI actions | `id` (cuid), `chatSessionId` (FK), `domain`, `actionType`, `summary`, `forwardJson`, `inverseJson`, `undoneAt?`, `createdAt`. Index on `chatSessionId+createdAt` and `chatSessionId+undoneAt` |
| `ChatPendingSuggestion` | Pending AI suggestions | `id` (cuid), `chatSessionId` (FK), `domain`, `title`, `payloadJson`, `expiresAt`, `createdAt`. Index on `chatSessionId+createdAt` and `chatSessionId+expiresAt` |
| `CustomPersona` | User-defined chef personas | `id` (cuid), `emoji`, `title`, `description`, `prompt`, `createdAt`, `updatedAt` |

### Enums

| Enum | Values |
|------|--------|
| `MealType` | `BREAKFAST`, `MORNING_SNACK`, `LUNCH`, `AFTERNOON_SNACK`, `DINNER`, `SNACK` |
| `ChatSessionState` | `idle`, `waiting_for_input`, `completing_input`, `completed`, `failed` |

### Cascade Behaviors

- `GroceryList` → `GroceryItem` (cascade delete)
- `Recipe` → `RecipeIngredient`, `RecipeTag`, `RecipeLink` (cascade delete)
- `ChatSession` → `ChatMessage`, `ChatAction`, `ChatPendingSuggestion` (cascade delete)
- `MealLog.mealId` → set null on `Meal` delete

---

## 10. Background Behaviors & Utilities

### Client Update Check (`app.tsx`)

- Runs on startup if `config.updates.checkOnStartup` is true
- Uses Tauri `@tauri-apps/plugin-updater`
- Auto-downloads and relaunches if update available
- Errors silently ignored (best-effort only)

### Server Update Check (`updater.ts`)

- `checkForUpdate(currentVersion)` queries GitHub Releases API for `server-v*` tags
- Filters: non-prerelease, non-draft only
- Semantic version comparison (major.minor.patch)
- 5-second request timeout
- Returns `{ hasUpdate, currentVersion, latestVersion?, releaseUrl? }`

### Server Health Polling (`connection.ts` — client hook)

- `useServerConnection(serverUrl)` hook polls `/api/health` on load
- Exponential backoff: 100ms → 5s max interval
- States: `connecting` → `connected` → `disconnected` (auto-retry)
- Exposes `{ status, retry }` for `ConnectionBanner`

### Database Bootstrap (`core/lib/bootstrap.ts`)

- Lazy initialization on first service method call (idempotent)
- Enables SQLite WAL mode
- Creates `.copilot-sessions/` directory for SDK session state

### Server Auto-Launch / Tray (`server-launcher.ts` — client)

- `launchServer(config)` spawns `copilot-chef-server start` as a child process
- Auto-restarts up to 3 times on unexpected exit (backoff: 1s, 2s, 3s)
- Streams stdout/stderr to console
- `stopServer()` called on Tauri app quit for graceful shutdown
- Controlled by `config.connection.autoLaunchServer` and `config.connection.serverBinaryPath`

### Meal Plan View Persistence

- localStorage key `cal_view` stores `"day" | "week" | "month"`
- Restored on page load

### Chat Session Resumption

- Client calls `/api/session-probe?chatSessionId=<id>` on load
- Resumable session → uses stored `copilotSessionId`
- Non-resumable → creates a fresh session

### Ingredient Consolidation

- Triggered when generating a grocery list from multiple recipes
- Merges same-ingredient entries across recipes
- Combines quantities where unit types match
- Respects user `consolidateIngredients` preference toggle

### Recipe Ingestion Pipeline

- Calls the **defuddle CLI** (`npx defuddle parse <url> --json --markdown`) to scrape URLs
- Extracts: title, description, servings, prep/cook time, ingredients, instructions
- Auto-classifies difficulty and cuisine
- Returns `IngestResult` for user confirmation before persisting

### Cuisine Classification (`core/lib/cuisine-classifier.ts`)

- Maps meal names and ingredient lists to cuisine tags (Mediterranean, Japanese, Thai, etc.)
- Used in recipe origin auto-detection and `cuisineBreakdown` stats

### Calendar & Date Utilities (`lib/calendar.ts`)

- UTC noon anchor for normalized meal dates
- Date range calculations for day/week/month views
- Relative date parsing: "tomorrow", "next Monday", etc.

### Grocery Helpers (`lib/grocery.ts`)

- Filter lists by: today, upcoming N days, favorites, recent
- Completion % and item count by category
- Derived state helpers for reactive UI updates

### Unit Conversion (`core/lib/unit-converter.ts`)

- Metric ↔ Imperial (g/ml ↔ oz/cup/tbsp/tsp)
- Base unit normalization
- Ingredient-type-aware conversion (grams for solids, ml for liquids)

### Ingredient Normalizer (`core/lib/ingredient-normalizer.ts`)

- Lowercase, trim, emoji-strip ingredient names
- Extract and normalize quantity strings
- Detect common ingredient name variations

---

## Summary

| Category | Count | Notes |
|----------|-------|-------|
| API Endpoints | 40+ | Meals, Grocery, Recipes, Preferences, Chat, Sessions, Personas, Stats, Health |
| Client Pages | 8 | Home, Meal Plan, Grocery, Recipes, Stats, Settings + detail views |
| UI Components | 40+ | Chat, Layout, Meal Plan, Grocery, Recipes, Settings, Home, Stats, UI primitives |
| Core Services | 7 | Meal, Grocery, Recipe, Preference, Persona, ChatHistory, MealLog |
| CLI Commands | 6 | start, version, config, db status, update/check-update |
| AI Tools | 20+ | Meal CRUD, Grocery CRUD, Recipe ops, undo/redo, ask_user, update_preferences |
| Database Models | 14 | Meal, GroceryList, GroceryItem, UserPreference, Recipe, RecipeIngredient, RecipeTag, RecipeLink, MealLog, ChatSession, ChatMessage, ChatAction, ChatPendingSuggestion, CustomPersona |
| Slash Commands | 7 | /plan-week, /new-grocery-list, /suggest-meals, /check-pantry, /nutrition, /quick-shop, /open-recipe-book |
| Config Fields | 20+ | Server TOML, client TOML, 10+ env vars, 30+ user preference fields |
| Enums | 2 | MealType (6 values), ChatSessionState (5 values) |
