# Spec: Week View Drag Navigation - Horizontal Auto-Scroll & DnD Improvements

## Decision Summary
- Overall disposition: ready for implementation handoff after adversarial revision (v2)
- Confidence: high; design grounded in live `WeekView.tsx` edge-zone code, drag payload contracts in `src/renderer/lib/calendar.ts`, breakpoint math from `meal-plan.module.css`, and page layout in `src/renderer/pages/meal-plan.tsx`
- Scope assessed: `src/renderer/components/meal-plan/WeekView.tsx`, `DayView.tsx`, `meal-plan.module.css`, `src/renderer/pages/meal-plan.tsx` (mount context), `globals.css` tokens, meal-plan test suites
- Selected approach ("scroll if you can, flip if you can't"):
  - When the week board **overflows** its scroller (tablet/phone/small windows): dragging near the *visible* edges of the scroll viewport auto-scrolls within the week (horizontal; vertical when internally scrollable). Week-change edge zones are suppressed.
  - When the board **fits** (wide desktop): current Monday/Sunday hover-to-flip-week edge zones behave exactly as today.
  - Frozen panes: sticky day-header row (vertical) + sticky first label column (horizontal), enabled by a structural grid rework and a bounded dual-axis scroll container (see AR-1/AR-2 - naive sticky fails here).
  - Insertion caret preview, single-meal drag ghost, clipped-edge fades.

## Current-State Evidence
- Edge zones are measured from Monday (`data-week-day-index='0'`) / Sunday (`data-week-day-index='6'`) header rects relative to the **board**, hit-tested in `getEdgeDirection` via `event.clientX - boardRect.left` ([WeekView.tsx](../../../src/renderer/components/meal-plan/WeekView.tsx) lines 249-278 measure at 312-363). Hover schedules a +/-7 week change after `EDGE_NAVIGATION_DELAY = 800ms` with a lock ref (lines 280-310); zones render as absolute overlays inside the board (lines 976-1018).
- `.weekBoardScroller { overflow-x: auto; overscroll-behavior-x: contain }`; `.weekBoard { display: grid; grid-template-columns: 128px repeat(7, minmax(128px,1fr)); min-width: 1040px }` ([meal-plan.module.css](../../../src/renderer/components/meal-plan/meal-plan.module.css) lines 1119-1131). Breakpoints shrink to 892px (<=900), 824px (<=768), 760px (<=480).
- The board is a **single flat grid**: corner cell, 7 headers, then per meal type one `.weekTypeCell` + 7 `.weekSlotCell`s are all direct grid items (~64+ children). No row wrappers exist today.
- `styles.calCard` wraps the view with `overflow: hidden` (line 153); WeekView mounts inside it in [meal-plan.tsx](../../../src/renderer/pages/meal-plan.tsx) lines 2116-2130. Page scrolls vertically at document level; `--app-titlebar-height: 64px` is defined in [globals.css](../../../src/renderer/globals.css).
- Drag payloads use MIME `application/x-local-recipe-book-meal-plan-drag` via `setMealPlanDragPayload` / `getMealPlanDragPayload` ([calendar.ts](../../../src/renderer/lib/calendar.ts) lines 91-110). Board capture handler recognizes *external* drags (bank meals) by sniffing `dataTransfer.types` because component state `draggedPayload` is null until the first board dragover (WeekView.tsx lines 509-534).
- Multi-meal slot drags build a custom drag image (`onDragStartSlot`, lines 428-489); single meals use the browser default ghost. Insert before/after is decided only at drop time from pointer Y (lines 836-838).
- Existing tests mock geometry with `getBoundingClientRect` stubs and a fake `DataTransfer` ([DragPromptPaths.test.tsx](../../../src/renderer/components/meal-plan/DragPromptPaths.test.tsx)); `ResizeObserver` is already feature-guarded in WeekView (lines 353-356).

## Proposed Changes

### C1: Drag-driven edge auto-scroll (X always, Y when scrollable)
- Intended outcome: users reach any day/row mid-drag by holding the dragged item near a visible edge of the week viewport; no week change occurs unless the whole week fits horizontally.
- In scope:
  - Overflow detection on the scroller per axis (`scrollWidth > clientWidth + 1`, same for height once C3 bounds its height), recomputed on resize (existing `ResizeObserver` hook point), scroll, and week change.
  - Viewport-relative bands pinned to the **scroller's** visible rect (never the board rect): `EDGE_SCROLL_BAND_PX = 72` horizontal; `EDGE_SCROLL_BAND_Y_PX = 64` top/bottom.
  - A single `requestAnimationFrame` loop shared by both axes, started when a recognized drag enters any band:
    - **Trigger condition must mirror `canHandleDragOver`** (AR-4): recognize payload via `getMealPlanDragPayload(event.dataTransfer)` OR MIME/text types present OR non-null `draggedPayload`. This covers bank-meal drags whose component state is still null.
    - Last pointer position stored in a **ref** updated by every board-capture `dragover` (AR-5/AR-6); the loop reads refs only. Speeds: linear ramp `EDGE_SCROLL_MIN_SPEED = 3` -> `EDGE_SCROLL_MAX_SPEED = 14 px/frame` (~840 px/s @60Hz) as the pointer approaches the edge; clamped at `scrollLeft/top = 0` and max; idle-but-running while clamped so resumption is instant.
    - Visual band-active flags set via state **only on enter/leave transitions** (AR-5), styled consistently with `.weekEdgeZoneActive` (chevron + tint).
  - Stop conditions: drop, `dragend`, board-capture `dragleave`, `isApplyingDrop`, cleared payload, unmount (cancel rAF id in the existing cleanup effect, lines 365-369), or mode loss via live resize crossing the fit/overflow boundary (AR-10).
  - While horizontal overflow is active, suppress rendering AND hit-testing of week-flip zones (gate `measureEdgeZones` + overlay render behind `!isOverflowingX`).
- Out of scope: momentum scrolling; pointer-event touch drag fallback (see AR-3/future work).
- Decisions: two-tier "inner scroll + outer sliver flips" rejected (sliver is off-viewport exactly when overflowing - recreates the original bug); manual chevrons rejected (require interrupting the drag).

### C2: Week-flip zones only when the board fits
- Intended outcome: wide-screen behavior unchanged; narrow screens get one unambiguous edge affordance.
- In scope:
  - Gate zone measurement/render on `!isOverflowingX`; no change to 800ms delay or lock semantics.
  - Zone geometry must be derived from body-row offsets rather than header rects once headers become sticky: `zone.top = firstRow.offsetTop - board.offsetTop` so measurement stays correct whether or not the header is currently stuck (AR-8 amends today's `mondayRect.bottom` approach).
- Decisions: PeriodNavigation arrows remain the universal week-change control; edge-flip is an accelerator.

### C3: Frozen panes - sticky day-header row + sticky first label column (structural)
- Intended outcome: the weekday/date/profile header stays visible during vertical scrolling; the Meal/type label column stays visible during horizontal scrolling.
- In scope:
  - **Structural rework of `.weekBoard`** (required - AR-1): split the flat grid into stacked row containers sharing one column template via a custom property:
    ```
    .weekBoardScroller   /* overflow: auto; bounded max-height (below) */
      .weekBoardHeader   /* display:grid; grid-template-columns: var(--week-board-cols);
                            position: sticky; top: 0; z-index: 30 */
        .weekBoardCorner /* position: sticky; left: 0; z-index: 32 */
        .weekDayHeader x7
      .weekBoardBody
        .weekBoardRow    /* display:grid; grid-template-columns: var(--week-board-cols) */
          .weekTypeCell  /* position: sticky; left: 0; z-index: 20 */
          .weekSlotCell x7
    ```
    Rationale: a grid item's sticky movement is constrained to its grid area; today each cell's grid area equals its own size, giving zero slack - `left: 0` would do nothing (AR-1). Row wrappers make each first-column cell's containing block a full-width row, restoring slack. `--week-board-cols` replaces the four per-breakpoint `grid-template-columns` declarations (128px/108px/96px/88px variants) so breakpoints edit one property.
  - **Bounded dual-axis scroll container** (required - AR-2): `.weekBoardScroller` becomes `overflow: auto` with `max-height: calc(100dvh - var(--app-titlebar-height, 64px) - <nav/header allowance>)` (tune ~13rem during implementation; provide `vh` fallback for older engines). Reason: `overflow-x: auto` already computes `overflow-y` to `auto`, making the scroller the nearest scroll container for sticky purposes even today; without a real vertical scrollport, `position: sticky; top` can never engage against page scroll. Internalizing vertical scroll makes BOTH stickies functional and gives Y auto-scroll (C1) a surface. Keep `overscroll-behavior: contain`.
  - Z-order ladder: slot content (base) < label cells (z 20) < header row (z 30) < corner (z 32) < edge/auto-scroll overlays (z 40, `pointer-events: none`). All sticky surfaces need opaque backgrounds - verified safe: `--muted: #ede6d6` and `--card: #fffdf8` are solid tokens.
  - Elevation cue: toggle a soft right/bottom shadow class on sticky cells when content passes beneath, driven by the same `canScrollLeft/Right/Top` state as C5 fades.
  - Header accent bar (`.weekDayHeaderAccent`) and profile chips render inside the sticky header unchanged.
- Out of scope: Month/Day views; virtualization (row count is small).
- Decisions: JS transform-sync alternative rejected (fights compositor, jank risk). Desktop also gets the bounded height - consistent behavior across viewports beats special-casing; the clamp keeps >= 3 slot rows visible.

### C4: Insertion caret preview on meal cards
- Intended outcome: hover-over-card shows whether the drop lands above/below the hovered card, matching drop-time `insertAfter` math.
- In scope:
  - In card `onDragOver` (WeekView.tsx lines 809-831) compute `insertAfter` with the same midpoint formula used at drop (lines 836-838); store beside the target key (e.g., `dropInsertAfter` state keyed to `dropTargetKey`).
  - Render caret inside `.weekMealCardShell`: 2px accent line + triangle pinned to shell top/bottom; classes `slotInsertCaret`, `slotInsertCaretTop`, `slotInsertCaretBottom`; **must be `pointer-events: none`** so it never intercepts dragover/drop.
  - Clear via existing lifecycle (`onDragLeave`, `scheduleClearDragState`). Drop handler keeps recomputing from the final event - stored value drives visuals only (no state drift).
  - Extract midpoint helper to a new `dragPreview.ts` next to the views; DayView adopts it for parity.
- Out of scope: gap-position insertion beyond before/after of one card (drop model constraint).

### C5: Single-meal drag ghost + clipped-edge fades
- Intended outcome: parity between single/multi drags plus persistent hint of hidden days/rows.
- In scope:
  - Custom drag image for single meals (name + sub-type line), offset near cursor (`setDragImage(preview, 16, 16)`); extract DOM-building code from `onDragStartSlot` into shared `dragPreview.ts` helper used by both paths (and available to DayView later). Keep imperative create/remove with the existing double-rAF removal pattern.
  - `.weekBoardScroller` fades on each side where content is clipped, driven by `canScrollLeft/canScrollRight/canScrollTop/Bottom` booleans updated on scroll, resize, and week change; hidden when nothing clipped. Fades are overlay divs with `pointer-events: none`.
  - During active drags, engaged auto-scroll bands intensify their fade and show a chevron (ties into C1 feedback).
- Out of scope: changing multi-meal preview content.

## Viewport Support Matrix
Target devices verified against live breakpoint math (board min-width vs available width after page/card chrome ~32-64px):

| Check | Desktop >=1024px (1366x768, 1440x900) | Tablet 768-1024p portrait (iPad 768/820) | Phone 360-480px (iPhone SE 375, iPhone 14 390) |
| --- | --- | --- | --- |
| Active breakpoint | base or <=900 | <=768 | <=480 |
| Board min-width | 1040px (892 if <=900) | 824px | 760px |
| Overflow X expected | Only below ~1104px window (e.g., 1024 laptop -> ~48px hidden); 1440 fits | Yes (~56-90px hidden) | Yes (~385px hidden ~= 4 columns at rest) |
| Edge mode mid-drag | Flip zones when fitted; auto-scroll when slightly clipped | Auto-scroll | Auto-scroll |
| Sticky label col | Visible whenever clipped | Required (labels otherwise lost immediately) | Required; 72px left band overlaps 88px label column - intended |
| Sticky header row | Engages when bounded height clips rows (many meal types + notes) | Same; primary benefit | Same |
| Vertical auto-scroll | Rarely needed (rows usually fit) | Occasionally | Often (min-height 82px rows x N types exceed clamp) |
| Caret preview / ghost | Full | Full | Full visual; **drag gesture itself unavailable on touch (AR-3)** |
| Fades | Left/right only when clipped | Both axes | Both axes |
| Regression watch | Flip-zone timing unchanged (800ms/lock) | Band overlap with period nav? None (zones viewport-pinned inside scroller) | Touch targets: dup/add buttons ~22.7px < 24px WCAG 2.5.8 (pre-existing debt, AR-14) |

Per-viewport QA checklist (manual, all three sizes + Windows display scaling 100%/125%/150%):
1. Drag meal toward right edge -> board scrolls right; release over target day applies drop.
2. Hold at extreme right with more days hidden -> clamped, no runaway.
3. Wide screen -> hover Sunday quarter -> flips after 800ms exactly once (lock holds).
4. Scroll right 200px -> labels pinned, shadow under label column, no see-through seams.
5. Many meal types -> header row pinned while scrolling internally; today column highlight correct.
6. Hover top half vs bottom half of card -> caret above/below matches eventual drop order.
7. Drag bank meal onto far-right day -> auto-scroll engages even though `draggedPayload` was null pre-entry.
8. Resize window across 900px boundary mid-drag -> no stuck loop; mode switches cleanly.
9. Keyboard: tab through slots unaffected; focus rings visible over sticky layers.
10. Reduced-motion setting -> decorative fade transitions minimized; functional auto-scroll retained (documented decision AR-12).

## Adversarial Review Findings
| ID | Severity | Finding | Mitigation / spec impact |
| --- | --- | --- | --- |
| AR-1 | Blocker | `position: sticky` on the flat-grid cells cannot work: a grid item may only shift within its grid area, and every cell's grid area equals its own size (zero slack). Original C3 as written would ship dead CSS. | C3 rewritten around row-wrapper structure (`weekBoardRow`/`weekBoardHeader`) sharing `--week-board-cols`. |
| AR-2 | Blocker | `overflow-x: auto` computes used `overflow-y: auto`, so `.weekBoardScroller` is already the nearest scroll container for sticky purposes. With `height: auto` it never scrolls vertically -> `sticky; top` headers would NEVER engage against page scroll, silently. | C3 bounds scroller height (`max-height` w/ titlebar offset) making it a real dual-axis scrollport; stickies anchor to it. |
| AR-3 | High | HTML5 DnD does not fire from touch input (iOS Safari: none; Android Chromium: none). Entire drag feature - including today's flip zones - is inert on phones/tablets via touch. Not a regression, but expectations must be explicit. | Matrix marks phone drag N/A; tap-to-edit/add remain primary phone interactions; pointer-event drag system recorded under future work, not smuggled into this scope. |
| AR-4 | High | Auto-scroll triggered solely off `draggedPayload` state misses **external drags** (bank meals): state is null until the first board dragover, which is exactly when scrolling must start. | C1 trigger mirrors `canHandleDragOver` type-sniffing; covered by matrix check 7 + unit test. |
| AR-5 | Medium | Naive implementation sets React state per `dragover`/per frame -> re-render storms across ~64 cells during scroll retargeting. | Loop + speeds + pointer live in refs; state only for band-active enter/leave and `canScroll*` boolean flips. `dropTargetKey` churn acceptable (same-value setState bails). |
| AR-6 | Medium | `dragover` delivery cadence while the pointer is stationary is implementation-defined (Chromium refires as autoscroll moves content beneath; others throttle). A design that scrolls only inside the event handler stalls. | Ref-stored last-pointer design drives a continuous rAF loop independent of event cadence; tests pump frames manually. |
| AR-7 | Medium | Overlay z-conflicts: edge/auto-scroll bands (today z 3) would sit under new sticky layers unless raised; corner cell needs to beat header siblings; caret/fades must never intercept events. | Z ladder fixed in C3 (content < labels < header < corner < overlays 40); all decorative overlays `pointer-events: none`. |
| AR-8 | Medium | Today's `measureEdgeZones` derives `zone.top` from a header rect; once headers stick, a measurement taken mid-stick yields wrong zone tops (flip mode on wide screens). | C2 derives zone tops from first body row `offsetTop`; ResizeObserver on the board still triggers re-measure. |
| AR-9 | Medium | Bounded-height scroller changes desktop feel (internal scrollbar instead of growing the card) and interacts with the fixed meal-bank overlays; wheel-scroll chaining could feel trapped. | Clamp guarantees >= 3 slot rows visible; `overscroll-behavior: contain` prevents chaining; accepted trade-off for working frozen panes on ALL viewports (consistency > special case). |
| AR-10 | Low/Med | Live window resize across the fit/overflow boundary mid-drag flips modes; stale rAF loop or stale `edgeZones` could persist. | Mode loss added to C1 stop conditions; resize handler re-runs detection synchronously; cleanup effect cancels rAF id. |
| AR-11 | Low | `scrollLeft/scrollTop` persist numerically across week changes (same element), but the today column may land off-screen after navigation. | Accepted for v1 (current behavior); optional snap-to-today listed in future work. |
| AR-12 | Low | Auto-scroll is user-intent motion; `prefers-reduced-motion` should not disable the feature (it is the only way to reach days mid-drag). | Functional scroll kept; decorative transitions (fade/chevron) gated behind reduced-motion media query. |
| AR-13 | Medium | jsdom has no layout engine: `getBoundingClientRect` returns zeros, no real sticky/scroll behavior; tests can silently assert nothing. | Test plan uses rect stubs (existing harness pattern), asserts classes/attributes/state transitions, pumps rAF with fake timers, mocks `ResizeObserver`; sticky geometry itself is manual-QA only (checklist). |
| AR-14 | Low | Pre-existing accessibility debt adjacent to this work: duplicate/add icon buttons ~22.7px (< WCAG 2.5.8 24px minimum) at the 480px breakpoint. | Out of scope; flagged so it is not mistaken for a regression introduced by the resize work. |
| AR-15 | Low | RTL: all band/sticky math assumes LTR (`left`, positive `scrollLeft`). App is LTR-only today. | Assumption recorded; revisit if RTL theming lands. |

## Testing Plan
- New `WeekViewDragNav.test.tsx` modeled on `DragPromptPaths.test.tsx` (jsdom, fake `DataTransfer`, rect stubs, `vi.useFakeTimers` + manual rAF pump, `ResizeObserver` mock):
  - Mode gate: stub `clientWidth/scrollWidth` -> flip-zone overlays absent when overflowing, present when fitted (AR-1 regression guard for C2 gating).
  - Auto-scroll X/Y: hovering a band advances mocked `scrollLeft`/`scrollTop` toward clamp; stops on drop/dragend/dragleave/unmount; resumes nothing after mode loss via resize (AR-10).
  - Speed ramp: deeper pointer position -> larger per-frame delta; clamped ends apply zero delta while loop stays alive.
  - External payload trigger: begin drag with only MIME types set (state null) -> loop starts (AR-4).
  - Caret preview: dragOver upper/lower half renders top/bottom caret class; cleared on dragLeave; caret node has `pointer-events: none` class applied (AR-7).
  - Ghost: preview node created on dragStart, removed next frame; shared helper reused by slot path (assert identical class usage).
  - Structure: header row wrapper + row wrappers exist with `data-*` hooks; sticky classes present on corner/typeCell/header (AR-13 - presence assertions only).
- Manual QA: the 10-point per-viewport checklist above at 1440x900, 1024x768, 768x1024, 375x667, 390x844, plus Windows scaling 125%/150%.

## Clarifications
- Asked and answered:
  - Narrow-screen edge behavior: auto-scroll within the week; week flip only when the full week fits (user-selected).
  - Additional scope: sticky first column, sticky day-header row (added this revision), insertion caret preview, drag ghost + visual polish (user-selected).
- Still needed: none blocking.
- Future work (explicitly out of scope):
  - Pointer-event based drag system for touch devices (unblocks AR-3 properly).
  - Keyboard-accessible meal moving (HTML5 DnD is not keyboard operable).
  - Snap-to-today column on mount/week change (AR-11).
  - ARIA live region announcing visible day range while auto-scrolling.
  - Month/Day view adoption of shared `dragPreview.ts` ghost helpers and Y auto-scroll.
