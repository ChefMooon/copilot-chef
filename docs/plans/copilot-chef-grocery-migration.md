# Grocery List Page — Migration Plan

> This document instructs an agent on how to convert the existing basic grocery list page into the fully designed prototype. The reference JSX file (`copilot-chef-grocery.jsx`) contains the complete, approved design and should be treated as the source of truth for all UI decisions.

---

## Overview

The existing page is a read-only checklist with a single hard-coded list. The new design replaces it entirely with a multi-list management system: a filterable quick reference carousel, an all-lists sidebar, an inline editor panel, a full-screen shopping view, and a new list creation modal. All list and item data is driven from real API endpoints.

---

## Reference Files

| File                          | Purpose                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `copilot-chef-grocery.jsx`    | Complete approved UI prototype — source of truth for all markup, styles, and interaction logic |
| `copilot-chef-style-guide.md` | Design system reference for colors, typography, and component patterns                         |
| `copilot-chef-plan.md`        | Overall project plan for architectural context                                                 |

---

## New Data Requirements

### Schema Changes

The following additions to `schema.prisma` are required before any UI work begins.

#### `GroceryList` model

Ensure these fields exist:

```prisma
model GroceryList {
  id         Int           @id @default(autoincrement())
  name       String
  date       DateTime      // the shopping date; defaults to createdAt
  favourite  Boolean       @default(false)
  items      GroceryItem[]
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
}
```

#### `GroceryItem` model

Ensure all fields from the prototype exist:

```prisma
model GroceryItem {
  id            Int          @id @default(autoincrement())
  name          String
  qty           String?      // stored as string to allow "1/2", "½", etc.
  unit          String?      // e.g. "g", "cups", "pcs"
  category      String       @default("Other")
  notes         String?      // brand preference, preparation notes
  meal          String?      // name of the linked meal (denormalised for simplicity)
  checked       Boolean      @default(false)
  sortOrder     Int          @default(0) // drives manual reordering
  groceryListId Int
  groceryList   GroceryList  @relation(fields: [groceryListId], references: [id], onDelete: Cascade)
}
```

Run `prisma migrate dev` after schema changes.

### API Endpoints Required

| Method   | Route                                  | Purpose                                                                                                    |
| -------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/grocery-lists`                   | Fetch all lists (with items included)                                                                      |
| `POST`   | `/api/grocery-lists`                   | Create a new list                                                                                          |
| `PATCH`  | `/api/grocery-lists/:id`               | Update list name, date, favourite                                                                           |
| `DELETE` | `/api/grocery-lists/:id`               | Delete a list and cascade-delete its items                                                                 |
| `POST`   | `/api/grocery-lists/:id/items`         | Add an item to a list                                                                                      |
| `PATCH`  | `/api/grocery-lists/:id/items/:itemId` | Update an item (any field)                                                                                 |
| `DELETE` | `/api/grocery-lists/:id/items/:itemId` | Remove an item                                                                                             |
| `POST`   | `/api/grocery-lists/:id/reorder`       | Update `sortOrder` for all items after a drag or arrow move — accepts `{ itemIds: number[] }` in new order |

---

## Constants & Utilities

Extract the following from the prototype into `web/lib/grocery.ts`:

```ts
export const CATEGORIES = [
  "Produce",
  "Meat & Fish",
  "Dairy & Eggs",
  "Bakery",
  "Pantry",
  "Frozen",
  "Drinks",
  "Other",
] as const;

export const UNITS = [
  "",
  "pcs",
  "g",
  "kg",
  "ml",
  "L",
  "cups",
  "tbsp",
  "tsp",
  "oz",
  "lb",
  "bunches",
  "cans",
  "bags",
  "boxes",
] as const;

export const QUICK_FILTERS = [
  { id: "today", label: "Today", icon: "📅" },
  { id: "upcoming", label: "Next N Days", icon: "🗓️" },
  { id: "fav", label: "Favourites", icon: "⭐" },
  { id: "recent", label: "Recent", icon: "🕐" },
] as const;

export type QuickFilter = (typeof QUICK_FILTERS)[number]["id"];

// Helpers
export const isToday = (dt: Date) =>
  new Date(dt).toDateString() === new Date().toDateString();

export const isUpcoming = (dt: Date, days = 7) => {
  const diff = (new Date(dt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
};

export const listProgress = (items: GroceryItem[]) => {
  if (!items.length) return 0;
  return Math.round(
    (items.filter((i) => i.checked).length / items.length) * 100
  );
};

export const groupByCategory = (items: GroceryItem[]) => {
  const map: Record<string, GroceryItem[]> = {};
  CATEGORIES.forEach((c) => {
    map[c] = [];
  });
  items.forEach((item) => {
    if (!map[item.category]) map[item.category] = [];
    map[item.category].push(item);
  });
  return Object.entries(map).filter(([, v]) => v.length > 0);
};
```

---

## File Structure

```
web/app/grocery-list/
├── page.tsx                        ← Main page shell
├── shop/
│   └── [id]/
│       └── page.tsx                ← Full-screen shopping view (separate route)
└── components/
    ├── QuickReference.tsx          ← Filter tabs + carousel of quick-ref cards
    ├── ListsSidebar.tsx            ← Scrollable list of all grocery lists
    ├── ListEditor.tsx              ← Selected list editor panel
    ├── ItemRow.tsx                 ← Individual editable item row with drag + arrows
    └── NewListModal.tsx            ← Create list modal
```

The shopping view lives at `/grocery-list/shop/[id]` as its own route so it can be navigated to directly and opened full-screen without the main page's chrome.

---

## Step-by-Step Migration

---

### Step 1 — Remove the existing page

Delete or archive the current `web/app/grocery-list/page.tsx`. Do not attempt to modify it incrementally — this is a full replacement.

---

### Step 2 — Create `page.tsx` (shell)

The shell owns all top-level state and passes it down as props.

**State:**
| State | Type | Initial value |
|---|---|---|
| `lists` | `GroceryList[]` | From React Query `useQuery` |
| `selectedId` | `number \| null` | First list's id, or `null` |
| `activeFilter` | `QuickFilter` | `"today"` |
| `upcomingDays` | `number` | `7` |
| `showNewModal` | `boolean` | `false` |

**Data fetching:**

```ts
const { data: lists = [], refetch } = useQuery({
  queryKey: ["grocery-lists"],
  queryFn: () => fetch("/api/grocery-lists").then((r) => r.json()),
});
```

**Filtered quick-reference lists** (computed from `lists` + `activeFilter`):

```ts
const filteredQuick = useMemo(() => {
  let result = lists;
  if (activeFilter === "today")
    result = lists.filter((l) => isToday(new Date(l.date)));
  if (activeFilter === "upcoming")
    result = lists.filter((l) => isUpcoming(new Date(l.date), upcomingDays));
  if (activeFilter === "fav") result = lists.filter((l) => l.favourite);
  if (activeFilter === "recent")
    result = [...lists]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, 5);
  return result;
}, [lists, activeFilter, upcomingDays]);
```

**Layout:** Two sections stacked vertically:

1. Page header (eyebrow, title, subtitle, "+ New List" button)
2. Quick Reference section (filter tabs + `<QuickReference>` carousel)
3. A two-column grid: `<ListsSidebar>` (left, `260px` fixed) + `<ListEditor>` or placeholder (right, `1fr`)

---

### Step 3 — Create `QuickReference.tsx`

Props: `lists: GroceryList[]`, `selectedId: number | null`, `activeFilter: QuickFilter`, `upcomingDays: number`, `onSelectFilter`, `onChangeUpcomingDays`, `onSelectList`, `onToggleFav`

**Filter tabs:** Render one pill button per filter. The active filter gets green background. When `activeFilter === "upcoming"`, render a small number input inline after the tabs for `upcomingDays`.

**Carousel:** A horizontally scrollable row of `quick-card` elements. Key CSS rules — copy from the prototype and do not simplify:

- The **wrap** element gets `overflow-x: auto` and `padding-top: 8px; margin-top: -8px`. This is the fix for the hover shadow clipping bug — the padding creates space above cards for the `box-shadow` and `translateY(-2px)` hover transform to render without being cut off.
- The **inner carousel** div gets `width: max-content` so it expands naturally and the wrap handles scrolling.
- Scrollbar styles go on the wrap, not the carousel.

**Quick card contents:**

- Favourite toggle (⭐ / ☆) — top right, `position: absolute`
- List name (Lora serif)
- Date label ("Today" if today, otherwise "Mar 12") + item count
- Meal plan tag (if present)
- Mini progress bar + percentage label
- Selected state: `border-color: var(--green)` + green `box-shadow` ring

---

### Step 4 — Create `ListsSidebar.tsx`

Props: `lists: GroceryList[]`, `selectedId: number | null`, `onSelect`, `onToggleFav`

A card with a fixed header ("ALL LISTS" label + count badge) and a scrollable list of rows beneath it.

Each row shows:

- List name (truncated with `text-overflow: ellipsis`)
- Date + item count as secondary meta
- Favourite toggle button
- Completion percentage (green, right-aligned)
- Selected state: left green border + subtle green background tint

---

### Step 5 — Create `ListEditor.tsx`

Props: `list: GroceryList`, `onChange: (updated: GroceryList) => void`, `onDelete: (id: number) => void`, `onShop: () => void`

**Header:**

- Inline-editable list name — clicking the name reveals an `<input>` that saves on blur or Enter, cancels on Escape
- Date label and optional meal plan tag
- Action buttons: **🛒 Shop** (calls `onShop`), **Send to Telegram** (disabled, greyed out, with `title="Coming soon — send to Telegram"`), **🗑 Delete** (red on hover, calls `onDelete`)

**Progress bar:** Lives between the header and items. Shows "X of Y collected · Z%". Bar uses a green gradient fill that transitions smoothly.

**Items list:** Scrollable area (`max-height: 480px`), renders one `<ItemRow>` per item.

**Add item row:** Pinned to the bottom of the card. Text input + "Add" button. Submits on Enter or button click. Clears after adding.

**Mutations:** Every change (rename, add item, update item, delete item, reorder) should call the appropriate API endpoint and then either update local state optimistically or call `refetch()`.

---

### Step 6 — Create `ItemRow.tsx`

Props: `item: GroceryItem`, `index: number`, `total: number`, `onUpdate`, `onDelete`, `onMove`

**Collapsed row (always visible):**

- Drag handle (`⠿` character) — `draggable` on the row div, with `onDragStart`/`onDragEnd` for visual feedback
- Checkbox — checks/unchecks item, strikes through the name
- Item name input — inline edit, no border until focused
- Quantity input + unit select (joined pill, quantity left, unit right)
- Category select
- ↑ / ↓ arrow buttons (disabled at first/last position)
- ▼ expand button
- ✕ delete button

**Expanded section (shown when ▼ is clicked):**

- Notes / Brand preference input
- Linked Meal input
- Slightly indented, cream background to differentiate from the main row

**Drag reorder:** The prototype uses HTML5 drag-and-drop for visual feedback only (opacity change). In production, wire `onDragEnd` to determine the new position and call `POST /api/grocery-lists/:id/reorder` with the updated `itemIds` array.

---

### Step 7 — Create `NewListModal.tsx`

Props: `onClose: () => void`, `onCreate: (list: GroceryList) => void`

A centered modal with:

- List name text input (auto-focused)
- Date input (defaults to today's date)
- Cancel + Create List buttons

On submit: call `POST /api/grocery-lists` with `{ name, date }`, then call `onCreate(newList)` to add it to local state and select it. Close on backdrop click or Escape.

---

### Step 8 — Create the Shopping View route

Create `web/app/grocery-list/shop/[id]/page.tsx`.

This is a **full-screen page** with no shared header or sidebar — it replaces the entire viewport.

**Layout (top to bottom):**

1. **Green header bar** — logo, list name (Lora), progress text ("X of Y collected"), "✕ Done" button that navigates back to `/grocery-list`
2. **Thin progress bar** — full-width, white fill on green track, animates as items are checked
3. **Scrollable body** — items grouped by category

**Category group:**

- Category name as an uppercase label with a dividing line
- One large tappable button per item

**Item button:**

- Full width, white card with generous padding (`1rem`) and `border-radius: 12px`
- Left: circular check indicator (empty border → filled green with ✓ on check)
- Middle: item name (Lora serif, `1.05rem`), secondary meta row (qty + unit, notes in italic, linked meal as a green pill)
- Right: "Needed" (orange) or "Collected" (green) status label
- Checked state: `opacity: 0.65`, cream-dark background, no hover lift

**Data:** Fetch the list by ID from `GET /api/grocery-lists/:id`. Toggle item checked state via `PATCH /api/grocery-lists/:id/items/:itemId`. Use optimistic updates so the UI responds instantly.

**Mobile:** The design already works on mobile. The key rules are: padding reduces to `0.75rem`, item name font stays at `1rem`, and check circles remain `28px` for tap target comfort.

**Navigation from main page:** The "🛒 Shop" button in `ListEditor` navigates to `/grocery-list/shop/[selectedId]` using `router.push()`.

---

### Step 9 — Telegram button

The "Send to Telegram" button must be rendered but **non-functional** in this version.

```tsx
<button
  className="btn-telegram-disabled"
  disabled
  title="Coming soon — send to Telegram"
>
  ✈ Send to Telegram
</button>
```

CSS: `cursor: not-allowed; opacity: 0.65; background: var(--cream-dark); color: var(--text-muted)`.

When Telegram integration is built in Phase 3, this button will call `POST /api/telegram/send-list` with the current list ID, which will send a formatted message to the user's Telegram bot.

---

### Step 10 — Responsive QA checklist

**Desktop (>900px)**

- [ ] Quick reference carousel scrolls horizontally without clipping card shadows on hover
- [ ] Carousel `padding-top: 8px; margin-top: -8px` on the wrap is present — this is the shadow clip fix
- [ ] Two-column layout: sidebar 260px, editor fills remaining space
- [ ] Shopping view is full-screen with comfortable spacing
- [ ] New list modal is centered, max-width 420px

**Tablet (768px–900px)**

- [ ] Nav collapses to hamburger
- [ ] Editor and sidebar stack vertically (editor on top)
- [ ] Item row qty/unit and category selects visible

**Mobile (<768px)**

- [ ] Item row hides quantity and category columns to keep rows scannable
- [ ] Editor header actions wrap without overflowing
- [ ] Shopping view items have `min-height` tap targets
- [ ] New list modal fills screen with comfortable padding

---

## What the Agent Should NOT Change

- The `carousel-wrap` overflow fix — `overflow-x` must be on the **wrap**, not the inner carousel, with `padding-top: 8px; margin-top: -8px` to prevent shadow clipping on hover
- The Telegram button must remain disabled with `cursor: not-allowed` — do not wire it up
- Design token values — all colors, fonts, and spacing must match `copilot-chef-style-guide.md`
- Category order in `CATEGORIES` constant — this determines the display order in both the editor and the shopping view
- The `sortOrder` field on `GroceryItem` — this must be persisted so manual reordering survives page refresh
