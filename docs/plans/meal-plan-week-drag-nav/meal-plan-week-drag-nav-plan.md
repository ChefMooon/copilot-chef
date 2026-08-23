# Implementation Plan: Week View Drag Navigation (Auto-Scroll & DnD Improvements)

Source spec: [meal-plan-week-drag-nav-spec.md](./meal-plan-week-drag-nav-spec.md)
Scope: `src/renderer/components/meal-plan/WeekView.tsx`, `DayView.tsx`, `meal-plan.module.css`, shared helpers in `src/renderer/lib/calendar.ts` (read-only contract), new `src/renderer/components/meal-plan/dragPreview.ts`.

This plan sequences the spec's changes C1-C5 into seven phases for a single implementing agent. Phases are dependency-ordered: each phase leaves the tree green and shippable. Do not start a phase until the previous phase's acceptance criteria pass - **and** until any mandatory review checkpoint after that phase is approved by the user (checkpoints exist after Phases 1 and 4).

## Global Rules For The Implementing Agent

1. **Verification gates** (run at the end of every phase):
   - `npm test` - full vitest suite must pass.
   - `npm run lint` - must pass with no new warnings.
   - `npx tsc --noEmit -p tsconfig.web.json` - the repo has **pre-existing errors** (at minimum `DayView.tsx:464` missing `CSSProperties` import, and several in `DragPromptPaths.test.tsx`). Record the baseline output once in Phase 0; the gate is *no new errors*, not zero errors.
2. **Do not break contracts**: MIME type `application/x-local-recipe-book-meal-plan-drag`, `setMealPlanDragPayload` / `getMealPlanDragPayload` signatures, `WeekViewProps`, and drop-target semantics (`kind`, `insertAfter` recomputed at drop time) are frozen.
3. **Performance rules from the adversarial review**: never call React state setters per `dragover` event or per animation frame (AR-5). Pointer position, rAF ids, and speeds live in refs. State updates only on enter/leave transitions or boolean flips.
4. **jsdom cannot verify layout** (AR-13): tests assert classes/attributes/state transitions with rect stubs, fake `DataTransfer`, fake timers, mocked `rAF` and `ResizeObserver`. Sticky/scroll geometry itself is verified only by the Phase 7 manual QA checklist.
5. **Style conventions**: CSS Modules in `meal-plan.module.css`; no inline comment blocks in TSX; follow existing naming (`week*` prefix for week-view styles, `slot*` for slot-level affordances).
6. **Explicitly out of scope** (do not implement, even if trivially reachable): pointer-event/touch drag system (AR-3), keyboard-accessible meal moving, snap-to-today on week change (AR-11), ARIA live region for visible day range, Month view changes, virtualization, RTL support (AR-15), fixing the pre-existing sub-24px touch targets (AR-14).
7. Line numbers cited below refer to `WeekView.tsx` on the current main branch and will drift slightly as earlier phases land; locate by symbol name first.
8. **Review checkpoints (hard stops)**: after completing Phase 1 and Phase 4, STOP and request explicit user approval before starting the next phase. At a checkpoint report: what changed and why, verification-gate outputs vs baseline, manual-check results, and any deviations from this plan. If the user requests changes, apply them and re-present before proceeding.
9. **Commit policy**: do NOT commit, stage, or stash at any point. All seven phases accumulate in the working tree as one uncommitted change set; the user will create a single commit themselves after QA completes in Phase 7. Because there are no per-phase commits, keep every phase gate-clean and self-contained so the final diff stays reviewable phase-by-phase.

---

## Phase 0: Baseline And Safety Net

**Objective:** Capture the current state so regressions are detectable.

Tasks:
1. Run the three verification gates; save their outputs (especially the exact list of pre-existing `tsc` errors) for comparison in later phases.
2. Read `WeekView.tsx` end-to-end and confirm the anchor symbols referenced throughout this plan exist as described:
   - `getEdgeDirection` (~line 249), `scheduleEdgeNavigation` (~280), `measureEdgeZones` inside `useLayoutEffect` (~312-363), cleanup effect (~365-369)
   - `onBoardDragOverCapture` (~509), `onBoardDragLeaveCapture` (~536)
   - `canHandleDragOver` (~386), `getActiveDropPayload` (~405)
   - `onDragStartSlot` preview DOM construction (~459-488)
   - Meal card `onDragOver` (~809-831) and `onDrop` midpoint math (~836-838)
   - Edge zone overlay JSX (~976-1018)
3. Confirm no other component renders `.weekBoardScroller` / `.weekBoard` besides `WeekView`.

**Acceptance:** Baseline outputs recorded; anchors located. No code changed.

---

## Phase 1: Structural Grid Rework - Row Wrappers + Shared Column Template (C3 structural half)

**Objective:** Replace the flat ~64-child grid with stacked header/body row containers sharing one column template, so sticky cells gain slack (fixes blocker AR-1). No behavioral change yet.

### Tasks

1. **CSS (`meal-plan.module.css`)**:
   - On `.weekBoard`, define `--week-board-cols: 128px repeat(7, minmax(128px, 1fr));`. Keep `.weekBoard` as `position: relative` container (it hosts the edge-zone overlays) but remove its `display: grid` / `grid-template-columns` usage for direct children.
   - Add `.weekBoardHeader` and `.weekBoardRow`: `display: grid; grid-template-columns: var(--week-board-cols);`.
   - In the `@media (max-width: 900px)`, `(max-width: 768px)`, `(max-width: 480px)` blocks, replace the three `.weekBoard { grid-template-columns: ... }` declarations with overrides of `--week-board-cols` only (108px/112px, 96px/104px, 88px/96px variants respectively). Keep the `min-width` overrides on `.weekBoard` (892/824/760px) unchanged.
   - Add data-friendly hook classes only if needed; prefer `data-*` attributes in TSX.
2. **TSX (`WeekView.tsx`)**, render section (~559-1020):
   - Inside `.weekBoard`, render a `.weekBoardHeader` wrapper containing the corner cell (`Meal`) and the 7 day headers, exactly preserving each child's className composition, `data-week-day-index`, keys, and inner markup (weekday/date/profile chip/accent bar).
   - Wrap each meal-type iteration (currently a `<Fragment key={type}>` emitting `.weekTypeCell` + 7 `.weekSlotCell`s, ~606-975) in a `.weekBoardRow` div with `data-week-board-row={type}` and `key={type}`; drop the now-redundant `Fragment`.
   - Keep the edge-zone overlay JSX as direct children of `.weekBoard` (unchanged positioning model).
   - All existing handlers (`onDragOverCapture` etc.) stay on `.weekBoard`.
3. **Tests**: Create `src/renderer/components/meal-plan/WeekViewDragNav.test.tsx` modeled on `DragPromptPaths.test.tsx` (reuse its `profile`, meal fixtures, `createDataTransfer`). Add structure-presence cases:
   - `[data-week-day-index='0']` is nested inside the header wrapper (assert via `closest` on a class present only on the wrapper, e.g. query the module class for `.weekBoardHeader`).
   - Each meal type yields a `[data-week-board-row]` containing exactly 8 cells (1 `.weekTypeCell` + 7 `.weekSlotCell`).
   - Existing drag flows still find cards/slots (smoke: dragover + drop on a card calls `onDropPayload`).

**Acceptance:** `npm test` passes including all pre-existing suites unmodified; structure tests pass. Manual spot check on `npm run dev` at a wide window: identical layout to baseline (columns align, borders continuous across row boundaries).

> **>>> CHECKPOINT 1 - HARD STOP FOR USER REVIEW.** This is a mandatory pause (Global Rule 8). Present the Phase 1 diff summary, gate outputs vs baseline, and layout comparison notes. Do NOT begin Phase 2 until the user explicitly approves.

---

## Phase 2: Bounded Dual-Axis Scrollport + Frozen Panes CSS (C3 scroll half)

**Objective:** Make `.weekBoardScroller` a real two-axis scroll container so `position: sticky` can engage (fixes blocker AR-2), then freeze the header row and label column. Also establish the `canScroll*` state used by Phase 2 elevation cues and Phase 6 fades.

### Tasks

1. **Bounded height**: `.weekBoardScroller` becomes `overflow: auto; overscroll-behavior: contain;` with
   ```css
   max-height: calc(100vh - var(--app-titlebar-height, 64px) - 13rem);
   max-height: calc(100dvh - var(--app-titlebar-height, 64px) - 13rem);
   ```
   (vh fallback first, dvh override second; tune the `13rem` allowance during manual QA so at least 3 slot rows remain visible - AR-9.)
2. **Sticky layers**:
   - `.weekBoardHeader { position: sticky; top: 0; z-index: 30; }`
   - `.weekBoardCorner { position: sticky; left: 0; z-index: 32; }`
   - `.weekTypeCell { position: sticky; left: 0; z-index: 20; }`
   - Verify opaque backgrounds: header uses `var(--card)` variants, corner/typeCell use `var(--muted)` - both solid tokens; do not introduce translucency on these surfaces.
3. **Z-order ladder** (AR-7): raise `.weekEdgeZone` from `z-index: 3` to `z-index: 40` (already `pointer-events: none`). Slot content stays base layer. Document the ladder in the CSS ordering (content < labels 20 < header 30 < corner 32 < overlays 40).
4. **Scroll-state detection in `WeekView.tsx`**:
   - Add a `scrollerRef` on `.weekBoardScroller`.
   - Add state `{ canScrollLeft, canScrollRight, canScrollTop, canScrollBottom }` (single object state to avoid tearing).
   - Compute via `scrollLeft > 0`, `scrollLeft < scrollWidth - clientWidth - 1`, and the vertical equivalents; recompute on: scroller `scroll` events, `ResizeObserver` on the scroller (feature-guarded like the existing board observer, ~353-356), window `resize`, and week change (include `date` in an effect dependency).
   - Update state **only when a boolean flips** (guard with a ref holding previous values) - AR-5.
5. **Elevation cue**: toggle a soft right-shadow class on the sticky corner/typeCell and a bottom-shadow class on the header when `canScrollRight` / `canScrollBottom` respectively. Pure CSS box-shadows, no transition storms (single boolean-driven class).
6. **Tests** (extend `WeekViewDragNav.test.tsx`):
   - Stub `scroller` metrics (`scrollLeft`, `scrollWidth`, `clientWidth`, etc. via `Object.defineProperty`) and assert `canScroll*` booleans flip after firing `scroll`.
   - Presence-only assertions: header/corner/typeCell nodes carry the sticky classes (module class names); scroller carries `overflow` via class presence. Real stickiness is manual-QA territory (AR-13).

**Acceptance:** Gates pass. Manual dev-server check: with many meal types, scrolling the page-independent board keeps the weekday row pinned vertically; scrolling horizontally pins the label column with no see-through seams; wheel over the board does not chain-scroll the page past its bounds.

---

## Phase 3: Overflow Detection + Flip-Zone Gating And Geometry Fix (C2)

**Objective:** Detect per-axis overflow of the scroller; show the Monday/Sunday hover-to-flip zones only when the board fits horizontally; make zone geometry robust to sticky headers (AR-8).

### Tasks

1. **Overflow state**: add `isOverflowingX` and `isOverflowingY` (booleans, single state object) computed from the scroller (`scrollWidth > clientWidth + 1`, height equivalent). Recompute at the same trigger points as `canScroll*` in Phase 2 - share one recompute function so resize/scroll/week-change update everything consistently.
2. **Gate flip zones**:
   - Early-return in `measureEdgeZones` (and clear `edgeZones` to `null`) when `isOverflowingX`.
   - Skip rendering the edge-zone overlay block (~976-1018) when `isOverflowingX`.
   - Leave `EDGE_NAVIGATION_DELAY = 800` and lock semantics untouched.
3. **Zone geometry rework** (AR-8): in `measureEdgeZones`, replace the `mondayRect.bottom - boardRect.top` source for `zone.top`/`zone.bottom` with body-row offsets:
   ```ts
   const firstRow = board.querySelector<HTMLElement>("[data-week-board-row]");
   const boardRect = board.getBoundingClientRect();
   const rowOffsetTop = firstRow ? firstRow.offsetTop - board.offsetTop : 0;
   // zone.top = rowOffsetTop, zone.bottom = board.scrollHeight - board.offsetTop (or boardRect.height equivalent)
   ```
   Keep deriving `zone.left`/`zone.right` from the Monday/Sunday header rects (horizontal geometry is unaffected by sticking).
4. **Tests**:
   - Mode gate: stub scroller so `scrollWidth > clientWidth` -> assert no `[data-week-edge-zone]` nodes render and dragging near the board edge does not schedule a week change; stub fitted (`scrollWidth <= clientWidth`) -> zones render and existing flip timing behavior holds (fake timers advance 800ms, lock prevents double-fire).
   - Geometry regression guard: with a stubbed sticky-offset header (header rect moved), assert computed zone `top` equals the first row offset, not the header bottom.

**Acceptance:** Gates pass. Manual check: narrow window (< ~1100px) shows no flip zones mid-drag and no accidental week flips; wide window behaves exactly as today (hover Sunday quarter for 800ms flips once, lock holds).

---

## Phase 4: Drag-Driven Edge Auto-Scroll Engine (C1 core)

**Objective:** While dragging and the board overflows, holding the pointer near the scroller's visible edge auto-scrolls that axis; flip zones stay suppressed in overflow mode. This is the highest-complexity phase - follow the ref/state discipline strictly.

### Tasks

1. **Constants** (module scope in `WeekView.tsx`):
   ```ts
   const EDGE_SCROLL_BAND_PX = 72;      // horizontal bands
   const EDGE_SCROLL_BAND_Y_PX = 64;    // top/bottom bands
   const EDGE_SCROLL_MIN_SPEED = 3;     // px/frame
   const EDGE_SCROLL_MAX_SPEED = 14;    // px/frame (~840 px/s @ 60Hz)
   ```
2. **Refs** (never state): `lastPointerRef {x,y}`, `autoScrollRafIdRef`, `isAutoScrollLoopActiveRef`, `bandActiveRef` mirroring the band-active state used only for rendering.
3. **Trigger recognition mirrors `canHandleDragOver`** (AR-4): in `onBoardDragOverCapture`, after computing `activePayload` exactly as today (transfer sniff OR `draggedPayload`), record `lastPointerRef.current = { x: event.clientX, y: event.clientY }` **before any early return**, and ensure `event.preventDefault()` + `dropEffect = "move"` are applied for recognized drags even outside flip zones (needed so drop is permitted anywhere mid-scroll; verify this does not regress empty-slot/card drop handling which call their own preventDefault).
4. **Band evaluation + loop start**: compare `lastPointerRef` against the scroller's `getBoundingClientRect()` each frame. Start the single `requestAnimationFrame` loop when a recognized drag enters any band (left/right/top/bottom); the loop:
   - Computes per-axis signed speed: linear ramp from `MIN_SPEED` at band outer edge to `MAX_SPEED` at the scroller edge; zero outside bands; sign toward the edge.
   - Applies `scroller.scrollLeft += vx; scroller.scrollTop += vy;` clamped to `[0, scrollMax]`; **keeps running while clamped** (idle-but-alive so resumption is instant - AR-6).
   - Sets band-active state **only on enter/leave transitions** (compare with `bandActiveRef` first).
   - Stops only on the stop conditions below.
5. **Stop conditions** (all must cancel the rAF id and clear band-active state):
   - `onDropCapture` and `onDragEndCapture` on the board (extend the existing handlers that call `clearEdgeNavigationState`),
   - board-capture `dragleave` leaving the board,
   - `isApplyingDrop` becoming true (check inside `applyDropTarget`),
   - `draggedPayload` cleared / unmount (extend the cleanup effect at ~365-369 to cancel the rAF id),
   - **mode loss**: the overflow recompute function from Phase 3, when called from a resize crossing the fit/overflow boundary, stops the loop and clears band state synchronously (AR-10).
6. **Suppress flip hit-test while overflowing**: in `onBoardDragOverCapture`, skip `getEdgeDirection` / `scheduleEdgeNavigation` entirely when `isOverflowingX` (belt-and-suspenders alongside the Phase 3 render gate).
7. **Visuals**: render four band overlay divs (left/right/top/bottom) pinned to the scroller's visible rect - place them in a `position: relative` wrapper around `.weekBoardScroller` (not inside the scrolling content). Reuse `.weekEdgeZone` / `.weekEdgeZoneActive` styling patterns (chevron + tint); `pointer-events: none`; `z-index: 40`. Import `ArrowUp`/`ArrowDown` from `@phosphor-icons/react` for the Y bands.
8. **Reduced motion** (AR-12): functional scrolling is never disabled; gate only decorative transitions (tint/chevron fades) behind `@media (prefers-reduced-motion: reduce)` in CSS.
9. **Tests** (extend `WeekViewDragNav.test.tsx`):
   - Fake timers + manual rAF pump (a helper that repeatedly invokes captured rAF callbacks).
   - Hovering the right band advances mocked `scroller.scrollLeft` toward the clamp over pumped frames; deeper pointer -> larger per-frame delta (speed ramp).
   - Clamped ends apply zero delta while the loop stays alive (loop id unchanged).
   - External payload: begin a drag with only MIME types set on the fake `DataTransfer` (component state null) -> loop starts anyway (AR-4).
   - Stop on `drop`, `dragend`, board `dragleave`; cancel on unmount; resize across the boundary mid-loop stops cleanly with no further frame effects (AR-10).
   - Flip suppression: while overflowing, hovering the far-left band never schedules a week change.

**Acceptance:** Gates pass. Manual check (matrix items 1, 2, 7, 8 of the QA checklist): drag toward the right edge scrolls the board; release applies the drop; extreme-edge hold clamps without runaway; bank-meal drag engages auto-scroll despite null initial payload.

> **>>> CHECKPOINT 2 - HARD STOP FOR USER REVIEW.** This is a mandatory pause (Global Rule 8). Present the Phase 2-4 diff summary, gate outputs vs baseline, and manual-check results for Phases 2-4. Pay particular attention to the auto-scroll engine's ref/state discipline and stop-condition coverage. Do NOT begin Phase 5 until the user explicitly approves.

---

## Phase 5: Insertion Caret Preview + Shared Midpoint Helper (C4)

**Objective:** Show above/below insertion feedback while hovering a meal card, matching drop-time math; extract the midpoint formula for reuse.

### Tasks

1. **New file `src/renderer/components/meal-plan/dragPreview.ts`**:
   - Export `isInsertAfterPointer(clientY: number, rect: DOMRect): boolean` returning `clientY > rect.top + rect.height / 2` (extracted from ~836-838).
2. **WeekView.tsx**:
   - Card `onDragOver` (~809-831): after the existing guards, compute `const insertAfter = isInsertAfterPointer(event.clientY, event.currentTarget.getBoundingClientRect())` and store it beside the target key - add `dropInsertAfter` state (boolean | null), set together with `setDropTargetKey(mealTargetKey)`.
   - Clear `dropInsertAfter` wherever `dropTargetKey` is cleared (card `onDragLeave`, `clearDragState`, `scheduleClearDragState` path). Same-value setter bails are acceptable churn-wise (AR-5 note).
   - Drop handler (~833-854) keeps recomputing from the final event via the helper - the stored value drives visuals only.
   - Render inside `.weekMealCardShell` (when `dropTargetKey === mealTargetKey && dropInsertAfter !== null`): a single `aria-hidden` div with classes `slotInsertCaret` plus `slotInsertCaretTop` or `slotInsertCaretBottom`. CSS: 2px accent line + triangle pseudo-element pinned to shell top/bottom; **`pointer-events: none`** mandatory (AR-7); `z-index` above card content but below sticky layers.
3. **DayView parity**: adopt `isInsertAfterPointer` for DayView's equivalent midpoint math (locate by searching `height / 2` in `DayView.tsx`). This also resolves the pre-existing `DayView.tsx:464` `CSSProperties` tsc error if the touched import block allows; if unrelated, leave the baseline error alone.
4. **Tests**:
   - Fire `dragOver` on a card with a stubbed rect: upper-half Y -> caret node has the Top class; lower-half -> Bottom class; `dragLeave` removes it; caret element/class carries pointer-events none (class-presence assertion).

**Acceptance:** Gates pass. Manual check (matrix item 6): hovering top vs bottom half of a card previews above/below caret consistent with eventual drop order; drop order itself unchanged.

---

## Phase 6: Single-Meal Drag Ghost + Clipped-Edge Fades (C5)

**Objective:** Visual parity between single and multi-meal drags, plus persistent hints of clipped content tied to the Phase 2 `canScroll*` state and Phase 4 band activity.

### Tasks

1. **Extend `dragPreview.ts`** with imperative DOM builders extracted from `onDragStartSlot` (~459-488), keeping the create-on-body + `setDragImage` + double-rAF removal pattern:
   - `showSlotDragPreview(dataTransfer, { title, namesLine, metaLine })` - used by `onDragStartSlot` unchanged in content.
   - `showMealDragPreview(dataTransfer, { name, subTypeName })` - single-meal ghost (name + optional sub-type line), attached with `setDragImage(preview, 16, 16)`.
   Both reuse the existing `slotDragPreview*` CSS classes; add a `mealDragPreview` variant class if sizing differs. No React state involved.
2. **Wire `onDragStartMeal`** (~408-426) to call `showMealDragPreview` after setting the payload.
3. **Clipped-edge fades**: in the scroller wrapper from Phase 4, render four overlay divs (top/bottom/left/right) with gradient fades toward the clipped side; visibility driven by the corresponding `canScroll*` boolean (hidden when nothing clipped); `pointer-events: none`; z-index 40. During an active drag, a band that is currently engaged (band-active state from Phase 4) intensifies its adjacent fade and shows a chevron (ties C1 feedback together).
4. **Reduced motion**: fade/chevron transitions minimized under `prefers-reduced-motion` (same media-query treatment as Phase 4).
5. **Tests**:
   - Ghost: `dragStart` on a single meal creates a preview node appended to `document.body`, removed after pumping two frames; multi-slot path produces the same class usage through the shared helper (assert identical class names on both paths' nodes).
   - Fades: stubbed `canScroll*` states toggle the correct overlay classes; engaged band adds the intensified class.

**Acceptance:** Gates pass. Manual checks (matrix item 4 + fades rows): single meals show a readable custom ghost; scrolling reveals left/right/top/bottom fades exactly where content is clipped and nowhere else.

---

## Phase 7: Test Completion, Regression Sweep, Manual QA Handoff

**Objective:** Close out the spec's testing plan and produce the manual-QA evidence.

### Tasks

1. Complete any remaining `WeekViewDragNav.test.tsx` cases from the spec's Testing Plan not yet covered in earlier phases; re-check each maps to an AR mitigation:
   - Mode gate, auto-scroll X/Y advance/clamp/stop, speed ramp, external payload trigger, caret classes + pointer-events, ghost lifecycle, structure/sticky presence assertions.
2. Run the full suite: `npm test` (all suites, not just new ones), `npm run lint`, `npx tsc --noEmit -p tsconfig.web.json` diffed against the Phase 0 baseline (only improvement allowed, no new errors).
3. Grep sweep for leftovers: no debuggers/console logs added; no unused exports in `dragPreview.ts`; no dead CSS classes introduced.
4. **Manual QA checklist execution** (spec's 10-point list; requires a human at real viewports - prepare the branch/summary so a tester can execute it directly):
   - Viewports: 1440x900, 1024x768 (overflow boundary), 768x1024 portrait, 375x667, 390x844; Windows display scaling 100%/125%/150%.
   - Items 1-10 verbatim from the spec (edge auto-scroll + drop, extreme-edge clamp, 800ms single flip on wide, pinned labels + shadows + no seams, header pinned with today column highlight, caret halves match drop order, bank-meal auto-scroll with null payload, resize-boundary mid-drag stability, keyboard focus rings above sticky layers, reduced-motion behavior).
5. Summarize in the PR description: phases completed (including both checkpoint approvals), deviations from spec, known deferred items (future-work list from spec; AR-14 touch-target debt flagged as pre-existing).
6. **Final handoff**: leave the complete change set UNCOMMITTED in the working tree per Global Rule 9. Provide the user with: final gate outputs vs baseline, a phase-by-phase map of the changed files (to make the single large commit diff reviewable), and the filled-in manual QA checklist results. The user performs the single commit after QA passes.

**Acceptance:** All automated gates clean vs baseline; QA checklist executed and results recorded; working tree left clean-of-commits and ready for the user's single commit; feature complete per spec scope.

---

## Risk Notes Per Phase

| Phase | Primary risk | Mitigation |
| --- | --- | --- |
| 1 | Layout drift from grid restructuring | Structure-only change; compare screenshots vs baseline before proceeding |
| 2 | Desktop feel change from internal scrollbar (AR-9) | Clamp guarantees >= 3 rows; `overscroll-behavior: contain`; flag in PR summary |
| 3 | Stale zone rects after profile/meal-type changes | Existing `useLayoutEffect` deps (`date`, `rowMealTypes.length`) retained + ResizeObserver |
| 4 | Re-render storms / stuck loops | Strict ref discipline; stop-condition matrix implemented exhaustively; AR-10 test |
| 5 | Caret intercepting drag events breaking drops | `pointer-events: none` asserted in tests; drop math unchanged |
| 6 | Drag image flicker | Preserve double-rAF removal pattern exactly as today |
| 7 | Silent jsdom false-confidence (AR-13) | Manual QA treated as a release gate, not optional polish |
