# Meal Plan Page — Implementation Complete

> This document records the migration of the Calendar page into the Meal Plan route. The Calendar page has been consolidated into /meal-plan, providing day/week/month views, meal editing, and AI resuggest functionality within a single unified interface.

---

## Overview

The existing calendar page is a static layout with a fixed weekly grid and no interactivity beyond basic navigation. The new design replaces it entirely with a three-view calendar system (Day / Week / Month), a persistent view preference, color-coded meal type system, an interactive meal edit modal, and full mobile optimization.

---

## Reference Files

| File                          | Purpose                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `copilot-chef-calendar.jsx`   | Complete approved UI prototype — source of truth for all markup, styles, and interaction logic |
| `copilot-chef-style-guide.md` | Design system reference for colors, typography, spacing, and component patterns                |
| `copilot-chef-plan.md`        | Overall project plan for architectural context                                                 |

---

## New Data Requirements

Before touching the UI, ensure the following data structures and API endpoints exist. The prototype uses mock data — these need to be wired to real Prisma models.

### Schema Changes

#### Add `mealType` enum values

The prototype introduces two new meal types not present in the original plan. Update the `MealType` enum in `schema.prisma`:

```prisma
enum MealType {
  breakfast
  morning_snack   // new
  lunch
  afternoon_snack // new
  dinner
}
```

#### Add `notes` and `ingredients` to `Meal`

The edit modal surfaces both fields. Confirm they exist on the `Meal` model:

```prisma
model Meal {
  id          Int      @id @default(autoincrement())
  name        String
  type        MealType
  date        DateTime
  notes       String?           // add if missing
  ingredients String[]          // add if missing — store as JSON array
}
```

Run `prisma migrate dev` after schema changes.

### API Endpoints Needed

| Method   | Route                  | Purpose                                              |
| -------- | ---------------------- | ---------------------------------------------------- |
| `GET`    | `/api/meals?from=&to=` | Fetch all meals within a date range                  |
| `PATCH`  | `/api/meals/:id`       | Update a meal (name, type, date, notes, ingredients) |
| `POST`   | `/api/meals`           | Create a new meal                                    |
| `DELETE` | `/api/meals/:id`       | Delete a meal                                        |

The `GET` endpoint should accept `from` and `to` as ISO date strings and return all scheduled meals whose `date` falls within that range. This is what each view uses to load its data.

---

## Constants & Utilities

Extract the following from the prototype into a shared module at `web/lib/calendar.ts`. These are used across all three views and the edit modal.

### Meal type order and display config

```ts
// web/lib/calendar.ts

export const MEAL_TYPES = [
  "breakfast",
  "morning snack",
  "lunch",
  "afternoon snack",
  "dinner",
] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export const TYPE_CONFIG: Record<
  MealType,
  {
    dot: string;
    bg: string;
    text: string;
    label: string;
  }
> = {
  breakfast: {
    dot: "#E8885A",
    bg: "#FDF0E8",
    text: "#A0441A",
    label: "BREAKFAST",
  },
  "morning snack": {
    dot: "#C5A84B",
    bg: "#FBF6E8",
    text: "#8A6E20",
    label: "MORNING SNACK",
  },
  lunch: { dot: "#5A7D63", bg: "#EAF2EC", text: "#2E5438", label: "LUNCH" },
  "afternoon snack": {
    dot: "#8A7DB8",
    bg: "#F0EDF8",
    text: "#5A4D8A",
    label: "AFTERNOON SNACK",
  },
  dinner: { dot: "#3B5E45", bg: "#D4E4D8", text: "#1E3A26", label: "DINNER" },
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const mealsForDay = (meals: Meal[], date: Date) =>
  meals
    .filter((m) => isSameDay(new Date(m.date), date))
    .sort((a, b) => MEAL_TYPES.indexOf(a.type) - MEAL_TYPES.indexOf(b.type));
```

---

## File Structure

Create the following files under `web/app/calendar/`:

```
web/app/calendar/
├── page.tsx                  ← Main calendar page (shell + view switcher)
├── components/
│   ├── DayView.tsx           ← Day timeline view
│   ├── WeekView.tsx          ← Week column grid view
│   ├── MonthView.tsx         ← Month grid with popovers
│   └── EditModal.tsx         ← Meal edit modal (desktop + mobile)
```

---

## Step-by-Step Migration

---

### Step 1 — Remove the existing page

Delete or archive the current `web/app/calendar/page.tsx` (or equivalent). Do not attempt to incrementally modify the existing markup — the design is a full replacement.

---

### Step 2 — Create `page.tsx` (shell)

This is the top-level component. It owns:

- `view` state (`"day" | "week" | "month"`) — initialized from `localStorage` key `"cal_view"`, defaulting to `"week"`
- `date` state — the currently focused date, initialized to today
- `meals` state — the array of meals fetched from the API
- `editMeal` state — the meal currently open in the edit modal, or `null`
- The `switchView` function — updates state AND writes to `localStorage`

**View persistence pattern (from prototype):**

```ts
const [view, setView] = useState<CalView>(() => {
  try {
    return (localStorage.getItem("cal_view") as CalView) || "week";
  } catch {
    return "week";
  }
});

const switchView = (v: CalView) => {
  setView(v);
  try {
    localStorage.setItem("cal_view", v);
  } catch {}
};
```

The shell renders:

1. The shared `<Header>` component with `"Calendar"` as the active nav item
2. The page header section — eyebrow ("CALENDAR"), title, subtitle (context-sensitive based on active view), "Today" button, and the Day/Week/Month toggle
3. The `cal-card` wrapper containing whichever view component is active
4. The global meal type legend below the card
5. `<EditModal>` rendered conditionally when `editMeal` is not null

**View toggle UI:** Three buttons inside a pill container. Active button gets green background. Refer to `.view-toggle` and `.view-btn` styles in the prototype.

**"Today" button:** Resets `date` to today's date. Refer to `.btn-today` style.

---

### Step 3 — Create `DayView.tsx`

Props: `date: Date`, `meals: Meal[]`, `setDate: (d: Date) => void`, `onEdit: (meal: Meal) => void`

**Layout:**

- A navigation bar at the top with prev/next buttons and a centered title showing the weekday (Lora serif) and full date. If the date is today, show the "Today" pill badge.
- A vertical timeline below, one slot per meal type in order: breakfast → morning snack → lunch → afternoon snack → dinner.

**Timeline slot structure:**
Each slot has two columns:

- Left: a colored dot (14×14px circle) with a vertical connector line running to the next slot. The last slot has no line.
- Right: the type label in uppercase, then either a meal card or an empty dashed slot with a "+ Add" button.

**Meal card behavior:** Clicking a meal card calls `onEdit(meal)`. On hover, the card shifts right by 2px (`translateX(2px)`).

**Empty slot:** A dashed-border container with a ghost "+ Add" button. In the prototype this fires `alert()` — in production it should open the edit modal with a blank meal pre-filled with that type and date.

**Day navigation:** Prev/next buttons create a new Date from the current one and call `setDate`. No week or month boundary restrictions.

---

### Step 4 — Create `WeekView.tsx`

Props: `date: Date`, `meals: Meal[]`, `setDate: (d: Date) => void`, `onEdit: (meal: Meal) => void`

**Week calculation:** Derive the Monday of the current week from `date` using `(date.getDay() + 6) % 7` offset. Generate 7 day objects from that Monday.

**Layout:** A 7-column CSS grid (`grid-template-columns: repeat(7, 1fr)`). Each column has:

- A header with the 3-letter weekday abbreviation and date number. Today's date number gets an orange circle background.
- A scrollable list of meal chips below.

**Meal chips:** Compact pill-style buttons. Each chip shows the meal name (truncated if needed) and the meal type label below it. Background and left border color come from `TYPE_CONFIG[meal.type]`. Clicking calls `onEdit(meal)`.

**Week navigation:** Prev/next buttons offset `date` by ±7 days and call `setDate`. The nav bar shows the date range as "Mar 9 — Mar 15, 2026".

**Mobile:** On small screens, hide the meal type sub-label (`.week-chip-type`) to save space. The 7-column grid remains — columns compress. See `@media (max-width: 768px)` rules in prototype.

---

### Step 5 — Create `MonthView.tsx`

Props: `date: Date`, `meals: Meal[]`, `setDate: (d: Date) => void`, `onEdit: (meal: Meal) => void`

**Grid calculation:**

- First day of the month → `new Date(year, month, 1)`
- Start offset (Mon-based) → `(firstDay.getDay() + 6) % 7`
- Total cells → `Math.ceil((startOffset + daysInMonth) / 7) * 7`
- Cells before day 1 and after the last day render as empty `month-cell-empty` divs

**Day cell contents:**

- Date number in the top-left
- A row of colored dots at the bottom — one dot per meal type that has at least one meal that day. Dot colors come from `TYPE_CONFIG`. Only render dots for types that have meals — do not render empty/placeholder dots.

**Popover:** Clicking a day cell with meals opens a fixed-position popover. The popover is positioned using the clicked element's `getBoundingClientRect()` — clamp `x` and `y` so it never overflows the viewport. It lists all meals for that day as clickable rows; clicking a meal row calls `onEdit(meal)` and closes the popover.

Close the popover by: clicking outside (backdrop div), pressing Escape, or clicking the ✕ button.

**Month navigation:** Prev/next buttons call `setDate(new Date(year, month ± 1, 1))`.

---

### Step 6 — Create `EditModal.tsx`

Props: `meal: Meal`, `onClose: () => void`, `onSave: (updated: Meal) => void`

This component renders as a centered modal on desktop and a bottom sheet on mobile.

**Fields:**
| Field | Input type | Notes |
|---|---|---|
| Meal name | `<input type="text">` | Required |
| Meal type | `<select>` | Options from `MEAL_TYPES` constant |
| Day | `<input type="date">` | Parse back to `Date` on change |
| Notes | `<textarea>` | Optional, resizable |
| Ingredients | Chip list + text input | Add on Enter or "Add" button click; remove via × on each chip |

**Footer:**

- Left: ✨ AI Re-suggest button — calls the `/api/chat` streaming endpoint with a prompt like `"Re-suggest a ${form.type} meal for ${form.date} based on my preferences"`. In the prototype this is a placeholder `alert()`.
- Right: Cancel (ghost button) + Save Changes (orange button)

**Save behavior:** Calls `onSave(form)` then `onClose()`. The parent (`page.tsx`) sends a `PATCH /api/meals/:id` request and updates local state on success.

**Close behavior:** Clicking the overlay backdrop, pressing Escape, or clicking the ✕ button all call `onClose()`.

**Mobile sheet:** At `≤768px`, the modal anchors to the bottom of the screen with `border-radius: 14px 14px 0 0`. The footer stacks vertically with the AI button spanning full width. Refer to the `@media (max-width: 768px)` block in the prototype for exact styles.

**Animation:** Fade-in overlay + slide-up panel on mount. Use the `fadeIn` and `slideUp` keyframes from the prototype.

---

### Step 7 — Data fetching

Replace all mock data in the prototype with real API calls.

**In `page.tsx`**, use React Query to fetch meals for the visible date range based on the active view:

```ts
const dateRange = useMemo(() => {
  if (view === "day") return { from: date, to: date };
  if (view === "week") {
    const mon = getMonday(date);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: mon, to: sun };
  }
  // month
  return {
    from: new Date(date.getFullYear(), date.getMonth(), 1),
    to: new Date(date.getFullYear(), date.getMonth() + 1, 0),
  };
}, [view, date]);

const { data: meals = [] } = useQuery({
  queryKey: ["meals", dateRange],
  queryFn: () => fetchMeals(dateRange.from, dateRange.to),
});
```

**`fetchMeals`** calls `GET /api/meals?from=ISO&to=ISO` and returns a `Meal[]`.

**On save in `EditModal`**, the parent calls:

```ts
await fetch(`/api/meals/${updated.id}`, {
  method: "PATCH",
  body: JSON.stringify(updated),
});
queryClient.invalidateQueries({ queryKey: ["meals"] });
```

---

### Step 8 — Styles

Do not use a separate CSS file. All styles live in a `<style>` block at the component level (as in the prototype) or in a co-located `.module.css` file — whichever is consistent with the rest of the project.

**Copy the full style block from the prototype verbatim as a starting point.** Then:

1. Remove any inline `style` objects that duplicate what's already in the CSS classes
2. If using Tailwind, map the layout utilities (padding, margin, display, gap) to Tailwind classes while keeping the custom CSS for: heatmap-style grids, chip/dot colors, modal animations, and timeline connector lines — these cannot be expressed cleanly in Tailwind
3. Ensure the `@import` Google Fonts URL is loaded globally (via `layout.tsx` or `globals.css`) rather than inside a component `<style>` tag in production

---

### Step 9 — Responsive QA checklist

Before marking the page complete, verify the following at each breakpoint:

**Desktop (>900px)**

- [ ] All three view toggle buttons visible and functional
- [ ] Week view shows all 7 columns without horizontal scroll
- [ ] Month grid fills the card width
- [ ] Edit modal appears centered with max-width 520px
- [ ] Popover does not overflow viewport on edge-column days

**Tablet (768px–900px)**

- [ ] Nav collapses to hamburger
- [ ] Week chip type labels hidden, names still visible
- [ ] Month cells readable at reduced height

**Mobile (<768px)**

- [ ] Edit modal renders as bottom sheet (anchored to bottom, full width, rounded top corners)
- [ ] Footer buttons stack vertically, AI button spans full width
- [ ] Form fields are touch-friendly (min 44px tap targets)
- [ ] Popover is readable and closable
- [ ] View toggle and Today button remain accessible in the page header

---

## What the Agent Should NOT Change

- The existing `Header` component — use it as-is with `activeItem="Calendar"`
- The design token values — all colors, fonts, and spacing must match the style guide exactly
- The `localStorage` key — must remain `"cal_view"` so the persisted preference is consistent
- The meal type order — always `breakfast → morning snack → lunch → afternoon snack → dinner`
- The dot colors for each meal type — these are defined in `TYPE_CONFIG` and used consistently across all three views and the legend
