# Phosphor Icon System Implementation Report

## Goal and Scope

Migrated renderer UI-facing icons from Lucide, inline UI SVG, CSS-drawn marks,
Unicode action glyphs, and app-authored presentation emoji to
`@phosphor-icons/react`. The implementation preserves workflows, labels,
computed accessible names, Electron shell behavior, user-entered persona
emoji, data visualization marks, QR output, and packaged branding.

Rendered control tooltips remain out of scope. The shared icon wrapper owns
visual defaults only; accessibility semantics remain at the calling control.

## Plan and Execution Model

The approved plan was executed as mixed sequential work:

1. Baseline and authoritative inventory — completed first.
2. Renderer icon contract — completed before route migration.
3. Representative spike — completed and validated before owner batches.
4. Route-owner migration — executed in plan order: shared shell, Meal Plan,
   Grocery/Prep, Recipes, then Home/Settings and remaining Connect/Stats.
5. Documentation and release validation — completed after source migration.

No phases were run in parallel because each migration batch depended on the
preceding icon contract and focused validation.

## Subagent Assignments

Implementation phases were delegated to `general-implement-subagent` using
GPT-5.6 Luna as requested. The main GitHub Copilot agent orchestrated phase
ordering, reviewed outputs, ran phase gates, repaired a residual Meal Plan
import and reorder-glyph issue, and owned final documentation/reporting.

## Changes by Phase

### Phase 0: Baseline and Inventory

- Confirmed existing worktree changes were user-provided and preserved.
- `npm run lint` passed at baseline.
- Baseline `npm run test` had 267 passing tests and one existing failure in
  `throttling-ui.qa.test.tsx` caused by a missing Router context.
- Inventory found four renderer Lucide import sites, inline UI SVG candidates,
  CSS Electron window marks, title-only controls, and Grocery/Prep emoji filter
  presentation.
- Verified `PersonaGrid` has no live renderer consumer and was left intact.
- Classified persona emoji, QR SVG, charts, heatmaps, dots, swatches, and
  packaged branding as explicit exceptions.

### Phase 1: Renderer Icon Contract

- Added `@phosphor-icons/react` and synchronized npm manifests.
- Added `src/renderer/components/ui/icon.tsx` with visual-only defaults:
  18px, regular weight, and `currentColor`, plus ref/class forwarding.
- Added typed Grocery/Prep semantic icon keys and the renderer registry.
- Replaced quick-filter presentation emoji with semantic keys.
- Added wrapper and registry completeness tests.

Validation: focused icon tests passed (4 tests), lint passed, and
`npm run build:web` passed.

### Phase 2: Representative Spike

- Migrated AppShell Settings, menu, and Electron window controls while
  preserving platform branches, drag regions, sizing, and IPC behavior.
- Migrated Meal Plan period navigation.
- Migrated Grocery quick-filter and favourite affordances.
- Migrated RecipeCard favourite/edit/delete actions.
- Added semantic accessible-name and decorative-icon coverage.

Validation: 5 focused test files and 16 tests passed; `npm run build:web`
passed.

### Phase 3: Route-Owner Migration

- Migrated remaining Meal Plan actions, inline SVGs, reorder controls, drag
  affordances, print controls, and modal actions.
- Migrated Grocery and Prep row/list/shop/detail controls, stars, drag handles,
  reorder arrows, close/delete controls, and empty-state marks.
- Migrated Recipes modal, detail, filter, serving, photo, and reorder controls.
- Migrated Home dashboard accents and Settings collapsible/chip/modal controls.
- Confirmed Connect had no remaining actionable icon marks.
- Kept Stats multiplication-count labels as data labels.
- Removed `lucide-react` from `package.json` and `package-lock.json`.
- Added focused tests for title-only controls, optional RecipeCard actions,
  Grocery rows, quick filters, modal controls, and icon state behavior.

Validation by owner passed:

- Meal Plan: 8 files, 66 tests.
- Grocery/Prep: focused tests passed, including 6 tests in the owner gate.
- Recipes: 5 files, 22 tests.
- Settings/icon states: 9 tests.
- Lint passed for all touched owner surfaces and then for the repository.
- Scoped source audit found no remaining renderer Lucide imports or raw
  actionable icon glyphs.

### Phase 4: Documentation and Release Validation

- Updated the Iconography section of
  `docs/copilot-chef-style-guide.md` with the completed Phosphor contract,
  wrapper defaults, semantic registry boundary, explicit exceptions, and
  deferred tooltip policy.
- Added this implementation report.

## Validation Evidence

- `npm run lint`: passed.
- `npm run build:web`: passed.
- `npm run build`: passed for web, main, preload, and Electron renderer bundles.
- `npm run build:unpack`: passed, including electron-builder packaging of
  `dist/win-unpacked` and native dependency preparation.
- `npm ls lucide-react`: dependency absent.
- Global renderer source audit: only QR test SVG and Stats multiplication-count
  data labels remained; both are documented exceptions.
- `git diff --check`: passed during phase validation.

The final full suite completed with 280 passing tests and 2 failures in the
existing `src/renderer/pages/throttling-ui.qa.test.tsx` file:

- Home dashboard rate-limit test timed out.
- Recipes rate-limit test renders `RecipesPage` without a Router and throws
  from `useNavigate()`.

These failures are unrelated to the icon migration and were not changed.

Browser route screenshots and a live Electron window smoke run were not
available in this execution. The browser renderer and unpacked Electron
artifacts built successfully, but custom window controls, drag regions, and
runtime IPC should still receive manual smoke coverage before release.

## Unresolved Issues and Risks

- The two pre-existing throttling QA failures remain.
- Runtime browser route validation across all listed themes and widths remains
  a release follow-up.
- A live Electron launch and interaction check remains a release follow-up;
  packaging/build validation passed.
- No bundle-size claim is made because a pre/post `analyze:bundle` comparison
  was not captured.

## Final Status

The Phosphor renderer migration is implemented and passes the code-level,
focused test, lint, browser build, full Electron build, and unpacked packaging
gates. The planned exceptions are preserved and documented. Release status is
implementation-complete with the noted QA and manual runtime validation
follow-ups.
