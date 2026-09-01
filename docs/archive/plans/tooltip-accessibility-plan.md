# Plan: Reusable Control Tooltip and Button Accessibility Audit

> Status: Revised against the renderer as of v1.2.5. This revision supersedes the original session-memory version written alongside `icon-upgrade.md`. The Phosphor icon sweep is implemented (see `docs/reports/2026-08-13-phosphor-icon-system-implementation-report.md`), so this plan now builds on its outcomes instead of preceding them. An adversarial review pass on 2026-08-25 re-verified the baseline table against source and resolved the open contract decisions recorded under Resolved Decisions.

## Objective

Add a shared rendered tooltip primitive for icon-only and unfamiliar controls using `@radix-ui/react-tooltip`, following the repository's existing Radix wrapper pattern (`alert-dialog.tsx`, toast). Add a shared primitive under `src/renderer/components/ui/tooltip.tsx`, mount one provider at the renderer root, and keep tooltip content supplementary to visible labels and accessible names. Complete the remaining named-control accessibility gaps the icon sweep did not close.

Tooltips are required for icon-only or unfamiliar controls, but are not added redundantly to every clearly labeled button. The style guide's deferred-tooltip policy (`docs/STYLE-GUIDE.md`, "A rendered control-tooltip primitive is deferred until its interaction contract is owned") is replaced by this contract once implemented.

## Current Baseline (verified findings)

| Finding | Evidence | State |
|---|---|---|
| No shared tooltip primitive or `@radix-ui/react-tooltip` dependency | `package.json` dependencies; no `src/renderer/components/ui/tooltip.tsx` | Open |
| Radix wrapper pattern established | `alert-dialog.tsx` + `@radix-ui/react-alert-dialog`, `@radix-ui/react-toast`, `@radix-ui/react-slot` | Context |
| `Button` owns variants only; no tooltip or icon-only accessibility contract | `src/renderer/components/ui/button.tsx` | Open (by design; see decisions) |
| Title-only icon controls largely fixed during the Phosphor sweep | `ItemRow.tsx`, `prep-lists.tsx`, `WeekView.tsx`, `meal-plan.tsx` undo/redo, and app-shell window controls all carry `aria-label` with supplemental `title` | Residual audit only |
| `TrashDropZone` semantics repaired | `role="button"`, `aria-label="Drop meal to delete"`, visible text label, `tabIndex={-1}` drop target | Closed |
| Settings section tabs use full tab semantics | `settings.tsx` tab strip: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, roving `tabIndex`, arrow-key handler | Closed |
| Heatmap cells have structured a11y metadata separate from control tooltips | `accessible-heatmap-cell.tsx` (`dateLabel`, `ariaLabel`, `tooltipText`) plus themed chart tooltips from v1.2.2 Phase 5 | Closed (stays out of scope) |
| `ToggleSwitch` still lacks an accessible name | `ToggleSwitch.tsx` renders `role="switch"` + `aria-checked` with no label association; `ToggleRow` in `settings.tsx` renders label text as plain `div`s with no `id`/`aria-labelledby` link | Open |
| `ListsSidebar` still nests interactive controls | Favourite `<button>` inside a `div role="button"` row (`ListsSidebar.tsx`) | Open |
| Recipe selection checkboxes remain unlabeled | `RecipeCard.tsx` selection `<input type="checkbox">` has no accessible name; favourite/delete buttons already carry recipe-specific labels | Open |
| QA helper checks attributes, not computed names | `expectNamedControl` in `src/renderer/test/qa/browser-baseline.ts` derives names from `aria-label` + `placeholder` only (also flagged by `icon-upgrade.md` revisions); the helper currently has no call sites outside its definition | Open |
| Disabled-control explanations are hover-only via native `title` | Settings "Show QR code" (`title="Enable LAN API and browser UI, …"` when disabled), ListEditor "Send to Telegram" (`title="Coming soon…"`), DuplicateMealModal day/type targets carry `title={buttonLabel}` as their only explanation of selectability, and `prep-lists.tsx` Move up/down plus its drag handle carry conditional titles ("Reorder only in Manual sort") while disabled | Open |
| Meal Bank action buttons repeat generic names without meal context | `MealBankSidecar.tsx` renders Up/Down/Edit/Duplicate/Remove and meal-type schedule buttons per banked-meal card with no meal-specific name (drawer toggle and add buttons are named correctly) | Open |
| Recipe step reorder controls are hover-only and unnamed handle | `AddRecipeModal.tsx` step move up/down buttons render at `opacity-0 group-hover:opacity-100` with no focus-visible reveal; the step drag handle is a plain `div draggable` with `title` only | Open |
| Week-view profile information is title-only | `WeekView.tsx` profile chip exposes range/description solely through a native `title` on a non-interactive span | Open |
| Established icon controls sit below minimum hit areas | `RecipeCard.tsx` favourite/edit/delete render at `h-4 w-4` (16px); week-view slot actions and `AddRecipeModal` step movers render at `h-7 w-7` (28px) | Open |
| `CookingMode` bypasses the shared modal contract | `CookingMode.tsx` renders a fixed `z-[700]` overlay launched from `RecipeDetail.tsx` with no focus trap, focus restore, or Escape close, and does not use `ModalShell` | Open |
| Verified-clean surfaces (audit effort can be targeted) | Shopping route controls all visibly labeled ("Done", "Back", "Mark All Complete", item rows); `DropIntentPopover` actions visibly labeled; `connection-banner` announces via `role="alert"`; app-shell hamburger/window controls named | Context |
| `PersonaGrid` has no live consumer | Only self-references found; treated as legacy per `icon-upgrade.md` inventory decision | Legacy checkpoint |

## Scope

### In scope

- A reusable tooltip primitive with hover, keyboard focus, escape dismissal, portal rendering, collision-aware placement, reduced motion, dark/custom themes, and semantic theme tokens.
- Remaining named-control fixes: `ToggleSwitch`/`ToggleRow` labeling, `ListsSidebar` nesting, `RecipeCard` selection checkbox names.
- Hit-area remediation for established icon controls (invisible expansion, not visual redesign).
- `CookingMode` migrated onto `ModalShell` so it joins the owned portal/focus/Escape contract.
- Computed-accessible-name coverage in the QA helpers.
- Audit of surfaces added since the original plan (see below).

### Out of scope

- Recharts chart tooltips and heatmap tooltip surfaces (themed and tested separately).
- QR SVG output, user-entered persona emoji, color swatches, and packaged branding.
- Backend behavior, API contracts, persistence, and database changes.
- Reintroducing tooltips on clearly labeled controls or making any workflow depend on hover text.

### Surfaces added since the original plan (must join the audit)

- **Connect redesign** (`eed12f2`): host/port fields, shared `SegmentedCodeInput` primitive, and token show/hide toggle (`aria-label` + `aria-pressed`). Verify segmented entry works for keyboard, screen reader, and touch without tooltip dependence.
- **Multi-client live sync** (`1373652`): connection/sync status surfaces. Status information must not be hover-only.
- **PWA pairing codes and auto-renew** (`9f44d58`, `e03e6d4`): Settings pairing UI including `LanQrCodeModal` ("Pair a trusted device") and renewal controls; verify code display/renew actions are labeled and touch-reachable.
- **Meal-plan week view drag navigation** (`e972960`, `b63d7e4`, `14b0492`): sticky panes, wall-push week flip, drag scroll bands, slot action rows (duplicate/add/more/drag handles), and `SlotManagerModal` with in-modal drag-to-reorder. Drag handles need keyboard alternatives and named controls; hover-revealed actions must appear on focus.
- **Print/export menu modal** (`MenuPrintExportModal`) and other newer modals: tooltip placement and dismissal inside `ModalShell`.
- **New shared primitives**: `ModalShell` (owns portal/focus/close contracts — the tooltip provider must not fight its stacking), `PageHeader`, `SegmentedCodeInput`, `AccessibleHeatmapCell`, `route-error-state`.

## Resolved Decisions

Decisions marked *(review)* were resolved by the 2026-08-25 adversarial review pass against source.

- Use `@radix-ui/react-tooltip`; add the dependency via npm so `package.json` and lockfile stay synchronized.
- *(review)* One provider mounted in `main.tsx`, wrapping `RouterProvider`, so all three layout trees inherit it (`PublicBrowserLayout` for `/connect`, the config-not-ready fallback, and the authenticated layout). Isolated component tests mount the same provider through a shared test util. The shared wrapper lives in `src/renderer/components/ui/tooltip.tsx` alongside `icon.tsx` and `alert-dialog.tsx`.
- Tooltip text never becomes an accessible name and never duplicates visible button text. Icon-only controls must already pass the computed-name contract before receiving a tooltip.
- Tooltips trigger on pointer hover and keyboard focus, dismiss on Escape and blur, render through a portal, and must layer correctly above `ModalShell` overlays when triggered inside modals.
- *(review)* Escape stacking: when a tooltip is open inside a `ModalShell` dialog, the first Escape dismisses only the tooltip; a second Escape closes the dialog. `ModalShell` listens for Escape on `window`, so this ordering must be implemented and verified deliberately, not assumed from Radix defaults.
- *(review)* Describedby policy: wire `aria-describedby` whenever the tooltip carries information unavailable elsewhere (disabled-reason explanations); skip it when the tooltip merely mirrors an icon-only control's accessible name, so screen readers do not announce the same text twice while the tooltip is open.
- *(review)* Disabled triggers use `aria-disabled="true"` plus a click guard instead of the native `disabled` attribute, keeping them focusable so focus-triggered tooltips and `aria-describedby` announcement actually reach assistive tech. Affected controls: settings "Show QR code", ListEditor "Send to Telegram", DuplicateMealModal targets, and prep-lists Move up/down (with the drag handle's manual-sort explanation). `Button` itself stays presentational; call sites own the conversion.
- Touch workflows must not depend on tooltips; icon-only controls on narrow layouts keep visible labels or stable accessible names instead.
- Keep `Button` in `button.tsx` focused on styling and focus behavior; do not force tooltip props onto every button. Callers opt in.
- *(review)* Minimum hit areas — 32px for compact icon controls, 40px for standard icon buttons — are enforced globally by the QA helpers. Existing violations are remediated in this plan via invisible expansion (padding or pseudo-element hit zones), preserving current glyph sizes and layouts.
- *(review)* `ToggleRow` associates its label with the switch through `aria-labelledby` and element `id`s (`ToggleSwitch` gains optional id/label-id props); no restructuring of settings row markup beyond that association.
- *(review)* The WeekView profile chip surfaces range/description as visible or visually-hidden-but-perceivable text associated with the chip; the chip gains no tab stop, and the native `title` stops being the sole carrier.
- *(review)* `CookingMode` migrates onto `ModalShell`, inheriting portal rendering, initial focus, the focus trap, focus restore, and Escape close, and dropping its bespoke fixed `z-[700]` overlay.
- *(review)* QA helper semantics roll out big-bang in Phase 2: every existing route QA suite moves to computed accessible names before component fixes begin, so later phases fail loudly on regressions.
- *(review)* jsdom lacks `ResizeObserver` and `PointerEvent`, which Radix Tooltip positioning requires; the renderer test setup gains these polyfills/mocks before the focused tooltip suite lands.
- `PersonaGrid` stays legacy unless the phase-0 inventory finds a live consumer; its nested-button issue is only fixed if revived.
- Heatmap/chart tooltip systems remain separate visualization behavior and do not migrate to the control primitive.

## Implementation Phases

### Phase 0: Baseline and contract

1. Inventory buttons and button-like controls across the established eleven-route QA order (`/connect`, `/`, `/meal-plan`, `/recipes`, `/recipes/:recipeId`, `/grocery-list`, `/grocery-list/shop/:id`, `/prep-lists`, `/prep-lists/prep/:id`, `/stats`, `/settings`), prioritizing the newly added surfaces listed above. Measure hit areas during the inventory to seed the remediation list.
2. Classify controls as visible-label, icon-only, unfamiliar, decorative, visualization, user content, or drag-only.
3. Record the tooltip policy, accessible-name rules, touch/focus behavior, and hit-area targets as the style-guide delta for `docs/STYLE-GUIDE.md`.

### Phase 1: Reusable tooltip primitive

4. Add `@radix-ui/react-tooltip`; create the shared wrapper and semantic theme styling; mount the single provider in `main.tsx` around `RouterProvider`.
5. Add `ResizeObserver`/`PointerEvent` polyfills or mocks to the renderer test setup so Radix Tooltip runs under jsdom.
6. Cover pointer hover, keyboard focus, escape/blur dismissal, portal rendering, collision-aware placement, reduced motion, dark mode, and custom-theme tokens; verify stacking above `ModalShell` overlays and that the first Escape inside a modal dismisses only the tooltip while the dialog stays open.
7. Add focused tests for `role="tooltip"`, the describedby policy (wired for disabled reasons, skipped when mirroring a name), focus/hover behavior, `aria-disabled` triggers, portals, modal layering, and tooltip-only-name prevention.

### Phase 2: Shared control contract

8. Upgrade `expectNamedControl` to computed accessible names (per `getByRole` name computation) and retrofit every existing route QA suite to the new semantics in one pass; the helper has no current call sites, so this happens before adoption spreads.
9. Add hit-area and tooltip-policy checks to the QA helpers and wire them into every suite; log all current violations as the remediation input for Phase 3.
10. Update the style guide and `docs/browser-page-qa-plan.md` once the primitive contract is settled.

### Phase 3: Highest-risk accessibility fixes

11. Associate `ToggleRow` labels with their switches via `aria-labelledby`/element ids so every `ToggleSwitch` instance gains a name.
12. Flatten `ListsSidebar` rows into a single interactive element (or restructure so the favourite button is not nested inside a `role="button"` container).
13. Give `RecipeCard` selection checkboxes recipe-specific accessible names.
14. Give Meal Bank card actions meal-specific names (`Edit ${meal.name}`, etc.) so repeated Up/Down/Edit/Duplicate/Remove and schedule buttons are distinguishable per card.
15. Convert hover-only disabled explanations to `aria-disabled` + click-guard + tooltip/`aria-describedby`: settings "Show QR code" prerequisites, ListEditor "Send to Telegram", DuplicateMealModal target selectability, and prep-lists Move up/down with the drag handle's "Reorder only in Manual sort" explanation.
16. Reveal AddRecipeModal step move up/down buttons on `:focus-visible` as well as hover; give the step drag handle a real control with a name (or rely on the named move buttons as the keyboard path).
17. Surface WeekView profile chip range/description as visible or visually-hidden-but-perceivable text associated with the chip; remove the title-only carrier without adding a tab stop.
18. Remediate sub-minimum hit areas via invisible expansion: `RecipeCard` icon trio (16px), `ListsSidebar` favourite button, week-view slot action cluster and AddRecipeModal step movers (28px), prep-lists icon buttons, and any further violations logged by the Phase 2 checks.
19. Migrate CookingMode onto `ModalShell`, inheriting focus trap, focus restore, and Escape close; drop its bespoke fixed overlay.
20. Sweep residual `title` usages (drag handles, `TopIngredientsList`, `RecipeSearchFilterCard`) to confirm each is supplemental, never sole.
21. Verify hover-revealed week-slot actions are reachable and visible on keyboard focus, and drag-only interactions have keyboard alternatives.

### Phase 4: Route-group audit

22. Meal Plan: period navigation, undo/redo, slot manager, week-view drag surfaces, Meal Bank sidecar card actions, DuplicateMealModal targets, meal-bank controls, modal actions, export/print, close buttons.
23. Recipes: favourite/edit/delete, selection, filter clearing, photo zoom, servings controls, cooking mode on its new `ModalShell` base, derived/history/export modals.
24. Grocery and Prep: audited together — same favourite, reorder, delete, expand, modal-close, and list-row patterns across sidebar, item rows, and prep detail (including the manual-sort reorder affordances).
25. Settings: persona, chip lists, pairing/QR renewal modals including the disabled "Show QR code" explanation path, toggles, tab strip, and theme controls.
26. Home and Stats: confirm chart/heatmap tooltips stay separate while their surrounding buttons stay named and information is not hover-only (including WeekView profile chips).
27. Connect, shopping, and prep detail: verify the redesigned connect inputs and segmented code entry under pointer, keyboard, and touch; shopping route is already verified clean and needs only regression coverage.

### Phase 5: Verification

28. Run focused tests after each route group; add tooltip and control-accessibility tests alongside existing shell, recipe, meal-plan, settings, and prep tests.
29. Run `npm run test`, `npm run lint`, `npm run build:web`, and `npm run build`.
30. Execute the browser QA route order at desktop and narrow widths in light, dark, and custom themes via `npm run dev:web`, checking pointer, keyboard, and touch behavior, focus rings, hit areas, modal layering, disabled-state contrast, and the first-Escape-tooltip rule inside modals.
31. Run an Electron smoke check for shell-owned behavior (window controls, drag regions) per the validation split established by `icon-upgrade.md`.

## Acceptance and Verification

- `@radix-ui/react-tooltip` present; one provider mounted in `main.tsx` covering every layout tree including `/connect`; `tooltip.tsx` wrapper covered by focused tests asserting role, the describedby policy, dismissal, and portal behavior.
- Every icon-only or unfamiliar control touched by this plan has a stable computed accessible name independent of tooltip text or native `title`, verified with `getByRole` name assertions.
- All route QA suites assert computed accessible names (not raw attributes); hit-area and tooltip-policy checks run in every suite.
- No icon control sits below the 32/40px hit-area minimums; remediation used invisible expansion without visual redesign.
- No native `title` is the sole carrier of a disabled control's explanation; affected controls remain focusable via `aria-disabled`, and their reasons reach keyboard and assistive tech through the tooltip/`aria-describedby` contract (settings "Show QR code", "Send to Telegram", DuplicateMealModal targets, and prep-lists reorder controls included).
- Repeated card-level action buttons (Meal Bank, RecipeCard) produce meal-specific computed names.
- `ToggleSwitch`, `RecipeCard` selection checkboxes, and `ListsSidebar` rows pass the updated QA helpers; nested interactive controls are gone.
- No workflow depends on hover or tooltip text; touch review of Connect, shopping, and week-drag surfaces confirms this.
- Tooltips render correctly inside `ModalShell` dialogs in both themes; the first Escape inside a modal closes only the tooltip, and dialogs never trap focus or lose their dismissal path.
- CookingMode runs on `ModalShell`: focus is trapped, restored on exit, and closed by Escape.
- Full test suite, lint, web build, and packaged build pass; browser route matrix executed after `build:web`; Electron smoke recorded.

## Handoff

This plan is ready for implementation. The review-pass decisions above are binding unless Phase 0 evidence contradicts them, in which case they are revised here before Phase 1 begins. Phase 0 should confirm the legacy checkpoints (`PersonaGrid` consumers, residual `title` sweep results) and the measured hit-area violation list before the primitive lands, and any contract change discovered mid-spike is revised here before the route-group batches proceed.
