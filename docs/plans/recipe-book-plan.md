# Recipe Book — Implementation Plan

> This document is a complete implementation guide for adding the Recipe Book feature to Copilot Chef. It is intended for an implementing agent and should be followed top to bottom. Do not begin a later step before completing the earlier ones.

---

## Overview

The Recipe Book is a persistent library of recipes stored in the local SQLite database. Users can add recipes manually, ingest them from a URL, or generate them via the AI chat. Recipes can be tagged, searched, scaled, linked to sub-recipes, assigned to meal plans, and pushed to a grocery list. The feature spans `core` (data models, services, normalization) and `web` (pages, API routes, components).

---

## Affected Packages

| Package | Changes |
|---|---|
| `src/core` | New Prisma models, `RecipeService`, `IngredientNormalizer`, updated `CopilotChef` context injection |
| `src/web` | New pages, API routes, and UI components |

---

## Step 1 — Data Models (Prisma)

Add the following models to `src/core/prisma/schema.prisma`. Run `npm run db:generate` and `npm run db:push` after completing the schema.

### `Recipe`

```prisma
model Recipe {
  id            String         @id @default(cuid())
  title         String
  description   String?
  servings      Int            @default(2)
  prepTime      Int?           // minutes
  cookTime      Int?           // minutes
  difficulty    String?        // "easy" | "medium" | "hard"
  instructions  String         // JSON array of step strings stored as text
  sourceUrl     String?
  sourceLabel   String?        // derived hostname e.g. "seriouseats.com"
  origin        String         @default("manual") // "manual" | "imported" | "ai_generated"
  rating        Int?           // 1–5
  cookNotes     String?
  lastMadeAt    DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  ingredients   RecipeIngredient[]
  tags          RecipeTag[]
  linkedFrom    RecipeLink[]   @relation("ParentRecipe")
  linkedTo      RecipeLink[]   @relation("SubRecipe")
}
```

### `RecipeIngredient`

```prisma
model RecipeIngredient {
  id        String  @id @default(cuid())
  recipeId  String
  name      String         // normalized: "garlic"
  quantity  Float?
  unit      String?        // normalized canonical unit: "tsp", "g", "cup"
  notes     String?        // "roughly chopped", "to taste", "(optional)"
  order     Int            @default(0)

  recipe    Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)
}
```

### `RecipeTag`

```prisma
model RecipeTag {
  id       String @id @default(cuid())
  recipeId String
  tag      String // e.g. "italian", "dinner", "vegan", "source:seriouseats.com"

  recipe   Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@unique([recipeId, tag])
}
```

### `RecipeLink`

```prisma
model RecipeLink {
  id          String @id @default(cuid())
  parentId    String
  subRecipeId String

  parent      Recipe @relation("ParentRecipe", fields: [parentId], references: [id], onDelete: Cascade)
  subRecipe   Recipe @relation("SubRecipe", fields: [subRecipeId], references: [id], onDelete: Restrict)

  @@unique([parentId, subRecipeId])
}
```

### Update `UserPreference`

Add the following fields to the existing `UserPreference` model:

```prisma
pantryStaples      String  @default("[]")      // JSON array of ingredient name strings
defaultRecipeView  String  @default("basic")   // "basic" | "detailed" | "cooking"
defaultUnitMode    String  @default("cup")     // "cup" | "grams"
```

`pantryStaples` is populated during onboarding (future feature). The field must exist now so the grocery integration can read from it. Default to an empty array — staple exclusion is a no-op until the user configures it.

`defaultRecipeView` and `defaultUnitMode` drive the initial state of the Recipe Detail page toggles.

---

## Step 2 — Ingredient Normalizer & Unit Converter (`core`)

Create `src/core/src/lib/ingredientNormalizer.ts` and `src/core/src/lib/unitConverter.ts`. Both live in `core` so that services (grocery list generation, Telegram formatting) and the web package can share the same logic. The web package imports them from `@copilot-chef/core`.

### Design decision — DB stores original units

Ingredient quantities are stored in the database exactly as the recipe specifies them (e.g. `2 cup`, `300 g`). There is no conversion to a canonical unit system at write time. This preserves the author's intent and avoids lossy conversions for unfamiliar ingredients.

Conversion to a display unit (cup or grams) happens at read time in `UnitConverter`. Normalization to a base unit for arithmetic (e.g. grocery list deduplication) happens transiently in service methods and is never persisted.

---

### `unitConverter.ts`

Create `src/core/src/lib/unitConverter.ts` before `ingredientNormalizer.ts` — the normalizer depends on the canonical unit list defined here.

#### Base units for arithmetic

All unit conversions for arithmetic use two base units:
- **Volume** → `ml`
- **Weight** → `g`

Count-based units (`clove`, `slice`, `piece`, `pinch`, `dash`) are never converted and are treated as their own base unit.

#### Volumetric conversion table (to ml)

```ts
const TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  'fl oz': 29.5735,
  cup: 236.588,
  pt: 473.176,
  qt: 946.353,
};
```

#### Weight conversion table (to g)

```ts
const TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};
```

#### Ingredient density table (g per cup)

Used for cross-domain conversion (volume ↔ weight). Keys are lowercase ingredient names; partial matching is used (e.g. `"flour"` matches `"all-purpose flour"`, `"bread flour"`).

Cover at minimum: flour (all-purpose), bread flour, sugar (white), brown sugar, powdered sugar, butter, olive oil, vegetable oil, milk, water, rolled oats, cocoa powder, salt, honey, rice (uncooked), cornstarch, baking soda, baking powder.

```ts
const DENSITY_G_PER_CUP: Record<string, number> = {
  // key: lowercase partial ingredient name
  'all-purpose flour': 125, 'bread flour': 120, 'whole wheat flour': 120,
  sugar: 200, 'brown sugar': 220, 'powdered sugar': 120, 'icing sugar': 120,
  butter: 227, 'olive oil': 216, 'vegetable oil': 218, 'coconut oil': 218,
  milk: 244, water: 237,
  'rolled oats': 90, 'oat': 90,
  'cocoa powder': 85, 'cacao powder': 85,
  salt: 273,
  honey: 340, 'maple syrup': 322,
  rice: 185,
  cornstarch: 128, 'corn starch': 128,
  'baking soda': 230, 'baking powder': 192,
};
```

#### Interface

```ts
export type UnitMode = "cup" | "grams";
export type UnitCategory = "volume" | "weight" | "count";

export interface ConvertedQuantity {
  quantity: number | null;
  unit: string | null;
  approximate: boolean; // true when density lookup was used for cross-domain conversion
}

/** Convert a quantity to the target display mode (cup or grams). */
export function convertIngredient(
  quantity: number | null,
  unit: string | null,
  ingredientName: string,
  targetMode: UnitMode
): ConvertedQuantity

/** Convert a quantity to its arithmetic base unit (ml or g) for summing.
 *  Returns null if conversion is not possible (e.g. count unit, unknown cross-domain). */
export function toBaseUnit(
  quantity: number | null,
  unit: string | null,
  ingredientName: string
): { quantity: number | null; unit: string | null; approximate: boolean }

/** Classify a canonical unit as "volume", "weight", or "count". */
export function getUnitCategory(unit: string | null): UnitCategory

/** Find the best human-readable volumetric unit for a given ml value.
 *  e.g. 14.8 ml → { quantity: 1, unit: "tbsp" } */
export function fromMl(ml: number): { quantity: number; unit: string }

/** Find the best human-readable weight unit for a given gram value.
 *  e.g. 453 g → { quantity: 1, unit: "lb" } — respects targetMode:
 *  "cup" mode returns oz/lb; "grams" mode returns g/kg */
export function fromGrams(g: number, targetMode: UnitMode): { quantity: number; unit: string }
```

#### Conversion rules for `convertIngredient`

- Count units → return unchanged, `approximate: false`
- Same category (volume→volume or weight→weight) → convert via base unit, then call `fromMl` / `fromGrams`, `approximate: false`
- Cross-domain (volume→weight or weight→volume):
  - Look up `ingredientName` in `DENSITY_G_PER_CUP` using case-insensitive partial matching
  - If found: convert, `approximate: true`
  - If not found: return original quantity and unit unchanged, `approximate: true`

Export `DENSITY_G_PER_CUP` and `TO_ML` and `TO_G` so `ingredientNormalizer.ts` can reference the same unit lists.

---

### Dependencies

```bash
npm install ingredient-parser-ts --workspace=core
```

> **Note:** If `ingredient-parser-ts` is unavailable or produces poor results after testing, an AI-assisted normalization fallback is planned (see Step 2.4). Do not implement the fallback now — only add it if rule-based normalization proves insufficient.

### 2.1 — Unit Synonym Map

Define a canonical unit map. All synonyms map to a single canonical string:

```ts
const UNIT_SYNONYMS: Record<string, string> = {
  // Volume
  tablespoon: 'tbsp', tablespoons: 'tbsp', T: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', t: 'tsp',
  cup: 'cup', cups: 'cup',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', ml: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l', l: 'l',
  'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'fl oz': 'fl oz',
  // Weight
  gram: 'g', grams: 'g', g: 'g',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  pound: 'lb', pounds: 'lb', lbs: 'lb', lb: 'lb',
  // Count
  clove: 'clove', cloves: 'clove',
  slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
  // Cooking measures
  quart: 'qt', quarts: 'qt', qt: 'qt',
  pint: 'pt', pints: 'pt', pt: 'pt',
};
```

### 2.2 — Notes Patterns

Strip these patterns from ingredient names and move them to the `notes` field:

- `(optional)`, `optional`
- `to taste`
- `roughly chopped`, `finely chopped`, `thinly sliced`, `diced`, `minced`, `grated`, `peeled`
- Anything in parentheses: `(.*)`

### 2.3 — Normalizer Interface

```ts
export interface NormalizedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  confidence: 'high' | 'low'; // low = flagged for user review
}

export function normalizeIngredient(raw: string): NormalizedIngredient
export function normalizeIngredients(raws: string[]): NormalizedIngredient[]
```

Confidence is `'low'` when:
- Quantity cannot be parsed as a number (e.g. "a handful of")
- Unit string is not found in the synonym map after parsing
- Name is empty after stripping notes

### 2.4 — AI Fallback (Future — Do Not Implement Now)

If rule-based normalization proves insufficient after testing, an AI normalization pass can be added as an optional step. The plan would be:

- After rule-based normalization, collect all ingredients with `confidence: 'low'`
- Send them in a single batch to the Copilot SDK with a structured output prompt
- Merge AI-normalized results back into the ingredient list before the review step
- Expose this as an opt-in toggle in Settings: "Use AI to clean up imported ingredients"

---

## Step 3 — Recipe Service (`core`)

Create `src/core/src/services/RecipeService.ts`. Export all methods from `src/core/src/index.ts`.

### Methods

#### `createRecipe(data: CreateRecipeInput): Promise<Recipe>`
Creates a recipe with ingredients and tags. Runs `normalizeIngredients` on all ingredient strings before saving.

#### `updateRecipe(id: string, data: UpdateRecipeInput): Promise<Recipe>`
Updates recipe fields. Re-normalizes ingredients if the ingredient list is updated.

#### `deleteRecipe(id: string): Promise<void>`
Hard deletes. Cascades to ingredients, tags, and recipe links where the recipe is the parent. Throws if the recipe is referenced as a sub-recipe by another recipe — return a descriptive error listing the parent recipe titles.

#### `getRecipe(id: string): Promise<RecipeWithRelations>`
Returns a recipe with its ingredients, tags, and linked sub-recipes (one level deep — do not recurse).

#### `listRecipes(filters?: RecipeFilters): Promise<Recipe[]>`
Returns all recipes. Supports filtering by:
- `origin`: `"manual" | "imported" | "ai_generated"`
- `tags`: array of tag strings (AND match)
- `difficulty`: string
- `maxCookTime`: number (minutes)
- `rating`: minimum rating

#### `searchRecipes(query: string): Promise<Recipe[]>`
Full-text search across: `title`, `description`, `cookNotes`, ingredient `name` values, and tag `tag` values. Use SQLite `LIKE` for each field and union/deduplicate results. Return results ordered by relevance (title matches first, then ingredient/tag matches).

#### `ingestFromUrl(url: string): Promise<IngestResult>`
- Fetch the page using `defuddle` (already a dependency — confirm before adding)
- Extract recipe fields: title, description, ingredients (as raw strings), instructions, servings, times
- Run `normalizeIngredients` on the raw ingredient strings
- Derive `sourceLabel` from the URL hostname (strip `www.`): `new URL(url).hostname.replace(/^www\./, '')`
- Auto-apply a `source:<sourceLabel>` tag
- Check for duplicates: query for any existing recipe with the same `sourceUrl` OR a title that matches exactly (case-insensitive). If found, return `{ duplicate: true, existing: Recipe }` without saving
- If no duplicate, return `{ duplicate: false, recipe: DraftRecipe, flaggedIngredients: NormalizedIngredient[] }` — the draft is **not saved yet**. The caller (API route) presents the review step to the user before saving

#### `duplicateRecipe(id: string, overrides?: Partial<CreateRecipeInput>): Promise<Recipe>`
Creates a full copy of a recipe with:
- Title suffixed with `" (My Version)"`
- `origin` set to `"manual"`
- `sourceUrl` and `sourceLabel` cleared
- All ingredients, tags, and instructions copied

#### `getRolledUpIngredients(recipeId: string): Promise<RolledUpIngredient[]>`
Returns all ingredients for a recipe including ingredients from all linked sub-recipes. Used by grocery list generation.

**Deduplication with unit normalization:**
1. Collect all ingredients (main recipe + sub-recipes, flat list)
2. For each ingredient, call `toBaseUnit(quantity, unit, name)` to get an arithmetic base value (`ml` or `g`)
3. Group by `name` (case-insensitive) + `unitCategory` (`"volume"` | `"weight"` | `"count"`)
   - Within a group, sum the base-unit quantities
   - Track `approximate: true` on the group if any member conversion was approximate
4. Ingredients in different categories for the same name (e.g. one recipe uses `2 cups flour`, another `300 g flour`) are kept as **separate line items** — cross-category merging is not attempted. Flag these with `conversionConflict: true` on `RolledUpIngredient` so the UI can display a warning
5. Convert summed base values back to a human-readable unit using `fromMl` / `fromGrams` with `targetMode: "cup"` as the default output; callers can pass a `unitMode` override

```ts
export interface RolledUpIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  approximate: boolean;
  conversionConflict: boolean; // true when same ingredient appears in both volume and weight across recipes
}
```

#### `addToGroceryList(recipeIds: string[], groceryListId: string): Promise<void>`
Fetches rolled-up ingredients for all provided recipe IDs, deduplicates across recipes, excludes pantry staples (read from `UserPreference.pantryStaples`), and upserts into the target `GroceryList`. For existing items with the same name and unit, add quantities together.

#### `generateGroceryList(recipeIds: string[], name: string): Promise<GroceryList>`
Same as `addToGroceryList` but creates a new `GroceryList` first, then adds to it.

#### `updateRating(id: string, rating: number, cookNotes?: string): Promise<Recipe>`
Updates rating and cook notes. Also sets `lastMadeAt` to now.

#### `importRecipes(json: RecipeExportJson): Promise<ImportResult>`
Imports an array of recipes from JSON. For each recipe, run duplicate detection (by title, case-insensitive). Skip duplicates and report them in `ImportResult.skipped`.

#### `exportRecipes(ids?: string[]): Promise<RecipeExportJson>`
Exports all recipes (or a subset by ID array) as a JSON object matching the `RecipeExportJson` schema.

---

## Step 4 — Zod Schemas (`core`)

Add to `src/core/src/schemas/recipeSchemas.ts`:

- `CreateRecipeInputSchema` — validates manual creation input
- `UpdateRecipeInputSchema` — partial of create
- `IngestResultSchema` — union of duplicate result and draft result
- `RecipeExportJsonSchema` — full export format including version field for future migrations
- `AIRecipeSaveSchema` — schema for extracting a recipe from a chat message (used by `CopilotChef`)

---

## Step 5 — CopilotChef Integration (`core`)

Update `src/core/src/CopilotChef.ts`:

### 5.1 — Recipe Book Context Injection

When building the system prompt context for each chat message, include a brief recipe library summary:

```
User has {count} recipes saved. Recent recipes: {title1}, {title2}, {title3}.
```

This gives the AI awareness of what the user already has without flooding the context with full recipe data.

### 5.2 — "Save this recipe" Intent Detection

Add intent detection for recipe-saving phrases:
- "save this recipe", "add this to my recipe book", "save that", "keep this one"

When detected, attempt to extract a structured recipe from the conversation history using `AIRecipeSaveSchema`. If extraction succeeds, return it in the chat response as a structured `action: "save_recipe"` payload. The web chat handler will intercept this and call `RecipeService.createRecipe` with `origin: "ai_generated"`.

### 5.3 — Quick Prompt: "Open Recipe Book"

Add `"Open Recipe Book"` to the quick prompt list. This prompt navigates the user to `/recipes` and injects a greeting message from the AI summarizing the library.

---

## Step 6 — API Routes (`web`)

Add the following routes under `src/web/src/app/api/recipes/`.

| Route | Methods | Description |
|---|---|---|
| `/api/recipes` | `GET`, `POST` | List (with query params for filters/search), create |
| `/api/recipes/[id]` | `GET`, `PUT`, `DELETE` | Single recipe CRUD |
| `/api/recipes/[id]/duplicate` | `POST` | Duplicate and return draft |
| `/api/recipes/[id]/rating` | `PUT` | Update rating and cook notes |
| `/api/recipes/ingest` | `POST` | URL ingestion — returns draft or duplicate warning |
| `/api/recipes/ingest/confirm` | `POST` | Save a confirmed ingest draft |
| `/api/recipes/grocery` | `POST` | Add recipe ingredients to an existing grocery list |
| `/api/recipes/grocery/new` | `POST` | Generate a new grocery list from recipes |
| `/api/recipes/export` | `GET` | Export library as JSON (optional `?ids=` param) |
| `/api/recipes/import` | `POST` | Import from JSON file upload |

All routes validate inputs with the Zod schemas from Step 4. Return consistent error shapes: `{ error: string, code: string }`.

---

## Step 7 — Web Pages & Components (`web`)

### 7.1 — `/recipes` — Recipe Library Page

**Layout:** Sidebar filter panel + main recipe grid.

**Sidebar:**
- Search input (debounced, 300ms) — searches across title, ingredients, tags, instructions
- Filter groups (collapsible): Origin (Manual / Imported / AI Generated), Meal Type, Cuisine, Dietary Tags, Difficulty, Cook Time (slider or select), Minimum Rating, Website Source (lists all `source:*` tags present in the library)
- Active filters shown as dismissible chips above the grid

**Recipe Grid:**
- Card per recipe showing: title, source badge (`Manual` / `Imported` / `AI`), website source tag if applicable, difficulty, total time, rating stars, primary tags
- Clicking a card navigates to `/recipes/[id]`
- Bulk selection mode (checkbox on hover): enables multi-select for grocery list generation and export

**Toolbar:**
- "Add Recipe" button → opens Add Recipe modal
- "Import" button → file picker for JSON import
- "Export" button → exports selected recipes (or all if none selected)

### 7.2 — `/recipes/[id]` — Recipe Detail Page

**Header area:** Title, source badge, website source tag (linked to filter), rating stars (interactive), last made date.

**View mode selector:** Tabs or toggle — `Basic` / `Detailed` / `Cooking Mode` / `Print`.

**Servings scaler — always visible:**
- Displayed prominently below the header, above the ingredient list in all views (except Print)
- Number input with +/− stepper buttons
- All ingredient quantities update live as the value changes
- The base servings count (from the recipe model) is shown as a faint label beside the input: e.g. `Servings: [4] (base: 2)`
- In Cooking Mode, the scaler is accessible in the collapsible side panel

**Unit toggle — always visible alongside the servings scaler:**
- A segmented control or pill toggle: `Cup` / `Grams`
- Switches all ingredient quantities between volumetric units (`cup`, `tbsp`, `tsp`, `fl oz`) and metric weight units (`g`, `ml`)
- Conversions use a density lookup table for common ingredients (see `UnitConverter` below); ingredients without a known density fall back to displaying the original unit with a `~` prefix to signal the conversion is approximate
- The selected unit mode persists in local state for the session; the user's preferred default is stored in `UserPreference.defaultUnitMode` (`"cup"` | `"grams"`)

**Basic view:**
- Ingredient list at the top: normalized quantity + unit (respecting the active unit toggle) + name + notes
- Linked sub-recipes shown as collapsible sections with a jump link beneath the main ingredient list
- Step-by-step numbered instructions below the ingredients — plain text, no inline amounts

**Detailed view:**
- Same ingredient list at the top as Basic view
- Step-by-step instructions rendered with ingredient quantities injected inline in bold where they appear in the text (e.g. "Add **2 cups flour** and **1 tsp salt** to the bowl")
- Ingredient matching uses fuzzy string matching against ingredient names; unmatched steps render as plain text
- Inline amounts respect the active unit toggle

**Cooking Mode:**
- Full-screen overlay
- One step at a time, large readable text
- Previous / Next buttons
- Step counter (e.g. "Step 3 of 8")
- Ingredient quantities (respecting the active unit toggle) available in a collapsible side panel
- Servings scaler accessible in the side panel

**Print view:**
- Clean, minimal layout with no UI chrome
- Triggers `window.print()` — use a print CSS media query to hide navigation
- Prints using the currently active unit mode

**Action bar:**
- "Use in Meal Plan" — opens a day/slot picker from the current meal plan
- "Add to Grocery List" — opens a picker: "New list" or select existing
- "Send to Telegram" — one-click send using the user's default view style
- "Duplicate & Edit" — calls `/api/recipes/[id]/duplicate`, then navigates to edit mode for the new copy
- "Edit" — opens the edit form
- "Delete" — confirmation dialog before deleting; if the recipe is a sub-recipe, show which parent recipes reference it and block deletion

### 7.6 — Unit Converter (web usage)

`UnitConverter` is defined in `core` (see Step 2). The web package imports it directly from `@copilot-chef/core`:

```ts
import { convertIngredient, type UnitMode } from "@copilot-chef/core";
```

No separate web utility file is needed. The `UnitToggle` component calls `convertIngredient` per ingredient to re-render quantities when the toggle changes. The `~` approximate prefix is shown when `ConvertedQuantity.approximate === true` and the unit did not change (i.e. the conversion fell back to the original).

### 7.3 — Add / Edit Recipe Form

Used for both manual creation and the ingest review step. A single form component parameterized by initial values.

**Fields:**
- Title (text input, required)
- Description (textarea, optional)
- Servings (number input)
- Prep time / Cook time (number inputs, minutes)
- Difficulty (select: Easy / Medium / Hard)
- Ingredients (dynamic list): each row has Quantity (number) + Unit (text with autocomplete from canonical units) + Name (text) + Notes (text, optional) + drag handle for reordering + remove button. "Add ingredient" appends a new empty row.
- Instructions (dynamic list): each step is a textarea with drag handle and remove button. "Add step" appends a new empty row.
- Tags (tag input with autocomplete from existing tags in the library)
- Linked sub-recipes (multi-select from existing recipes in the library — excludes the recipe being edited)
- Source URL (read-only on imported recipes, hidden on manual/AI)

**Ingest review specifics:**
- Pre-populated from the Defuddle parse result
- Ingredients with `confidence: 'low'` are highlighted in amber with a tooltip: "Could not be parsed automatically — please review"
- Source URL shown as read-only with a link to the original page
- Auto-applied `source:*` tag shown and non-removable

### 7.4 — Ingest Modal

Triggered by "Import from URL" button on the library page.

1. URL input step — user pastes a URL and clicks "Import"
2. Loading state — show "Fetching recipe…" while Defuddle runs
3. If duplicate detected — show warning: "This recipe already exists in your library: [title]. Do you want to add a new version anyway?" with Cancel / Add Anyway buttons
4. If no duplicate — transition to the Add/Edit Recipe Form pre-populated with the parsed data (review step)
5. User edits if needed, then clicks "Save Recipe"

### 7.5 — Import / Export

**Export:** Clicking Export downloads a JSON file named `copilot-chef-recipes-{date}.json`. If recipes are bulk-selected, only those are exported. Otherwise all recipes are exported.

**Import:** Clicking Import opens a file picker. After selecting a JSON file, show a preview modal: "Found {n} recipes. {m} already exist and will be skipped." with a Cancel / Import button. On confirm, call `/api/recipes/import` and show a toast with the result summary.

---

## Step 8 — Navigation

Add "Recipes" to the main navigation in the Header component, between "Meal Plan" and "Grocery List". Use the same nav item pattern as existing links. Update the mobile nav drawer to include the same link.

---

## Step 9 — Settings Updates

Add a **Pantry Staples** section to the Settings page:

- Descriptive note: "Ingredients on this list are excluded when adding recipe ingredients to a grocery list. This list is populated during onboarding."
- Display the current staples as read-only chips (empty state: "No staples configured yet")
- Allow manual addition and removal of staples now, even though onboarding is a future feature
- Persist via `UserPreference.pantryStaples`

Add a **Default Recipe View** setting:
- Select input: Basic / Detailed / Cooking Mode
- Persisted to `UserPreference` (add a `defaultRecipeView` field to the Prisma model: `"basic" | "detailed" | "cooking"`)
- This setting is read by the Recipe Detail page to determine the initial active view tab

Add a **Default Unit Mode** setting:
- Select input: Cup Measurements / Grams
- Persisted to `UserPreference` (add a `defaultUnitMode` field: `"cup" | "grams"`)
- This setting is read by the Recipe Detail page to set the initial unit toggle state

---

## Step 10 — Telegram Integration

Update the Telegram bot handler (Phase 3, `cli` package or future `telegram` package) to handle a "send recipe" command:

- `/recipe [title or id]` — look up the recipe and format it using the user's `defaultRecipeView` and `defaultUnitMode` preferences
- Format the recipe as a Telegram message: title, servings, ingredient list, numbered steps
- In `"detailed"` view mode, inject ingredient amounts inline into each step (same logic as the Detailed web view)
- Apply unit conversion using `defaultUnitMode` when formatting ingredient quantities
- Keep formatting within Telegram's 4096 character limit — truncate instructions with a note if needed

This step is a stub. The formatting logic should live in `RecipeService.formatForTelegram(id, viewStyle, unitMode)` in `core` so it can be used by both Telegram and any future integrations.

---

## Step 11 — Seed Data

Add sample recipes to `src/core/prisma/seed.ts`:

- At least 3 manually created recipes covering different meal types and difficulties
- At least 1 recipe that references another as a sub-recipe (e.g. a pasta dish that links to a "Basic Tomato Sauce" recipe)
- Assign a mix of tags across the sample recipes
- Set `origin` appropriately on each

This ensures the Recipe Library page renders meaningfully on first run.

---

## Step 12 — Testing Checklist

Before marking this feature complete, verify the following:

**Normalization**
- [ ] Ingredient strings from 3 different recipe websites normalize correctly (quantity, unit, name split)
- [ ] Low-confidence ingredients are flagged in the review step
- [ ] Unit synonyms resolve to canonical forms (`tablespoon` → `tbsp`, `grams` → `g`)
- [ ] Notes are stripped from ingredient names correctly

**Ingestion**
- [ ] Defuddle successfully parses a recipe from at least 3 well-known recipe sites
- [ ] Duplicate URL detection fires correctly on a second ingest of the same URL
- [ ] Duplicate name detection fires on manual/import duplicate
- [ ] `source:*` tag is applied automatically and appears in filters
- [ ] Review step pre-populates all fields correctly

**Grocery Integration**
- [ ] Ingredients from linked sub-recipes roll up correctly
- [ ] Two recipes using the same ingredient in the same unit category (e.g. both in cups) deduplicate and sum correctly
- [ ] Two recipes using the same ingredient in different unit categories (one cups, one grams) produce separate line items and are flagged with `conversionConflict: true`
- [ ] Pantry staples are excluded when the staples list is non-empty
- [ ] Adding to an existing grocery list deduplicates and sums quantities
- [ ] Generating a new grocery list includes all selected recipes

**Search & Filter**
- [ ] Search returns results for matches in title, ingredients, tags, and instructions
- [ ] Filtering by `source:seriouseats.com` returns only ingested recipes from that site
- [ ] Filtering by origin type works correctly

**Views**
- [ ] Servings scaler is visible and prominent above the ingredient list in all views
- [ ] Servings scaler updates all ingredient quantities proportionally
- [ ] Basic view shows ingredients then plain step-by-step instructions
- [ ] Detailed view injects ingredient amounts inline in bold within each step
- [ ] Unit toggle switches all quantities between cup and gram measurements
- [ ] Ingredients without a density mapping show the original unit with a `~` approximate prefix rather than erroring
- [ ] Count-based units (clove, slice, piece) are unaffected by the unit toggle
- [ ] Unit toggle respects `defaultUnitMode` preference on initial load
- [ ] Cooking Mode advances through steps correctly
- [ ] Print view hides nav and UI chrome and uses the active unit mode

**Import / Export**
- [ ] Export produces valid JSON matching the schema
- [ ] Import round-trips: export then re-import produces identical recipes
- [ ] Duplicate detection fires during import

---

## File Reference Summary

```
src/core/src/
  lib/
    unitConverter.ts              ← New (density table, base-unit arithmetic, display conversion)
    ingredientNormalizer.ts       ← New (depends on unitConverter for canonical unit list)
  services/
    RecipeService.ts              ← New
  schemas/
    recipeSchemas.ts              ← New
  CopilotChef.ts                  ← Update (context injection, save intent)
  index.ts                        ← Update (export RecipeService)

src/core/prisma/
  schema.prisma                   ← Update (Recipe, RecipeIngredient, RecipeTag, RecipeLink, UserPreference)
  seed.ts                         ← Update (add sample recipes)

src/web/src/app/
  recipes/
    page.tsx                      ← New (library page)
    [id]/
      page.tsx                    ← New (detail page)
  api/recipes/
    route.ts                      ← New
    [id]/route.ts                 ← New
    [id]/duplicate/route.ts       ← New
    [id]/rating/route.ts          ← New
    ingest/route.ts               ← New
    ingest/confirm/route.ts       ← New
    grocery/route.ts              ← New
    grocery/new/route.ts          ← New
    export/route.ts               ← New
    import/route.ts               ← New

src/web/src/components/
  recipes/
    RecipeCard.tsx                ← New
    RecipeGrid.tsx                ← New
    RecipeForm.tsx                ← New
    RecipeDetail.tsx              ← New
    IngestModal.tsx               ← New
    CookingMode.tsx               ← New
    IngredientRow.tsx             ← New
    ServingsScaler.tsx            ← New (always-visible scaler + unit toggle)
    UnitToggle.tsx                ← New (cup/grams segmented control)
    SourceBadge.tsx               ← New
    RecipeFilterSidebar.tsx       ← New
  Header.tsx                      ← Update (add Recipes nav link)
  Settings.tsx                    ← Update (pantry staples, default view, default unit mode)
```

---

## Dependencies to Add

| Package | Workspace | Purpose |
|---|---|---|
| `ingredient-parser-ts` | `core` | Rule-based ingredient string parsing |
| `defuddle` | `core` | Recipe extraction from web pages (confirm if already present) |

No new `web` dependencies are required — all UI uses existing Tailwind, shadcn/ui, and React Query patterns already in the project.
