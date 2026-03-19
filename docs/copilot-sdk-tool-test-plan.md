# Copilot SDK Tool Test Plan

## Objective

Provide direct automated coverage for the Copilot Chef SDK tool surface in core, independent of route-level regex handling.

## Scope

This plan covers:

1. Direct handler execution for every SDK tool defined in CopilotChef
2. Session-config coverage for ask-user flow and tool availability
3. Basic mutation-side effects such as service calls and history recording
4. Regression protection against tool-surface drift

This plan does not cover:

1. Full LLM prompt-to-tool selection behavior
2. Browser rendering details
3. Route fallback regex behavior beyond existing web tests
4. End-to-end Copilot SDK network integration with the real upstream SDK service

## Test Files

Primary automated suite:

- [src/core/src/copilot/copilot-chef.tools.test.ts](../src/core/src/copilot/copilot-chef.tools.test.ts)

Existing related suites:

- [src/web/src/app/api/chat/route.test.ts](../src/web/src/app/api/chat/route.test.ts)
- [src/web/src/app/api/preferences/route.test.ts](../src/web/src/app/api/preferences/route.test.ts)

## Command Matrix

Core tool tests:

```bash
npm run test:core
```

Full automated suite:

```bash
npm run test
```

## Tool Coverage Matrix

| Area | Tool | Automated Assertion |
|---|---|---|
| Meal | `create_meal` | Creates meal, resolves natural date, records history |
| Meal | `list_meals` | Returns count and meals for range |
| Meal | `get_meal` | Reads meal by id |
| Meal | `update_meal` | Updates meal and records inverse state |
| Meal | `delete_meal` | Deletes meal and records undo payload |
| Meal | `move_meal` | Resolves natural date and updates date |
| Meal | `replace_meal` | Renames meal |
| Meal | `remove_meal` | Alias delete behavior |
| Meal | `suggest_meals` | Creates pending suggestions |
| Meal | `apply_pending_meals` | Converts pending suggestions into meal entries |
| Grocery | `list_grocery_lists` | Returns grocery lists |
| Grocery | `get_current_grocery_list` | Returns current list |
| Grocery | `get_grocery_list` | Reads list by id |
| Grocery | `create_grocery_list` | Creates list |
| Grocery | `update_grocery_list` | Updates list metadata |
| Grocery | `delete_grocery_list` | Deletes list |
| Grocery | `add_grocery_item` | Adds item to list |
| Grocery | `update_grocery_item` | Updates item patch |
| Grocery | `delete_grocery_item` | Deletes item |
| Grocery | `reorder_grocery_items` | Reorders item ids |
| History | `undo_action` | Applies inverse payload and marks action undone |
| History | `redo_action` | Reapplies payload and marks action redone |
| Preferences | `get_preferences` | Returns full preference payload |
| Preferences | `update_preferences` | Applies preference patch including `reasoningEffort` |
| Recipe | `list_recipes` | Returns filtered recipes |
| Recipe | `get_recipe` | Reads recipe by id |
| Recipe | `save_recipe` | Persists AI-generated recipe payload |
| Recipe | `delete_recipe` | Deletes recipe by id |
| User Input | `ask_user` flow | Session config exposes tools, sentinel write occurs, pending response resolves |

## Assertions By Category

### Meal tools

1. Correct service method is called
2. Returned payload is structured
3. History is recorded for mutating actions
4. Natural language dates such as `tomorrow` are normalized correctly

### Grocery tools

1. Correct list or item service is called
2. Returned payload is structured
3. Mutating item operations return updated list payload
4. Reorder preserves explicit item order input

### History tools

1. Latest action is loaded from history service
2. Forward or inverse payload is applied to the correct domain service
3. Action state is marked undone or redone

### Preference and recipe tools

1. Read tools proxy the correct service method
2. Update or save tools transform input into the core service contract
3. `save_recipe` uses AI-generated origin semantics

### Ask-user flow

1. Session config exposes `ask_user` in available tools
2. `onUserInputRequest` writes the sentinel event into the stream
3. `resolveInputRequest` resolves the pending promise with the provided answer

## Regression Risks Covered

1. Tool rename or removal without test updates
2. Handler signature drift
3. Natural-date parsing regressions for SDK tools
4. Missing history recording on mutating meal actions
5. Ask-user flow regressions during session-config changes

## Follow-up Recommendations

1. Add one integration-style test that verifies `buildSystemPrompt()` enumerates the full tool surface accurately
2. Add one browser-level test for streamed `domain_update` invalidation once UI E2E coverage exists
3. Expand tool tests to cover ambiguity-handling paths if those move from route fallback into SDK-native handlers
