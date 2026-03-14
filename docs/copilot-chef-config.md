# Copilot Chef Configuration Reference

## Quick Reference

### Environment Variables

| Name | Description |
|------|-------------|
| `DATABASE_URL` | SQLite database file path |
| `NEXT_PUBLIC_APP_NAME` | Application display name shown in the UI |
| `COPILOT_MODEL` | AI model identifier used for chat |
| `NEXT_PUBLIC_PERSONA_ENABLED` | Feature flag to enable the chef persona selector UI |

### User Preferences

| Name | Description |
|------|-------------|
| `householdSize` | Number of people being cooked for (1–8) |
| `cookingLength` | How much time is typically available to cook |
| `dietaryTags` | Dietary restrictions or lifestyle tags (e.g. vegan, keto) |
| `favoriteCuisines` | Cuisine styles the user enjoys |
| `avoidCuisines` | Cuisine styles the user wants excluded |
| `avoidIngredients` | Specific ingredients to never include in suggestions |
| `pantryStaples` | Ingredients always on hand that can be assumed available |
| `planningNotes` | Free-form notes passed to the AI for meal planning context |
| `nutritionTags` | Nutritional goals or focus areas (e.g. high protein, low carb) |
| `skillLevel` | Cooking skill level of the user |
| `budgetRange` | Grocery budget tier |
| `chefPersona` | Personality style of the AI chef assistant |
| `replyLength` | Preferred verbosity of AI responses |
| `emojiUsage` | How often the AI should use emoji |
| `autoImproveChef` | Whether the AI should adapt based on past interactions |
| `contextAwareness` | Whether the AI uses prior conversation context |
| `seasonalAwareness` | Whether the AI considers seasonal ingredient availability |
| `seasonalRegion` | Geographic region used for seasonal awareness |
| `proactiveTips` | Whether the AI should offer unsolicited tips and suggestions |
| `autoGenerateGrocery` | Whether to automatically generate a grocery list from meal plans |
| `consolidateIngredients` | Whether to merge duplicate ingredients across meals in a grocery list |
| `defaultPlanLength` | Default number of days for a generated meal plan |
| `groceryGrouping` | How grocery list items are grouped (by category, meal, or alphabetically) |
| `saveChatHistory` | Whether chat history is persisted between sessions |

---

## Detailed Reference

### Environment Variables

#### `DATABASE_URL`
- **Implemented:** Yes
- **Default:** `file:./src/core/prisma/copilot-chef.db`
- **Affects:** Prisma client configuration; all database reads and writes

#### `NEXT_PUBLIC_APP_NAME`
- **Implemented:** Yes
- **Default:** `"Copilot Chef"`
- **Affects:** `src/web/src/app/layout.tsx` — page title and metadata

#### `COPILOT_MODEL`
- **Implemented:** Yes
- **Default:** `gpt-4o-mini`
- **Affects:** `src/web/src/app/api/chat/route.ts` — model used for all AI completions

#### `NEXT_PUBLIC_PERSONA_ENABLED`
- **Implemented:** Yes (feature flag)
- **Default:** `"false"`
- **Affects:** `src/web/src/app/settings/page.tsx` — controls whether the chef persona selector is interactive or shown with a "Coming soon" badge. Persona values persist and inject into the system prompt regardless of this flag.

---

### User Preferences

All preferences are stored in the `UserPreference` Prisma model (`src/core/prisma/schema.prisma`) and managed by `src/core/src/services/preference-service.ts`. They are exposed via the `/api/preferences` route and rendered in `src/web/src/app/settings/page.tsx`.

#### `householdSize`
- **Implemented:** Yes
- **Default:** `2`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Household card, range slider 1–8), system prompt context

#### `cookingLength`
- **Implemented:** Yes
- **Default:** `"weeknight"`
- **Options:** `quick`, `weeknight`, `relaxed`, `weekend`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Household card, select dropdown), system prompt context

#### `dietaryTags`
- **Implemented:** Yes
- **Default:** `""` (empty)
- **Format:** Comma-separated string (e.g. `"vegan,gluten-free"`)
- **Options:** Pescatarian, Vegetarian, Vegan, Omnivore, Keto, Paleo, Gluten-free, Dairy-free, Halal, Kosher
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Dietary Direction card, tag cloud), system prompt context

#### `favoriteCuisines`
- **Implemented:** Yes
- **Default:** `""` (empty)
- **Format:** Comma-separated string
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Cuisines card, tag cloud — mutually exclusive with `avoidCuisines`), system prompt context

#### `avoidCuisines`
- **Implemented:** Yes
- **Default:** `""` (empty)
- **Format:** Comma-separated string
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Cuisines card, tag cloud — mutually exclusive with `favoriteCuisines`), system prompt context

#### `avoidIngredients`
- **Implemented:** Yes
- **Default:** `"[]"`
- **Format:** JSON array of strings
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Avoid & Pantry card, draggable chip list), system prompt context

#### `pantryStaples`
- **Implemented:** Yes
- **Default:** `"[]"`
- **Format:** JSON array of strings
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Avoid & Pantry card, draggable chip list), system prompt context

#### `planningNotes`
- **Implemented:** Yes
- **Default:** `""` (empty)
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Planning Notes card, textarea with 600ms debounce), system prompt context

#### `nutritionTags`
- **Implemented:** Yes
- **Default:** `""` (empty)
- **Format:** Comma-separated string
- **Options:** Balanced, High protein, Low carb, Low sodium, Low calorie, Anti-inflammatory, Gut health, Heart-healthy
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Nutrition Focus card, tag cloud), system prompt context

#### `skillLevel`
- **Implemented:** Yes
- **Default:** `"home-cook"`
- **Options:** `beginner`, `home-cook`, `confident`, `advanced`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Skill & Budget card, select dropdown), system prompt context

#### `budgetRange`
- **Implemented:** Yes
- **Default:** `"moderate"`
- **Options:** `budget`, `moderate`, `premium`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Skill & Budget card, select dropdown), system prompt context

#### `chefPersona`
- **Implemented:** Yes (UI gated by `NEXT_PUBLIC_PERSONA_ENABLED`)
- **Default:** `"coach"`
- **Options:** `coach`, `scientist`, `entertainer`, `minimalist`, `professor`, `michelin`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Chef Personality card, persona grid), `src/core/src/copilot/system-prompt.ts` (maps to persona instruction injected at prompt start)

#### `replyLength`
- **Implemented:** Yes
- **Default:** `"balanced"`
- **Options:** `concise`, `balanced`, `detailed`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Response Style card, segmented control), `src/core/src/copilot/system-prompt.ts` (injects length instruction)

#### `emojiUsage`
- **Implemented:** Yes
- **Default:** `"occasional"`
- **Options:** `none`, `occasional`, `frequent`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Response Style card, segmented control), `src/core/src/copilot/system-prompt.ts` (injects emoji instruction)

#### `autoImproveChef`
- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (AI Behavior card, toggle switch), system prompt context

#### `contextAwareness`
- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (AI Behavior card, toggle switch), system prompt context

#### `seasonalAwareness`
- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (AI Behavior card, toggle switch), system prompt context. When enabled, reveals the `seasonalRegion` selector.

#### `seasonalRegion`
- **Implemented:** Yes
- **Default:** `"eastern-us"`
- **Options:** Northern US / Canada, Eastern US, Southern US, Western US / Pacific, Western Europe, Mediterranean, East Asia, South Asia, Australia / NZ, Southern hemisphere
- **Affects:** `preference-service.ts`, `settings/page.tsx` (AI Behavior card, conditional select dropdown), `src/web/src/app/api/preferences/detect-region/route.ts` (auto-detect endpoint), system prompt context

#### `proactiveTips`
- **Implemented:** Yes
- **Default:** `false`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (AI Behavior card, toggle switch), system prompt context

#### `autoGenerateGrocery`
- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Grocery & Planning card, toggle switch), system prompt context

#### `consolidateIngredients`
- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Grocery & Planning card, toggle switch), system prompt context

#### `defaultPlanLength`
- **Implemented:** Yes
- **Default:** `"7"`
- **Options:** `"3"`, `"7"`, `"14"`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Grocery & Planning card, select dropdown), system prompt context

#### `groceryGrouping`
- **Implemented:** Yes
- **Default:** `"category"`
- **Options:** `category`, `meal`, `alpha`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Grocery & Planning card, select dropdown), system prompt context

#### `saveChatHistory`
- **Implemented:** Yes
- **Default:** `true`
- **Affects:** `preference-service.ts`, `settings/page.tsx` (Data & Privacy card, toggle switch), `src/core/src/services/chat-history-service.ts`
