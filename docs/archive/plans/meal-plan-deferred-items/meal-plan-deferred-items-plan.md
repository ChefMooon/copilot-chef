# Implementation Plan: Meal Plan Deferred Items (Post Drag-Nav Follow-ups)

Source: items explicitly deferred during [meal-plan-week-drag-nav](../meal-plan-week-drag-nav/meal-plan-week-drag-nav-plan.md) implementation (spec AR numbers + checkpoint-review findings). Items are independently shippable; order below is suggested priority. Global rules inherited from the parent plan apply (verification gates, frozen MIME/payload contracts, ref-discipline for scroll logic, jsdom-vs-layout caveats).

---

## Item 1 (P1 - polish bug): Muted-profile translucency on sticky panes

**Context:** `.weekProfileMuted` applies `opacity: 0.48; filter: saturate(0.65)` to whole cells. When applied to sticky surfaces (`.weekDayHeader`, `.weekTypeCell`) in multi-profile setups, scrolled content shows through the pinned pane (seams). Flagged at Checkpoint 2 of the parent plan.

**Approach:** keep opacity muting for non-sticky surfaces (slot cells); introduce a solid-token variant for sticky surfaces.

### Tasks
1. Add `.weekProfileMutedSurface`: solid `color-mix(in srgb, var(--muted) NN%, var(--card))` background + desaturated text/border colors (no alpha, no `opacity`).
2. Apply it in `WeekView.tsx` wherever `weekProfileMuted` lands on a sticky node (day headers, type cells).
3. Manual QA: two-profile setup, mute one, scroll both axes at 100%/125%/150% scaling; compare muting legibility.

**Acceptance:** zero see-through seams on pinned panes; muted state still obviously distinguishable; gates clean.

---

## Item 2 (P2 - accessibility debt): Sub-24px touch targets (AR-14)

**Context:** several board controls are below 24px effective size (pre-existing debt flagged in parent spec).

### Tasks
1. Audit pass: enumerate every interactive control in week/day boards (`weekMealActionBtn`, `slotAddIconBtn`, `slotManageIconBtn`, `slotDragHandleBtn`, period nav, caret-adjacent buttons); record computed sizes in a table in this doc when executed.
2. Raise visual+hit sizes to >= 24px minimum; where layout cannot grow, add transparent hit-area expansion (pseudo-element `::after { inset: -6px }`) without shifting grid rhythm.
3. Verify focus rings remain visible above sticky layers (parent QA item 9).

**Acceptance:** no interactive control under 24px effective target; before/after screenshots; gates clean.

---

## Item 3 (P3 - large): Pointer-event/touch drag system (AR-3)

**Context:** HTML5 DnD is mouse-only; `dragDisabled` prop exists as a kill-switch. Touch devices currently get no drag at all.

### Tasks
1. Extract the WeekView auto-scroll engine into a shared module/hook (`useEdgeAutoScroll`) without behavior change; WeekView consumes it (pure refactor, gates must stay identical).
2. Prototype pointer-based drag in DayView only: long-press (250ms) lifts a meal into a portal ghost; pointermove drives targets via elementFromPoint; reuse `MealPlanDropPayload` shape in memory (no DataTransfer).
3. Reuse the extracted engine for finger-near-edge scrolling.
4. WeekView parity, then Meal Bank sidecar parity. Keep HTML5 path untouched for mouse; choose path by pointerType.

**Acceptance:** full existing suite green; new touch flow passes manual matrix on a real tablet + Windows touch emulation; no regression to mouse DnD paths.

---

## Item 4 (P4): Keyboard-accessible meal moving

**Context:** meals cannot be moved without a pointer.

### Tasks
1. Focusable cards already exist (buttons); add move affordances: e.g., Alt+Arrow moves focused meal across slots/days (reusing drop-target resolution server-side via `onDropPayload` with computed anchor).
2. Visible focus + announced result (pairs with Item 6 live region).
3. Document shortcuts in-app (tooltip/help) and avoid conflicts with existing handlers.

**Acceptance:** complete meal move possible keyboard-only; announcements correct; gates clean.

---

## Item 5 (P5): Snap-to-today affordance (AR-11)

**Context:** spec rejected AUTO-jumping to today on week change; a manual affordance was left as future work.

### Tasks
1. Add "Today" button to `PeriodNavigation` (shown when current range excludes today).
2. Clicking centers today without altering drag/lock semantics.

**Acceptance:** button appears only when relevant; no surprise jumps during drags.

---

## Item 6 (P6): ARIA live region for visible day range

### Tasks
1. Polite live region announcing rendered range ("Mon Apr 20 - Sun Apr 26") on date/week changes, including mid-drag flips.
2. Throttle announcements during rapid navigation (one per settled change).

**Acceptance:** screen reader announces range changes exactly once per settled navigation.

---

## Item 7 (P7): RTL support (AR-15)

### Tasks
1. Convert week-board directional CSS to logical properties where feasible (borders/insets, caret/band/fade positioning).
2. Audit auto-scroll engine for RTL `scrollLeft` sign conventions (negative-left browsers); gate speeds/clamps accordingly.
3. Map flip directions correctly under RTL.

**Acceptance:** manual RTL pass (devtools force-RTL) with correct pinning, fades, band directions, flip arrows.

---

## Item 8 (P8): Month-view drag parity

**Context:** MonthView excluded from parent scope.

### Tasks
1. Adopt `dragPreview.ts` builders for drag ghosts.
2. Decide drop semantics for month cells (day-level slot drops only, or full meal-level with insertAfter omitted).
3. Reuse overflow/auto-scroll machinery if month grid scrolls.

**Acceptance:** consistent drag language across Day/Week/Month; gates clean.

---

## Item 9 (P9 - conditional): Virtualization

**Context:** only justified by measured pain (many meal types x 7 days x stacked cards).

### Tasks
1. First: profile current WeekView with realistic worst-case data (50 types x 7 days x 5 cards); record baseline commit/paint costs in this doc.
2. Only if budgets exceeded: virtualize body rows (`content-visibility: auto` first, framework second).

**Acceptance:** documented measurements either justifying deferral or showing improvement; no drag-regression.

---

## Regression Guardrails (apply to ALL items)

- MIME `application/x-local-recipe-book-meal-plan-drag`, payload helpers, `WeekViewProps`, drop-target `insertAfter` recomputation stay frozen.
- Never setState per `dragover`/per frame; refs for pointer/rAF/speeds.
- jsdom cannot verify layout: sticky/RTL/scaling claims require the manual matrix.
- Full gates each item: `npm test`, `npm run lint`, `tsc --noEmit -p tsconfig.web.json` (baseline: see parent plan Phase 0; DayView CSSProperties error already resolved).
