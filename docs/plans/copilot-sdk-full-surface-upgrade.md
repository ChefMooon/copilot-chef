# Copilot SDK Full-Surface Upgrade Plan

> Handoff plan for an implementation agent. Finish the Copilot SDK upgrade by closing session-parity gaps and moving route-only chat capabilities into first-class SDK tools.

## Objective

Give the Copilot model the same functional surface currently implemented in the chat route, while keeping the app stable during migration.

## Current State

Already done:
- Real streaming in `CopilotChef`
- `ask_user` UI flow with sentinel parsing
- `copilotSessionId` persistence and session resume plumbing
- `reasoningEffort` storage and settings UI
- `COPILOT_MCP_SERVERS` parsing
- Core SDK tools: `create_meal`, `list_meals`

Still missing:
- Full parity between `createSession()` and `resumeSession()`
- SDK tools for meal, grocery, history, preferences, and recipes
- Shared parsing/matching helpers extracted from the route layer
- SDK-first routing with fallback during rollout

## Required Files

- [src/core/src/copilot/copilot-chef.ts](../../src/core/src/copilot/copilot-chef.ts)
- [src/core/src/services/meal-service.ts](../../src/core/src/services/meal-service.ts)
- [src/core/src/services/grocery-service.ts](../../src/core/src/services/grocery-service.ts)
- [src/core/src/services/chat-history-service.ts](../../src/core/src/services/chat-history-service.ts)
- [src/core/src/services/preference-service.ts](../../src/core/src/services/preference-service.ts)
- [src/core/src/services/recipe-service.ts](../../src/core/src/services/recipe-service.ts)
- [src/core/src/schemas/recipe-schemas.ts](../../src/core/src/schemas/recipe-schemas.ts)
- [src/core/src/index.ts](../../src/core/src/index.ts)
- [src/web/src/app/api/chat/route.ts](../../src/web/src/app/api/chat/route.ts)
- [src/web/src/app/api/chat/respond-to-input/route.ts](../../src/web/src/app/api/chat/respond-to-input/route.ts)
- [src/web/src/context/chat-context.tsx](../../src/web/src/context/chat-context.tsx)
- [src/web/src/components/chat/ChatPanel.tsx](../../src/web/src/components/chat/ChatPanel.tsx)
- [src/web/src/app/api/chat/route.test.ts](../../src/web/src/app/api/chat/route.test.ts)

## Implementation Phases

### 1. Fix session parity

Make `resumeSession()` use the same config as `createSession()`.

Must include:
- `tools`
- `onUserInputRequest`
- `hooks`
- `mcpServers`
- `availableTools`
- `onPermissionRequest`
- `reasoningEffort`
- `systemMessage`
- `streaming`

Implementation notes:
- Extract one shared session-config builder.
- Do not let resumed sessions lose tool access or ask-user behavior.
- Preserve the current permission allowlist.

### 2. Extract route helpers into core

Move reusable logic from `src/web/src/app/api/chat/route.ts` into core utilities.

Extract at minimum:
- Meal type normalization
- Relative date parsing
- Grocery fuzzy matching
- Next-night date generation
- Undo/redo helper data shaping

Recommended file:
- `src/core/src/lib/chat-command-utils.ts`

Export the helpers from `src/core/src/index.ts`.

### 3. Add missing meal and history tools

Add SDK tools for the current meal workflows:
- `update_meal`
- `delete_meal`
- `move_meal`
- `replace_meal`
- `remove_meal`
- `suggest_meals`
- `apply_pending_meals`
- `undo_action`
- `redo_action`

Requirements:
- Use zod schemas for every input.
- Reuse `MealService` and `ChatHistoryService`.
- Preserve undo/redo and suggestion semantics.
- Keep outputs structured and predictable.

### 4. Add missing grocery tools

Add SDK tools for grocery list and item management:
- `list_grocery_lists`
- `get_current_grocery_list`
- `get_grocery_list`
- `create_grocery_list`
- `update_grocery_list`
- `delete_grocery_list`
- `add_grocery_item`
- `update_grocery_item`
- `delete_grocery_item`
- `reorder_grocery_items`

Requirements:
- Reuse `GroceryService`.
- Preserve ambiguity handling with choice-based clarification.
- Preserve reorder and checked-state behavior.

### 5. Add preferences and recipe tools

Add SDK tools for preferences and recipes:
- `get_preferences`
- `update_preferences`
- `list_recipes`
- `get_recipe`
- `save_recipe`
- `delete_recipe`

Requirements:
- Reuse `PreferenceService` and `RecipeService`.
- Reuse `AIRecipeSaveSchema` for `save_recipe`.
- Include `reasoningEffort` in preference read/write.

### 6. Migrate route behavior to SDK-first execution

Update `src/web/src/app/api/chat/route.ts` so migrated capabilities prefer SDK tools first.

Rules:
- Keep route handlers as fallback during rollout.
- Use route regex handlers only for un-migrated intents or safe fallback cases.
- Preserve current structured responses and history persistence.
- Add logging for SDK-tool hits vs fallback hits.

### 7. Verify and harden

Verification checklist:
- `npm run build`
- `npm run test --workspace @copilot-chef/web`
- Manual validation for meal edits, grocery edits, undo/redo, ask-user prompts, resumed sessions
- Manual validation with `COPILOT_MCP_SERVERS` set

Cleanup rule:
- Remove route-only handlers only after the SDK-backed path is stable.

## Target Tool Catalog

### Meal
- `create_meal`
- `list_meals`
- `get_meal`
- `update_meal`
- `delete_meal`
- `move_meal`
- `replace_meal`
- `remove_meal`
- `suggest_meals`
- `apply_pending_meals`

### Grocery
- `list_grocery_lists`
- `get_current_grocery_list`
- `get_grocery_list`
- `create_grocery_list`
- `update_grocery_list`
- `delete_grocery_list`
- `add_grocery_item`
- `update_grocery_item`
- `delete_grocery_item`
- `reorder_grocery_items`

### History
- `undo_action`
- `redo_action`

### Preferences
- `get_preferences`
- `update_preferences`

### Recipes
- `list_recipes`
- `get_recipe`
- `save_recipe`
- `delete_recipe`

### User Input
- `ask_user`

## Constraints

- Do not break the sentinel-based ask-user flow in the web client.
- Keep permission handling restrictive unless the design intentionally expands it.
- Keep create-session and resume-session behavior in lockstep.
- Prefer small helpers over a large route rewrite.

## Suggested Order

1. Session parity
2. Shared helper extraction
3. Meal + history tools
4. Grocery tools
5. Preferences + recipe tools
6. SDK-first route migration
7. Tests, build, and manual validation

## Done Criteria

The upgrade is complete when:
- Resumed sessions can still call tools and ask the user for input
- The Copilot model can perform the missing meal, grocery, history, preferences, and recipe actions through SDK tools
- Existing chat behavior still works
- Build and tests pass
- Route handlers are fallback, not primary, for migrated intents
