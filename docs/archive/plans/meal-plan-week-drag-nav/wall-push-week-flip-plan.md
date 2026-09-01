# Implementation Plan: Wall-Push Week Flip (Restores Week-Swap During Drag)

Follow-up to [meal-plan-week-drag-nav](./meal-plan-week-drag-nav-plan.md). Approved interactively after Checkpoint 2 QA found week-swapping impossible on horizontally overflowing windows.

## Decisions (user-approved)

| Question | Decision |
| --- | --- |
| Interaction model | **A: Wall-push escalation** - hold pointer in a left/right band while that axis is clamped -> flip fires |
| Hold duration | **500ms** at the wall (replaces legacy 800ms corner-zone delay) |
| Scope | **Unified** - wall-push replaces Monday/Sunday corner-quarter zones everywhere (fitted and overflowing) |
| Regression context | Confirmed narrow-window only (the designed C2 suppression); no hidden extra bug |

## Rationale

The parent plan suppressed Monday/Sunday corner flip zones whenever the board overflows horizontally (AR-8: they sat under the sticky label column and mis-fired spatially), leaving no mid-drag week navigation on narrow windows. Auto-scroll alone cannot cross weeks. Wall-push unifies both intents under one gesture language:

- Pointer in an edge band with scroll room available -> auto-scroll (existing behavior).
- Pointer in a left/right band while that axis is clamped at its wall -> hold 500ms -> flip one week, single-fire, locked until the pointer leaves the band or the drag ends.
- In fitted boards there is no scroll room, so the wall condition is instantly true - the same gesture works everywhere, which is what makes retiring the legacy corner zones safe.

## Changes

### WeekView.tsx

1. Constants: replace `EDGE_NAVIGATION_DELAY` (800) with `WALL_PUSH_FLIP_DELAY_MS = 500`.
2. Delete: `EdgeZone`/`EdgeZones` types, `edgeZones` state, `measureEdgeZones` layout effect + ResizeObserver wiring, `getEdgeDirection`, and the corner-zone overlay JSX block. The `[data-week-edge-zone]` contract disappears (tests migrate).
3. Keep and repurpose: `scheduleEdgeNavigation`, `clearEdgeTimers`, `clearEdgeNavigationState`, `edgeHoverDirectionRef/state`, `edgeNavigationLockedRef` - proven single-fire/lock machinery; timer now armed by wall detection instead of zone hit-testing.
4. `runAutoScrollFrame`: after clamping, detect walls:
   - `activity.left && scroller.scrollLeft <= 0` -> `scheduleEdgeNavigation("previous")`
   - else `activity.right && scroller.scrollLeft >= maxScrollLeft` -> `scheduleEdgeNavigation("next")`
   - else `clearEdgeNavigationState()` (disarm).
   Per-frame calls are cheap: direction state only changes on transitions; same-value setState bails.
5. `onBoardDragOverCapture`: simplify - any recognized drag starts the loop (no overflow gating); remove the overflowing-X early return and flip-suppression branch (zones are gone).
6. `updateScrollState`: drop the stop-loop-on-overflow-transition hook (AR-10 special case). With unified semantics there is no mode switch; every frame recomputes from live metrics.
7. Band overlays: add flipping style when the active band's direction matches `edgeHoverDirection` (left->previous, right->next); arrow switches to fill weight as escalation cue.

### meal-plan.module.css

1. Delete `.weekEdgeZone`, `.weekEdgeZoneActive`; move arrow filter rule to new `.weekScrollBandArrow`.
2. Add `.weekScrollBandFlipping`: stronger accent tint + accent icon color; covered by existing reduced-motion transition kill.

### Tests

- Migrate the semantic core of DragPromptPaths' three zone tests (cancel-below-threshold/invalid payload, single-fire-per-entry + direction change reset, cleanup on dragend/drop/unmount) into WeekViewDragNav as wall-push equivalents; delete the originals plus the obsolete geometry-guard test.
- Replace Phase 3 "overflow suppresses zones" and Phase 4 "far-left suppression" tests with wall-push versions (overflow now flips at the wall).
- New two-stage proof: right band with scroll room auto-scrolls and does NOT flip within 500ms of room; once clamped, flip fires.
- Rewrite AR-10 resize test: crossing the fit/overflow boundary mid-drag keeps the loop functional (no stuck states) instead of stopping it.

## Acceptance

- Gates clean vs baseline (npm test, lint, tsc web).
- Manual: wide window - hover left/right band 500ms flips (no scroll room); narrow window - drag toward edge scrolls, reaching the wall + 500ms flips once; releasing applies pending drops; leaving the band cancels.

## Out of scope

Vertical-axis flips, multi-week jumps, touch/pointer-drag integration (deferred items plan Item 3).

---

## Iteration 1 (user QA feedback): flip-back, stale-closure skips, deliberate re-arm

QA found three related issues: (1) after a flip, swinging to the opposite wall did nothing, so navigating back to the source week required detouring into the board's center; (2) flips occasionally landed on surprising weeks; (3) multi-week navigation only worked by fully exiting and re-entering the board.

**Root causes**

- `scheduleEdgeNavigation` checked the single-fire lock *before* the direction-change branch, so an opposite-wall swing was swallowed while the lock held.
- The auto-scroll loop recursively scheduled the closure it was born in. Every later flip computed from that render's stale `date`, producing wrong targets/inconsistent skips whenever the loop outlived a week change.
- Re-arm semantics were accidental rather than specified.

**Fixes**

1. Direction change overrides the lock: `scheduleEdgeNavigation` now unlocks when the requested direction differs from the armed one (same-wall holds stay locked - no runaway).
2. Loop freshness: frames are scheduled through `autoScrollFrameRef` so every step runs the current render's frame function with the current `date`.
3. Specified re-arm: holding the same wall never re-fires; leaving the band (72px excursion) disarms and a fresh 500ms hold re-arms; full board exit also resets. Multi-week stepping = repeated deliberate band exits or real week changes (which reset targets via fix 2).

**Flow note:** from a flipped-forward state at the right wall of an overflowing board, flipping back means swinging to the left edge: the board auto-scrolls across the columns first, then arms and flips at the left wall. Fitted boards arm instantly at both walls.

**Tests:** added "flips back to the source week from the opposite wall" (rerender advances the date like real usage) and "re-arms the same-direction flip after the pointer leaves the band"; both fail against the pre-fix implementation.
