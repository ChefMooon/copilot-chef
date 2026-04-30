# Copilot Chef Configuration Reference

## Quick Reference

### Meal Plan Modal And Toast Behavior

| Behavior | Description |
| --- | --- |
| Delete confirmation focus | Delete confirmation modal focuses Delete Meal on open so keyboard Enter confirms by default |
| Delete undo toast | Delete actions from meal plan show Undo toast for 30 seconds |
| Restored toast duration | The success toast after restoring a meal is 5 seconds |

### Related UI Tests

These behaviors are validated through manual smoke testing. Automated tests live primarily under `src/main/server/` and `src/shared/config/__tests__/`. See [docs/developer-guide.md](developer-guide.md) for how to run and add Vitest tests.

### Environment Variables

| Name                          | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `COPILOT_CHEF_DATABASE_URL`   | SQLite database file path (preferred env override)  |
| `COPILOT_CHEF_SERVER_PORT`    | Override server port (default: 3001)                |
| `COPILOT_MODEL`               | AI model identifier used for chat (default: `gpt-4.1`)      |

### User Preferences

| Name                     | Description                                                               |
| ------------------------ | ------------------------------------------------------------------------- |
| `householdSize`          | Number of people being cooked for (1–8)                                   |
| `cookingLength`          | How much time is typically available to cook                              |
| `dietaryTags`            | Dietary restrictions or lifestyle tags (e.g. vegan, keto)                 |
| `favoriteCuisines`       | Cuisine styles the user enjoys                                            |
| `avoidCuisines`          | Cuisine styles the user wants excluded                                    |
| `avoidIngredients`       | Specific ingredients to never include in suggestions                      |
| `pantryStaples`          | Ingredients always on hand that can be assumed available                  |
| `planningNotes`          | Free-form notes passed to the AI for meal planning context                |
| `nutritionTags`          | Nutritional goals or focus areas (e.g. high protein, low carb)            |
| `skillLevel`             | Cooking skill level of the user                                           |
| `budgetRange`            | Grocery budget tier                                                       |
| `chefPersona`            | Personality style of the AI chef assistant                                |
| `replyLength`            | Preferred verbosity of AI responses                                       |
| `emojiUsage`             | How often the AI should use emoji                                         |
| `autoImproveChef`        | Whether the AI should adapt based on past interactions                    |
| `contextAwareness`       | Whether the AI uses prior conversation context                            |
| `seasonalAwareness`      | Whether the AI considers seasonal ingredient availability                 |
| `seasonalRegion`         | Geographic region used for seasonal awareness                             |
| `proactiveTips`          | Whether the AI should offer unsolicited tips and suggestions              |
| `autoGenerateGrocery`    | Whether to automatically generate a grocery list from scheduled meals      |
| `consolidateIngredients` | Whether to merge duplicate ingredients across meals in a grocery list     |
| `defaultPlanLength`      | Default number of days for a generated meal plan                          |
| `groceryGrouping`        | How grocery list items are grouped (by category, meal, or alphabetically) |
| `defaultRecipeView`      | Default view mode when opening a recipe (basic, annotated, or cooking)    |
| `defaultUnitMode`        | Default unit system for recipe ingredients (cup or grams)                 |
| `saveChatHistory`        | Whether chat history is persisted between sessions                        |
| `reasoningEffort`        | AI reasoning effort level passed to the model (default, low, medium, high)|

---

## Detailed Reference

### Environment Variables

#### `COPILOT_CHEF_DATABASE_URL`

- **Implemented:** Yes
- **Default:** `file:./data/copilot-chef.db`
- **Affects:** SQLite database path used by Prisma. Set automatically by the Electron main process; can be overridden externally before the process starts.

#### `COPILOT_CHEF_SERVER_PORT`

- **Implemented:** Yes
- **Default:** `3001`
- **Affects:** In-process Hono server port. Superseded by the `server_port` app setting when running inside Electron.

#### `COPILOT_MODEL`

- **Implemented:** Yes
- **Default:** `gpt-4.1`
- **Affects:** `src/main/server/copilot/copilot-chef.ts` — model passed to the GitHub Copilot SDK for all AI completions. In the Electron app this is set from the `copilot_model` app setting at startup; direct env override is also respected.

---

### User Preferences

All preferences are stored in the `UserPreference` Prisma model (`prisma/schema.prisma`) and managed by `src/main/server/services/preference-service.ts`. They are exposed via the `/api/preferences` route and rendered in `src/renderer/pages/settings.tsx`.

#### `householdSize`

- **Implemented:** Yes
- **Default:** `2`
- **Affects:** `preference-service.ts`, `settings.tsx` (Household card, range slider 1–8), system prompt context

#### `cookingLength`

- **Implemented:** Yes
- **Default:** `"weeknight"`
- **Options:** `quick`, `weeknight`, `relaxed`, `weekend`
- **Affects:** `preference-service.ts`, `settings.tsx` (Household card, select dropdown), system prompt context

#### `dietaryTags`

- **Implemented:** Yes
- **Default:** `""` (empty)
- **Format:** Comma-separated string (e.g. `"vegan,gluten-free"`)
- **Options:** Pescatarian, Vegetarian, Vegan, Omnivore, Keto, Paleo, Gluten-free, Dairy-free, Halal, Kosher
- **Affects:** `preference-service.ts`, `settings.tsx` (Dietary Direction card, tag cloud), system prompt context

#### `favoriteCuisines`

- **Implemented:** Yes
- **Default:** `""` (empty)
- **Format:** Comma-separated string
- **Affects:** `preference-service.ts`, `settings.tsx` (Cuisines card, tag cloud — mutually exclusive with `avoidCuisines`), system prompt context

#### `avoidCuisines`

- **Implemented:** Yes
- **Default:** `""` (empty)
- **Format:** Comma-separated string
- **Affects:** `preference-service.ts`, `settings.tsx` (Cuisines card, tag cloud — mutually exclusive with `favoriteCuisines`), system prompt context

#### `avoidIngredients`

- **Implemented:** Yes
- **Default:** `"[]"`
- **Format:** JSON array of strings
- **Affects:** `preference-service.ts`, `settings.tsx` (Avoid & Pantry card, draggable chip list), system prompt context

#### `pantryStaples`

- **Implemented:** Yes
- **Default:** `"[]"`
- **Format:** JSON array of strings
- **Affects:** `preference-service.ts`, `settings.tsx` (Avoid & Pantry card, draggable chip list), system prompt context

#### `planningNotes`

- **Implemented:** Yes
- **Default:** `""` (empty)
- **Affects:** `preference-service.ts`, `settings.tsx` (Planning Notes card, textarea with 600ms debounce), system prompt context

#### `nutritionTags`

- **Implemented:** Yes
- **Default:** `""` (empty)
- **Format:** Comma-separated string
- **Options:** Balanced, High protein, Low carb, Low sodium, Low calorie, Anti-inflammatory, Gut health, Heart-healthy
- **Affects:** `preference-service.ts`, `settings.tsx` (Nutrition Focus card, tag cloud), system prompt context

#### `skillLevel`

- **Implemented:** Yes
- **Default:** `"home-cook"`
- **Options:** `beginner`, `home-cook`, `confident`, `advanced`
- **Affects:** `preference-service.ts`, `settings.tsx` (Skill & Budget card, select dropdown), system prompt context

#### `budgetRange`

- **Implemented:** Yes
- **Default:** `"moderate"`
- **Options:** `budget`, `moderate`, `premium`
- **Affects:** `preference-service.ts`, `settings.tsx` (Skill & Budget card, select dropdown), system prompt context

#### `chefPersona`

- **Implemented:** Yes
- **Default:** `"coach"`
- **Options:** `coach`, `scientist`, `entertainer`, `minimalist`, `professor`, `michelin`
- **Affects:** `preference-service.ts`, `settings.tsx` (Chef Personality card, persona grid), `src/main/server/copilot/system-prompt.ts` (maps to persona instruction injected at prompt start)

#### `replyLength`

- **Implemented:** Yes
- **Default:** `"balanced"`
- **Options:** `concise`, `balanced`, `detailed`
- **Affects:** `preference-service.ts`, `settings.tsx` (Response Style card, segmented control), `src/main/server/copilot/system-prompt.ts` (injects length instruction)

#### `emojiUsage`

- **Implemented:** Yes
- **Default:** `"occasional"`
- **Options:** `none`, `occasional`, `frequent`
- **Affects:** `preference-service.ts`, `settings.tsx` (Response Style card, segmented control), `src/main/server/copilot/system-prompt.ts` (injects emoji instruction)

#### `autoImproveChef`

- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings.tsx` (AI Behavior card, toggle switch), system prompt context

#### `contextAwareness`

- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings.tsx` (AI Behavior card, toggle switch), system prompt context

#### `seasonalAwareness`

- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings.tsx` (AI Behavior card, toggle switch), system prompt context. When enabled, reveals the `seasonalRegion` selector.

#### `seasonalRegion`

- **Implemented:** Yes
- **Default:** `"eastern-us"`
- **Options:** Northern US / Canada, Eastern US, Southern US, Western US / Pacific, Western Europe, Mediterranean, East Asia, South Asia, Australia / NZ, Southern hemisphere
- **Affects:** `preference-service.ts`, `settings.tsx` (AI Behavior card, conditional select dropdown), `src/server/src/routes/preferences.ts` (auto-detect endpoint), system prompt context

#### `proactiveTips`

- **Implemented:** Yes
- **Default:** `false`
- **Affects:** `preference-service.ts`, `settings.tsx` (AI Behavior card, toggle switch), system prompt context

#### `autoGenerateGrocery`

- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings.tsx` (Grocery & Planning card, toggle switch), system prompt context

#### `consolidateIngredients`

- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings.tsx` (Grocery & Planning card, toggle switch), system prompt context

#### `defaultPlanLength`

- **Implemented:** Yes
- **Default:** `"7"`
- **Options:** `"3"`, `"7"`, `"14"`
- **Affects:** `preference-service.ts`, `settings.tsx` (Grocery & Planning card, select dropdown), system prompt context

#### `groceryGrouping`

- **Implemented:** Yes
- **Default:** `"category"`
- **Options:** `category`, `meal`, `alpha`
- **Affects:** `preference-service.ts`, `settings.tsx` (Grocery & Planning card, select dropdown), system prompt context

#### `saveChatHistory`

- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings.tsx` (Data & Privacy card, toggle switch), `src/main/server/services/chat-history-service.ts`

#### `defaultRecipeView`

- **Implemented:** Yes
- **Default:** `"basic"`
- **Options:** `basic`, `detailed` (Annotated), `cooking`
- **Affects:** `preference-service.ts`, `settings.tsx` (Grocery & Planning card, segmented control), recipe page initial view mode

#### `defaultUnitMode`

- **Implemented:** Yes
- **Default:** `"cup"`
- **Options:** `cup`, `grams`
- **Affects:** `preference-service.ts`, `settings.tsx` (Grocery & Planning card, segmented control), recipe ingredient unit display

#### `reasoningEffort`

- **Implemented:** Yes
- **Default:** `""` (uses model default)
- **Options:** `""` (Default), `low`, `medium`, `high`
- **Affects:** `preference-service.ts`, `settings.tsx` (AI Behavior card, segmented control), `src/main/server/copilot/copilot-chef.ts` (passed as `reasoningEffort` to Copilot SDK calls)
