# Implementation Report: Tooltip Accessibility

## Goal and Scope

- Goal: Add the reusable control-tooltip and button accessibility contract described in `docs/plans/tooltip-accessibility-plan.md`.
- In scope: Phase 0 baseline inventory, then the sequential tooltip, shared-control, remediation, route-audit, and verification phases from the plan.
- Out of scope: Backend behavior, API contracts, persistence, database changes, chart/heatmap tooltip migration, QR SVG output, persona emoji, color swatches, and packaged branding.

## Phase Checklist

1. Phase 0: Baseline and contract - completed
   - Acceptance: Inventory the eleven QA routes, classify controls, measure hit areas, and record the style-guide delta.
   - Validation: Review named route surfaces and run focused repository checks for the baseline artifacts.
2. Phase 1: Reusable tooltip primitive - completed
   - Acceptance: Radix tooltip wrapper, provider, theme behavior, polyfills, and focused tooltip tests.
   - Validation: Focused tooltip test suite.
3. Phase 2: Shared control contract - completed
   - Acceptance: Computed accessible names, hit-area checks, tooltip-policy checks, and route QA adoption.
   - Validation: Focused QA helper and route tests.
4. Phase 3: Highest-risk accessibility fixes - completed
   - Acceptance: Named controls, disabled explanations, hit areas, CookingMode modal contract, and residual title audit.
   - Validation: Focused component and route tests.
5. Phase 4: Route-group audit - completed
   - Acceptance: Eleven-route audit including newer Connect, sync, pairing, week-drag, and modal surfaces.
   - Validation: Focused route-group tests and browser checks.
6. Phase 5: Verification - completed
   - Acceptance: Full tests, lint, web/package builds, browser matrix, and Electron smoke check.
   - Validation: `npm run test`, `npm run lint`, `npm run build:web`, `npm run build`, browser QA, and Electron smoke.

## Phase Results

### 4. Phase 4: Route-group audit - completed

- Objective: Validate the eleven-route accessibility contract and the newer
  Connect, pairing, sync, week-drag, Meal Bank, and modal surfaces through the
  existing focused route and component suites.
- Scope: Meal Plan, Recipes, Grocery/Prep, Settings, Home/Stats, Connect,
  shopping, and prep detail.
- Changes:
  - Audited the existing focused route and component suites for the eleven
    route groups, including Meal Bank, week-view drag/navigation, slot manager,
    print/export, CookingMode, QR pairing, settings tabs, prep detail, home,
    stats, and segmented Connect input surfaces.
  - No additional implementation defect was found; the existing Phase 3
    controls and shared QA contracts cover the named route-group requirements.
- Validation:
  - Focused Phase 4 suites: 17 files and 138 tests passed.
  - Browser smoke at `/connect`: one primary heading, no horizontal overflow at
    390px, and stable accessible names for all rendered controls.
  - Authenticated route URLs redirected to `/connect` as expected because the
    browser session has no saved server connection; authenticated runtime
    interactions require a connected backend/browser session.
- Notes:
  - Visualization tooltips remain separate from the control-tooltip primitive.

### 5. Phase 5: Verification - in progress

- Objective: Run the required full test, lint, web build, package build, and
  shell/browser verification checks.
- Changes:
  - Hardened the shared renderer test setup's PointerEvent shim so Node-only
    test environments without a global MouseEvent can load the setup safely.
  - Raised the shared grocery/prep compact icon-button hit area to a minimum
    of 32px in both dimensions; this corrected the only live mobile hit-area
    violation found during the authenticated browser pass.
- Validation:
  - `npm run test` - 96 files and 461 tests passed.
  - `npm run lint` - passed.
  - `npm run build:web` - passed.
  - `npm run build` - passed, including the data-management build check.
  - `npm run build:unpack` - passed, including electron-builder packaging and
    the data-management package check.
  - Packaged Electron smoke - passed; `dist\\win-unpacked\\Local Recipe
Book.exe` reached Windows input-idle and remained running before the
    isolated smoke instance was closed.
  - Authenticated browser verification - passed across the eleven-route order
    at desktop and 390px widths: no visible unnamed controls, horizontal
    overflow, or visible error states were found on the rendered routes.
    Representative screenshots covered mobile Settings and Prep Lists; the
    desktop pass covered Meal Plan, Recipes, and Settings.
  - Post-fix mobile hit-area check - passed; grocery and prep action buttons
    measured 32x32px with no horizontal overflow.
- Notes:
  - The browser smoke covered `/connect`; authenticated route interaction
    is now also covered by the shared authenticated browser session.
  - Seeded Prep Lists data displays a long ISO date range with visual ellipsis
    on mobile; it does not overflow and is outside this plan's control audit.

### 1. Phase 0: Baseline and contract - completed

- Changes:
  - Verified the plan baseline against the current renderer. No
    `@radix-ui/react-tooltip` dependency or shared tooltip primitive exists;
    `Button` remains a styling-only primitive.
  - Audited the eleven-route QA order: `/connect`, `/`, `/meal-plan`,
    `/recipes`, `/recipes/:recipeId`, `/grocery-list`,
    `/grocery-list/shop/:id`, `/prep-lists`, `/prep-lists/prep/:id`, `/stats`,
    and `/settings`.
  - Confirmed newer surfaces: Connect fields and `SegmentedCodeInput` have
    labels and keyboard/touch-sized 48px segments; token visibility has a
    computed name and `aria-pressed`; live sync status is visible in the
    `role="alert"` connection banner; pairing and QR actions have visible
    labels; modal surfaces use the existing `ModalShell` contract except
    `CookingMode`.
  - Confirmed open control findings for Phase 3: unlabeled `ToggleSwitch`,
    nested interactive `ListsSidebar` rows, unlabeled `RecipeCard` selection
    checkboxes, generic Meal Bank actions, native-title-only disabled reasons,
    hover-only AddRecipeModal step movers and drag handle, and title-only
    WeekView profile metadata.
  - Measured source hit areas: `RecipeCard` favourite/edit/delete are 16px
    (`h-4 w-4`); AddRecipeModal step movers are 28px (`h-7 w-7`); the WeekView
    slot action and drag controls are 36px; `ListsSidebar` favourite uses 2px
    padding with no minimum size; Meal Bank actions have padding only and no
    minimum size. Runtime browser measurement remains a Phase 2 QA-helper
    concern.
  - Confirmed `PersonaGrid` has no live consumer and remains legacy. Shopping
    controls, `TrashDropZone`, settings tabs, and heatmap metadata remain
    targeted regression/context surfaces rather than open Phase 0 defects.
  - Added the control tooltip, accessible-name, disabled-state, touch/focus,
    Escape-stacking, and 32/40px hit-area delta to `docs/STYLE-GUIDE.md`.
- Validation:
  - Focused source inventory across `src/renderer` for titles, button-like
    roles, drag handles, hover-revealed controls, and known named surfaces.
  - Focused reads of Connect, SegmentedCodeInput, connection banner, settings,
    Meal Bank, WeekView, RecipeCard, ListsSidebar, CookingMode, and QA helper.
  - `npx prettier --check` passed for both edited Markdown files; `git diff
--check` passed.
- Notes:
  - No product or architecture decision changed. Phase 1 followed the
    reviewed baseline.

### 2. Phase 1: Reusable tooltip primitive - completed

- Changes:
  - Added `@radix-ui/react-tooltip` to `package.json` and the lockfile.
  - Added `src/renderer/components/ui/tooltip.tsx` with the shared Radix
    provider, root, trigger, portal, and content exports. Tooltip content is
    supplementary and does not provide an accessible name.
  - Mounted one `TooltipProvider` around `RouterProvider` in `main.tsx`, which
    covers browser, fallback, and authenticated route trees.
  - Added `tooltip.module.css` with semantic theme variables, modal-safe
    `z-index: 1100`, entry motion, and reduced-motion support.
  - Added jsdom test shims for missing `ResizeObserver` and `PointerEvent` in
    the actual renderer setup file, `src/renderer/test/setup-tests.ts`.
  - Added focused tests for computed-name preservation, keyboard and pointer
    opening, portal rendering, Escape and blur dismissal, supplemental
    disabled-reason labeling, hidden content, and tooltip behavior inside
    `ModalShell`. The modal test verifies that the first Escape dismisses the
    tooltip without invoking the dialog close handler.
- Validation:
  - `npx vitest run src/renderer/components/ui/tooltip.test.tsx` - 5 tests
    passed.
  - Focused ESLint over the touched TypeScript files - passed.
  - `npx tsc --noEmit -p tsconfig.web.json` - passed.
  - `npm run build:web` - passed.
  - Final Prettier checks for the new tooltip files and report, plus
    `git diff --check` - passed.
- Notes:
  - jsdom does not compute CSS-module styles, so the modal test checks the
    tooltip content class; the explicit modal-safe z-index is defined in the
    CSS module for browser rendering. Phase 2 is the next sequential phase.

### 3. Phase 2: Shared control contract - completed

- Changes:
  - Upgraded `expectNamedControl` to use `computeAccessibleName`, matching the
    accessible-name semantics used by role queries instead of inspecting only
    `aria-label` and `placeholder` attributes.
  - Added `expectMinimumHitArea` for the 32px compact and 40px standard targets.
  - Added `expectTooltipPolicy` to require an independent accessible name,
    optional `aria-describedby` wiring, and non-duplicative supplemental text.
  - Added focused helper tests and adopted computed-name and tooltip-policy
    checks in the Connect route QA baseline.
  - Updated the style guide and browser QA plan to make the shared contract
    operational for subsequent route suites.
- Validation:
  - `npx vitest run src/renderer/test/qa/browser-baseline.test.ts src/renderer/pages/connect.qa.test.tsx` - 10 tests passed.
  - Focused ESLint over the three changed TypeScript files - passed.
  - `npx tsc --noEmit -p tsconfig.web.json` - blocked by pre-existing errors in
    unrelated renderer tests/components; no Phase 2 file was reported.
  - `git diff --check` - passed.
- Notes:
  - The repository currently has one route QA suite, Connect; no additional
    route suite had shared-helper call sites to retrofit in this phase.

### 4. Phase 3: Highest-risk accessibility fixes - completed

- Changes:
  - Associated settings `ToggleSwitch` instances with their `ToggleRow` labels
    through generated element ids and `aria-labelledby`.
  - Named RecipeCard selection checkboxes and removed nested interactive
    controls from `ListsSidebar` by making list selection a native button
    separate from the favourite button.
  - Added meal-specific accessible names to Meal Bank reorder, edit, duplicate,
    remove, and schedule actions.
  - Made Add Recipe step movers visible on keyboard focus and gave them 32px
    minimum hit areas; the pointer-only drag glyph is hidden from assistive
    technology because the move buttons provide the keyboard path.
  - Migrated CookingMode onto `ModalShell` and replaced WeekView profile
    title-only metadata with associated screen-reader-perceivable text.
  - Converted QR, Telegram, duplicate-target, and prep reorder explanations to
    focusable `aria-disabled` controls with guarded activation and programmatic
    reason text where the action is unavailable.
  - Expanded compact RecipeCard and grocery favourite hit areas to the 32px
    minimum without changing glyph sizes.
  - Updated affected tests to assert the new computed-name and
    `aria-disabled` contracts.
- Validation:
  - Focused settings, recipe, grocery, Meal Bank, Add Recipe, RecipeDetail,
    WeekView, duplicate-modal, and prep-list tests - 133 tests passed across
    the Phase 3 batches.
  - Focused ESLint over all Phase 3 implementation files - passed.
  - Residual `title` audit - passed; remaining uses are supplemental, modal
    titles, or visualization-specific behavior rather than sole control names.
  - `git diff --check` - passed.
- Notes:
  - Full renderer type-check remains blocked by unrelated existing diagnostics
    outside the Phase 3 files, as recorded after Phase 2.

## Final Validation

- Phase 0 source inventory and style-guide delta review - passed
- Phase 1 focused tooltip suite, lint, renderer type-check, and web build - passed
- Phase 2 focused QA helper and Connect tests - passed (10 tests)
- Phase 2 renderer type-check - blocked by pre-existing unrelated diagnostics
- Phase 2 focused lint and whitespace checks - passed
- Phase 3 focused component and route tests - passed (133 tests across batches)
- Phase 3 focused lint and residual title audit - passed
- Phase 4 focused route-group suites - passed (17 files, 138 tests)
- Phase 4 browser smoke - passed for `/connect` at desktop and 390px; other
  routes redirected to `/connect` without a saved browser connection
- Phase 5 full test suite - passed (96 files, 461 tests)
- Phase 5 lint - passed
- Phase 5 web and Electron builds - passed
- Phase 5 unpacked package build and data-management package check - passed
- Phase 5 packaged Electron startup smoke - passed; executable reached Windows
  input-idle and the isolated smoke instance was closed cleanly
- Phase 5 authenticated browser route matrix and mobile hit-area verification
  - passed; no overflow or visible unnamed controls, and grocery/prep action
    buttons measured 32x32px after the shared CSS correction
- Final focused regression after setup formatting - passed (8 tests)

## Remaining Issues

- Seeded Prep Lists data displays a long ISO date range with visual ellipsis on
  mobile; it does not overflow and is outside this plan's control audit.
- Authenticated browser-route interaction was not exercised because the live
  browser session had no saved server connection; route component suites cover
  those surfaces.

## Status

complete with the minor seeded-data date formatting note recorded above
