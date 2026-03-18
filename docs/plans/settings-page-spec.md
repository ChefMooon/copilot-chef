# Settings Page — Implementation Spec

> **Purpose:** This document is a complete implementation guide for the Copilot Chef Settings page (`/settings`). It covers data model changes, service layer updates, the API route, and every UI component and interaction in the finalized design. A working interactive prototype was used to validate all design decisions before this spec was written — implement exactly as described.

---

## 1. Overview

The Settings page replaces the current placeholder at `src/web/app/settings/page.tsx`. It is a full-page preferences editor organized into four collapsible sections. All changes save automatically — there is no explicit save button. A persistent autosave pill in the page header reflects save state.

The page is accessible via the ⚙️ icon in the app header, consistent with the existing navigation pattern.

---

## 2. Data Model Changes (`src/core`)

The existing `UserPreference` Prisma model must be extended. Replace or migrate the current model to match the following schema:

```prisma
model UserPreference {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Household
  householdSize       Int     @default(2)
  cookingLength       String  @default("weeknight")  // "quick" | "weeknight" | "relaxed" | "weekend"

  // Dietary direction — stored as comma-separated string values
  dietaryTags         String  @default("")  // e.g. "pescatarian,gluten-free"

  // Cuisines
  favoriteCuisines    String  @default("")  // e.g. "mediterranean,japanese"
  avoidCuisines       String  @default("")  // e.g. "indian,thai"

  // Avoid ingredients — ordered JSON array of strings
  avoidIngredients    String  @default("[]")

  // Pantry staples — ordered JSON array of strings
  pantryStaples       String  @default("[]")

  // Planning notes
  planningNotes       String  @default("")

  // Nutrition & goals
  nutritionTags       String  @default("")  // e.g. "high-protein,gut-health"
  skillLevel          String  @default("home-cook")  // "beginner" | "home-cook" | "confident" | "advanced"
  budgetRange         String  @default("moderate")   // "budget" | "moderate" | "premium"

  // Chef personality (future — store value now, UI gated by "Coming soon")
  chefPersona         String  @default("coach")
  // "coach" | "scientist" | "entertainer" | "minimalist" | "professor" | "michelin"

  // Response style
  replyLength         String  @default("balanced")   // "concise" | "balanced" | "detailed"
  emojiUsage          String  @default("occasional")  // "occasional" | "frequent" | "none"

  // App settings — AI behavior
  autoImproveChef     Boolean @default(true)
  contextAwareness    Boolean @default(true)
  seasonalAwareness   Boolean @default(true)
  seasonalRegion      String  @default("eastern-us")
  proactiveTips       Boolean @default(false)

  // App settings — Grocery & planning
  autoGenerateGrocery Boolean @default(true)
  consolidateIngredients Boolean @default(true)
  defaultPlanLength   String  @default("7")   // "3" | "7" | "14"
  groceryGrouping     String  @default("category")  // "category" | "meal" | "alpha"

  // App settings — Data & privacy
  saveChatHistory     Boolean @default(true)
}
```

Run `npm run db:push` after updating the schema to apply it to the local SQLite database. Update the seed file in `src/core/prisma/seed.ts` to include representative values for all new fields.

---

## 3. Service Layer (`src/core/services/PreferenceService.ts`)

Update `PreferenceService` to handle the full model. The service must expose:

```ts
// Read the single preference record (create with defaults if none exists)
getPreferences(): Promise<UserPreference>

// Partial update — accepts any subset of fields
updatePreferences(data: Partial<UserPreference>): Promise<UserPreference>

// Helpers for ordered JSON array fields
addToList(field: 'avoidIngredients' | 'pantryStaples', value: string): Promise<UserPreference>
removeFromList(field: 'avoidIngredients' | 'pantryStaples', value: string): Promise<UserPreference>
reorderList(field: 'avoidIngredients' | 'pantryStaples', orderedValues: string[]): Promise<UserPreference>
```

The ordered list helpers (`addToList`, `removeFromList`, `reorderList`) parse the JSON string, mutate the array, and write it back atomically.

---

## 4. AI Context Injection

The `CopilotChef` class in `src/core/CopilotChef.ts` injects user preferences into the system prompt on every chat session. Update this injection to include all new preference fields.

The injected context block should produce a natural-language summary like:

```
Household: 3 people.
Dietary direction: Pescatarian, gluten-free.
Favorite cuisines: Mediterranean, Japanese, Comfort food.
Avoid cuisines: Indian.
Avoid ingredients: Peanuts, tree nuts.
Pantry staples (skip from grocery lists): Olive oil, garlic, salt & pepper.
Planning notes: Prefers one-pan dinners on weeknights and a baking project on weekends.
Nutrition focus: High protein, gut health.
Skill level: Home cook. Budget: Moderate.
Response style: Balanced length, occasional emoji.
Chef persona: The Coach — encouraging, practical, and clear.
Seasonal awareness: Enabled (Eastern US).
Proactive tips: Off.
```

The persona field should influence the tone instruction in the system prompt even while the persona selector UI is marked "Coming soon". The default persona is `coach`.

The `replyLength` and `emojiUsage` fields must directly influence the response format instruction appended to the system prompt:

- `concise` → "Keep responses brief — 1–3 sentences unless detail is explicitly needed."
- `balanced` → "Aim for clear, well-structured responses of moderate length."
- `detailed` → "Be thorough — explain reasoning, include tips, and use structured formatting where helpful."
- `none` emoji → "Do not use emoji in any response."
- `frequent` emoji → "Use emoji freely throughout your responses."
- `occasional` emoji → "Use emoji sparingly — only where they add warmth or clarity."

---

## 5. API Route (`src/web/app/api/preferences/route.ts`)

The existing `/api/preferences` route handles GET and PATCH. Verify it supports partial updates for all new fields. No new endpoints are required.

Add a new sub-route for region auto-detection:

```
GET /api/preferences/detect-region
```

This endpoint uses the `X-Forwarded-For` or `CF-Connecting-IP` header (or falls back to `req.ip`) to perform a lightweight IP geolocation lookup. Map the result to one of the region enum values and return:

```json
{ "region": "eastern-us", "label": "Eastern US" }
```

If geolocation fails or is unavailable, return:

```json
{ "region": null, "error": "Could not detect region" }
```

Use a free IP geolocation API (e.g., `https://ipapi.co/{ip}/json/`) or a local GeoIP database. Do not block the response — detect, map, and return within 2 seconds or return the error object.

---

## 6. Page Component (`src/web/app/settings/page.tsx`)

Replace the placeholder with a full client component (`"use client"`). Use React Query (`useQuery` / `useMutation`) to load and patch preferences.

### Autosave behavior

- Every user interaction immediately calls the PATCH mutation with the changed field(s).
- Debounce text inputs and the range slider by 600ms before firing the mutation.
- Toggle switches, tag selections, chip additions/removals, and reorders fire immediately (no debounce).
- Display an autosave pill in the top-right of the page header showing one of three states:

| State        | Text                | Style                      |
| ------------ | ------------------- | -------------------------- |
| Idle / saved | "All changes saved" | Green text, green border   |
| Pending save | "Saving…"           | Muted text, default border |
| Error        | "Failed to save"    | Red text, red border       |

---

## 7. Layout Structure

```
<SettingsPage>
  <PageHeader>               ← title, subtitle, autosave pill
  <CollapsibleSection id="dietary">
    <HouseholdCard />
    <DietaryDirectionCard />
    <CuisinesCard />
    <AvoidAndPantryCard />   ← two-column layout, one card
    <PlanningNotesCard />
  </CollapsibleSection>
  <CollapsibleSection id="nutrition">
    <NutritionFocusCard />
    <SkillAndBudgetCard />
  </CollapsibleSection>
  <CollapsibleSection id="chef">
    <ChefPersonaCard />
    <ResponseStyleCard />
  </CollapsibleSection>
  <CollapsibleSection id="app">
    <AIBehaviorCard />
    <GroceryPlanningCard />
    <DataPrivacyCard />
  </CollapsibleSection>
</SettingsPage>
```

---

## 8. `CollapsibleSection` Component

Create `src/web/components/settings/CollapsibleSection.tsx`.

Props:

```ts
{
  id: string
  label: string
  defaultOpen?: boolean  // defaults to true
  children: React.ReactNode
}
```

Behavior:

- The section header is a full-width clickable row containing a chevron SVG, the uppercase label, and an extending horizontal rule line.
- Clicking toggles open/closed state, persisted in `localStorage` keyed as `settings-section-{id}` so sections remember their collapsed state across page visits.
- The chevron rotates 90° when closed (pointing right) and returns to pointing down when open.
- The content area animates using a CSS max-height transition (`max-height: 0 → max-height: 2000px`, `opacity: 0 → 1`, duration 280ms ease). Do not use JS-measured heights — the generous max-height ceiling is intentional for simplicity.
- The section header label and chevron use `--color-text-secondary`; they darken to `--color-text-primary` on hover.

---

## 9. Section: Dietary Profile

### 9.1 Household Card

Two-column grid.

**Left — Household size:**

- Label: "Household size"
- `<input type="range" min={1} max={8} step={1} />`
- Display the current value as a number to the right of the slider.
- The slider and value display must be vertically centered relative to each other, and vertically aligned with the select on the right.

**Right — Preferred cooking length:**

- Label: "Preferred cooking length"
- `<select>` with options:

| Value       | Label                        |
| ----------- | ---------------------------- |
| `quick`     | Quick (< 20 min)             |
| `weeknight` | Weeknight-friendly (~30 min) |
| `relaxed`   | Relaxed (45–60 min)          |
| `weekend`   | Weekend projects (1 hr+)     |

---

### 9.2 Dietary Direction Card

Tag cloud. Each tag is a pill button. Active tags use the brand green (`#2c4a1e` bg, white text). Multiple tags can be active simultaneously.

Tags (values in parentheses):
`Pescatarian` (`pescatarian`), `Vegetarian` (`vegetarian`), `Vegan` (`vegan`), `Omnivore` (`omnivore`), `Keto` (`keto`), `Paleo` (`paleo`), `Gluten-free` (`gluten-free`), `Dairy-free` (`dairy-free`), `Halal` (`halal`), `Kosher` (`kosher`)

---

### 9.3 Cuisines Card

Two equal columns separated by a 0.5px vertical divider line. Left column is "Favorites", right column is "Avoid".

Both columns render the same list of cuisine tags:
`Mediterranean`, `Japanese`, `Comfort food`, `Mexican`, `Thai`, `Indian`, `Italian`, `Korean`, `Middle Eastern`, `French`, `Chinese`, `American BBQ`

**Active styles:**

- Favorites: orange (`#b85c1a` bg, white text)
- Avoid: dark red (`#7a1c1c` bg, white text)

**Mutual exclusion logic (critical):**

- When a cuisine is activated in Favorites, it must be immediately deactivated in Avoid if it was active there.
- When a cuisine is activated in Avoid, it must be immediately deactivated in Favorites if it was active there.
- Clicking an already-active tag in either column deactivates it (toggle off). This does not affect the other column.
- The PATCH call must update both `favoriteCuisines` and `avoidCuisines` fields simultaneously to avoid a race condition.

---

### 9.4 Avoid & Pantry Card

Two-column grid. Each column is an independent chip list with its own text input.

**Shared chip list behavior (applies to both columns):**

Each column has:

1. A single-line text input with placeholder text and an "Add" button to its right.
2. Pressing Enter in the input is equivalent to clicking Add.
3. Comma-separated input is supported: entering "garlic, onion, salt" adds three separate chips.
4. Added chips appear at the bottom of the list.
5. Each chip displays: a drag handle (⠿), a label, and an × remove button.
6. Clicking × removes the chip immediately and fires a PATCH.
7. Chips are draggable. Drag-and-drop reordering is supported within each list using the HTML5 Drag and Drop API.
   - `dragstart`: set `dragSrc`, add `.dragging` class (reduces opacity).
   - `dragover`: add `.drag-over` class (green border highlight).
   - `dragleave` / `dragend`: remove highlight classes.
   - `drop`: reinsert the dragged chip before or after the target based on relative index, then fire `reorderList` PATCH.
8. The cursor is `grab` on the handle, `grabbing` while dragging.

**Left — Avoid ingredients:**

- Card title: "Avoid ingredients"
- Card description: "Allergies or hard avoidances. Drag to reprioritize."
- Input placeholder: "e.g. peanuts, shellfish"
- Seeded values: `["Peanuts", "Tree nuts"]`

**Right — Pantry staples:**

- Card title: "Pantry staples"
- Card description: "Always in stock — skip from grocery lists. Drag to reorder."
- Input placeholder: "e.g. olive oil, garlic"
- Seeded values: `["Olive oil", "Garlic", "Salt & pepper"]`

---

### 9.5 Planning Notes Card

- Full-width `<textarea>` (no grid wrapper).
- Label: none (card title acts as label).
- Card description: "Free-form context the AI uses when generating plans."
- Min height: 72px, vertically resizable.
- Debounced PATCH on input (600ms).

---

## 10. Section: Nutrition & Goals

### 10.1 Nutrition Focus Card

Tag cloud, same interaction pattern as Dietary Direction. Multiple tags can be active simultaneously. Active style: brand green.

Tags: `Balanced`, `High protein`, `Low carb`, `Low sodium`, `Low calorie`, `Anti-inflammatory`, `Gut health`, `Heart-healthy`

---

### 10.2 Skill & Budget Card

Two-column grid, both selects.

**Left — Cooking skill level:**

| Value       | Label          |
| ----------- | -------------- |
| `beginner`  | Beginner       |
| `home-cook` | Home cook      |
| `confident` | Confident cook |
| `advanced`  | Advanced       |

**Right — Budget range:**

| Value      | Label           |
| ---------- | --------------- |
| `budget`   | Budget-friendly |
| `moderate` | Moderate        |
| `premium`  | Premium ok      |

---

## 11. Section: Your Chef

### 11.1 Chef Personality Card

- Card title: "Chef personality" with a "Coming soon" badge rendered inline after the title text.
  - Badge style: small pill, warm amber background (`#faeeda`), dark amber text (`#633806`).
- Card description: "Choose how your AI chef talks to you."
- The persona grid is rendered and visually interactive (selection works) but a `pointer-events: none` overlay or `disabled` prop must be applied when the feature is inactive. Alternatively, wrap selection in a check: if the feature flag `NEXT_PUBLIC_PERSONA_ENABLED` is not `"true"`, clicking a persona card shows a shadcn `Toast` with the message "Chef personalities are coming soon."
- Despite the UI gate, the selected `chefPersona` value **is** persisted and injected into the AI system prompt. The default `coach` persona is active from day one.

**Persona grid — 3 columns, 2 rows:**

| Value         | Icon | Name            | Subtitle                |
| ------------- | ---- | --------------- | ----------------------- |
| `coach`       | 🧑‍🍳   | The Coach       | Encouraging, practical  |
| `scientist`   | 👨‍🔬   | The Scientist   | Precise, data-driven    |
| `entertainer` | 🎭   | The Entertainer | Witty, energetic        |
| `minimalist`  | 🧘   | The Minimalist  | Terse, efficient        |
| `professor`   | 📚   | The Professor   | Thoughtful, educational |
| `michelin`    | ⭐   | The Michelin    | Refined, high standards |

Selected persona card: `border: 1.5px solid #2c4a1e`, light green tinted background. Only one can be selected at a time.

Each persona maps to a system prompt tone instruction. See section 4 for the injection spec. The tone instructions per persona are:

| Persona       | System prompt tone instruction                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `coach`       | "You are an encouraging, practical cooking coach. Be warm, motivating, and clear. Use plain language."                 |
| `scientist`   | "You are a precise, analytical cooking guide. Reference technique, chemistry, and data where relevant. Be methodical." |
| `entertainer` | "You are an energetic, witty kitchen entertainer. Be playful, enthusiastic, and fun while still being helpful."        |
| `minimalist`  | "You are a terse, efficient kitchen assistant. Be direct. No preamble, no filler. Say exactly what is needed."         |
| `professor`   | "You are a thoughtful, educational culinary guide. Explain the 'why' behind techniques and choices. Be measured."      |
| `michelin`    | "You are a refined, exacting chef with high standards. Be elegant, precise, and sophisticated in all suggestions."     |

---

### 11.2 Response Style Card

Two-column grid. Both use a segmented button group (not a `<select>`).

**Left — Default reply length** (`replyLength`):
Three options rendered as a horizontal set of bordered pill buttons. Only one active at a time.
Options: `Concise` / `Balanced` / `Detailed`

**Right — Use of emoji in responses** (`emojiUsage`):
Same interaction pattern.
Options: `Occasional` / `Frequent` / `None`

Active style for both: green border (`#2c4a1e`), green text, light green tinted background. Inactive: default border, muted text.

---

## 12. Section: App Settings

### 12.1 AI Behavior Card

A stacked list of toggle rows. Each row: label + description on the left, a toggle switch on the right.

| Field               | Label                     | Description                                                       | Default |
| ------------------- | ------------------------- | ----------------------------------------------------------------- | ------- |
| `autoImproveChef`   | Auto-improve chef         | Chef learns from your feedback and adjusts suggestions over time. | On      |
| `contextAwareness`  | Context-aware suggestions | Include current meal schedule and pantry when generating ideas.   | On      |
| `seasonalAwareness` | Seasonal awareness        | Prioritize ingredients that are in season in your region.         | On      |
| `proactiveTips`     | Proactive tips            | Chef offers unprompted suggestions and cooking tips in chat.      | Off     |

**Seasonal awareness toggle — region sub-field:**

When `seasonalAwareness` is `true`, a region selector appears inline below the toggle description with a smooth expand animation (max-height transition, 200ms ease). When toggled off, the region selector collapses.

The region row contains:

1. A `<select>` with these options:

| Value                 | Label                |
| --------------------- | -------------------- |
| `northern-us-canada`  | Northern US / Canada |
| `eastern-us`          | Eastern US           |
| `southern-us`         | Southern US          |
| `western-us`          | Western US / Pacific |
| `western-europe`      | Western Europe       |
| `mediterranean`       | Mediterranean        |
| `east-asia`           | East Asia            |
| `south-asia`          | South Asia           |
| `australia-nz`        | Australia / NZ       |
| `southern-hemisphere` | Southern hemisphere  |

2. A "Detect" button to the right of the select.

**Detect button behavior:**

- On click: button text changes to "Detecting…", button is disabled.
- Calls `GET /api/preferences/detect-region`.
- On success: set the select value to the returned region, save via PATCH, button text briefly shows "Detected ✓" for 1.4 seconds, then resets to "Detect" and re-enables.
- On error: button resets to "Detect", show a shadcn `Toast` with message "Could not detect region automatically."

---

### 12.2 Grocery & Planning Card

Toggle rows followed by two selects in a grid.

**Toggles:**

| Field                    | Label                           | Description                                                        | Default |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------ | ------- |
| `autoGenerateGrocery`    | Auto-generate grocery list      | Automatically create a grocery list when a weekly schedule is set. | On      |
| `consolidateIngredients` | Consolidate similar ingredients | Merge quantities of the same ingredient across multiple meals.     | On      |

**Selects (two-column grid, rendered below the toggle rows with `margin-top: 1rem`):**

Left — Default plan length (`defaultPlanLength`): `3 days` / `7 days (week)` / `14 days`

Right — Grocery list grouping (`groceryGrouping`): `By category` / `By meal` / `Alphabetical`

---

### 12.3 Data & Privacy Card

**Toggle row:**

| Field             | Label             | Description                                        | Default |
| ----------------- | ----------------- | -------------------------------------------------- | ------- |
| `saveChatHistory` | Save chat history | Persist conversations for context across sessions. | On      |

**Destructive action buttons** (rendered below the toggle, `margin-top: 1rem`, in a flex row with `gap: 0.5rem`):

1. **Clear chat history** — danger style (red border, red text). On click: open a shadcn `AlertDialog` with title "Clear chat history?" and description "This will permanently delete all saved conversations. This cannot be undone." Confirm button: "Clear history" (red). Cancel button: "Cancel". On confirm: call `DELETE /api/chat/history`.

2. **Export my data** — default style. On click: call `GET /api/preferences/export` which returns a JSON file download containing all preference fields and meal log data.

3. **Reset all preferences** — default style. On click: open a shadcn `AlertDialog` with title "Reset all preferences?" and description "This will restore all settings to their defaults. Your meals and grocery lists will not be affected." On confirm: call `POST /api/preferences/reset`, then reload preferences via React Query `invalidateQueries`.

> **Note:** `DELETE /api/chat/history` and `GET /api/preferences/export` and `POST /api/preferences/reset` are new API routes that must be implemented alongside this feature.

---

## 13. Toggle Switch Component

Create `src/web/components/settings/ToggleSwitch.tsx` if one does not already exist.

Props:

```ts
{
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}
```

Styles:

- Track: 36px × 20px, border-radius 999px, no border.
- Track color: `#2c4a1e` when on, `var(--color-border-secondary)` when off.
- Thumb: 16px × 16px white circle, positioned `top: 2px`. Left: `18px` when on, `2px` when off.
- Transition: `background 0.15s`, `left 0.15s`.
- The entire button must be accessible: `role="switch"`, `aria-checked={checked}`.

---

## 14. Styling Notes

Follow the project's established styling decision guide:

- Section dividers, card shells, toggle rows, chip lists → custom CSS module (`settings.module.css`)
- Tag clouds, segmented button groups → custom CSS
- Selects, textareas, range inputs → shadcn/ui primitives restyled with CSS variable overrides to match the design system
- `AlertDialog`, `Toast` → shadcn/ui components, no restyling needed beyond what's already configured globally
- Animations (section collapse, region field expand, chip drag states) → CSS transitions only, no JS animation libraries

**Color constants used in this page** (add to Tailwind config or CSS variables if not already present):

```css
--chef-green: #2c4a1e;
--chef-orange: #b85c1a;
--chef-avoid-red: #7a1c1c;
--chef-badge-bg: #faeeda;
--chef-badge-text: #633806;
```

---

## 15. Responsive Behavior

The Settings page must be fully usable at all breakpoints defined in the project style guide. Specific rules:

- At `≤ 768px`: the two-column form grids (Household, Avoid & Pantry, Skill & Budget, Grocery selects) collapse to a single column.
- At `≤ 768px`: the Cuisines card's two-column layout (Favorites / Avoid) stacks vertically. The vertical divider is replaced by a horizontal rule. "Favorites" renders above "Avoid".
- At `≤ 600px`: the persona grid collapses from 3 columns to 2 columns.
- At `≤ 480px`: the persona grid collapses to 1 column.
- The autosave pill and page title remain in the header at all breakpoints; at `≤ 480px` the pill moves below the subtitle (stacked layout).

---

## 16. File Checklist

| File                                                 | Action                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `src/core/prisma/schema.prisma`                      | Update `UserPreference` model                                |
| `src/core/prisma/seed.ts`                            | Update seed data with all new fields                         |
| `src/core/services/PreferenceService.ts`             | Add new fields, `addToList`, `removeFromList`, `reorderList` |
| `src/core/CopilotChef.ts`                            | Update system prompt context injection                       |
| `src/web/app/api/preferences/route.ts`               | Verify supports all new fields in GET/PATCH                  |
| `src/web/app/api/preferences/detect-region/route.ts` | **New** — IP geolocation endpoint                            |
| `src/web/app/api/preferences/export/route.ts`        | **New** — JSON data export endpoint                          |
| `src/web/app/api/preferences/reset/route.ts`         | **New** — Reset to defaults endpoint                         |
| `src/web/app/api/chat/history/route.ts`              | **New** — DELETE chat history endpoint                       |
| `src/web/app/settings/page.tsx`                      | Replace placeholder with full page                           |
| `src/web/components/settings/CollapsibleSection.tsx` | **New**                                                      |
| `src/web/components/settings/ToggleSwitch.tsx`       | **New** (or verify existing)                                 |
| `src/web/components/settings/ChipList.tsx`           | **New**                                                      |
| `src/web/components/settings/TagCloud.tsx`           | **New**                                                      |
| `src/web/components/settings/SegmentedControl.tsx`   | **New**                                                      |
| `src/web/components/settings/PersonaGrid.tsx`        | **New**                                                      |
| `src/web/styles/settings.module.css`                 | **New** — custom CSS for page layout                         |

---

## 17. Out of Scope for This Spec

The following items are explicitly deferred:

- The chef persona feature is UI-scaffolded but gated. The system prompt injection for `chefPersona` is in scope; the persona selector being fully interactive and unlocked is not.
- Telegram sync of preferences (Phase 3).
- TUI preferences screen (Phase 2).
- Nutritional goal tracking or macro summaries.
