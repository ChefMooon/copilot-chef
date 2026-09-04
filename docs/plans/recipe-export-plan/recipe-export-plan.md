---
title: "Recipe Detail Export and Print - Implementation Plan"
status: COMPLETED
current_phase: 5
created: 2026-09-04
last_updated: 2026-09-05
---

# Specification & Overview

### 1. Scope & Objective
- **Source provenance:** The approved specification was established in the preceding conversation through the Recipe Detail export impact assessment and decision-closure rounds. Supporting architecture source: `docs/plans/recipe-export-shared-architecture.md`. The user explicitly authorized using the conversation as the specification source.
- **Goal:** Add a single-recipe export and print workflow to `RecipeDetail` that produces a useful basic recipe document, supports user-controlled content and metadata selection through an Advanced section, and establishes reusable export mechanics for future recipe layouts.
- **In-Scope:**
  - Print/browser print and Electron PDF output.
  - Downloadable HTML, Markdown, and CSV output.
  - A recipe-specific presentation document model and formatters, separate from the legacy recipe JSON contract and data-management archive.
  - Basic recipe content: title/basic identity, description, ingredients, instructions, cook notes, servings, prep time, cook time, difficulty, and cuisine.
  - An Advanced section with grouped controls for description, ingredients, instructions, cook notes, basic metadata, source/tags, personal/status metadata, and lineage metadata.
  - Per-export selections that reset when the export workflow is reopened.
  - Exporting the currently visible serving and unit state from `RecipeDetail`.
  - Compact source/derived recipe references without recursive expansion.
  - CSV as a stable recipe-section row format, with selected groups determining emitted row types.
  - Shared renderer download helpers and reuse of existing binary response handling as described by the supporting architecture plan.
  - Focused formatter, component, platform, download, and regression tests.
  - Documentation of the distinction between presentation exports, recipe JSON backup/import, and data-management archives.
- **Out-of-Scope:**
  - Changing `GET /api/recipes/export`, `RecipeExportJson`, or recipe JSON import behavior.
  - Recursive export of linked or derived recipes.
  - Made-history export in the initial version.
  - Photo export in the initial version.
  - Persisting Advanced selections as application settings, user preferences, or recipe data.
  - A universal export document or universal export modal shared by menus and recipes.
  - Implementing multiple recipe layouts in the first release; the model must support an explicit layout extension point, with one basic layout initially.

### 2. Technical Constraints & Architecture
- Keep recipe presentation models and serializers domain-specific. Do not make `MenuDocument` or the legacy `RecipeExportJson` a universal presentation model.
- Preserve the typed recipe JSON API as JSON and continue using `fetchJson` for it. Use binary handling only for attachment responses.
- Add shared renderer download mechanics in `src/renderer/lib/download.ts`, owning object URL creation, temporary anchor insertion, click, cleanup, and JSON serialization.
- Reuse the existing `fetchBinary` behavior for downloadable responses, including content-disposition filename parsing, content type/length handling, structured API errors, and `Cache-Control: no-store` behavior.
- Keep complete filename construction and export selection domain-specific. Generic filename sanitization and extension helpers may be shared.
- Follow the Electron/browser platform boundary: renderer code uses `getPlatform()` for native-only PDF behavior and does not call `window.api` directly outside the established adapter.
- Reuse the existing menu export interaction pattern where appropriate: explicit format/layout state, standalone HTML print view in browser mode, HTML fallback when a popup is blocked, and native PDF save flow in Electron.
- Use the current `RecipeDetail` serving scaler, unit conversion, ingredient grouping, and annotation behavior as the source of truth for visible adjusted output. Export must not silently revert to stored quantities.
- Keep print/export styles compatible with the existing warm utility design system and print-specific light surfaces. Standalone exported HTML must contain its own safe print styles and escape user-controlled values.
- Group Advanced controls rather than exposing one toggle for every field. The export must not proceed when no content or metadata group is selected, while retaining title/basic identity.
- CSV must use the fixed columns `section,type,key,value,group,quantity,unit,notes,order`. Metadata rows use `key`/`value`; ingredient rows use `group`/`quantity`/`unit`/`notes`; instruction rows use `value`/`order`; unused columns remain empty. Escaping and null/empty-field behavior must be tested.
- No database migration is expected. Any new API route or server attachment response must be justified during Phase 1 discovery; client-generated presentation output is preferred where it satisfies browser and Electron requirements.

### 3. Resolved Presentation Contract
- **Instructions:** Export the raw ordered recipe instructions. Annotated instructions and cooking-mode state are not included in the initial export contract.
- **Print entry point:** The existing RecipeDetail Print action opens the recipe export workflow rather than calling `window.print()` directly.
- **Mandatory identity:** Title and basic recipe identity are always emitted, but mandatory identity does not count as a selected optional group. Export validation rejects a request when no optional content or metadata group is selected.
- **Advanced groups:** Core content groups cover description, ingredients, instructions, and cook notes. Basic metadata contains difficulty, cuisine, servings, prep time, and cook time. Source/tags contains source label, source URL, and tags. Personal/status contains favourite, rating, origin, and scalar last-made date. Lineage contains compact source-recipe and derived-recipe summaries without recursive expansion.
- **Defaults:** Core content and basic metadata are enabled by default. Source/tags is enabled by default. Personal/status and lineage are opt-in. All selections reset to these defaults each time the workflow opens.
- **Current state:** Ingredient quantities and units use the currently visible serving count and unit mode from RecipeDetail. Yield metadata reflects the visible serving count.
- **Links:** Only `http:` and `https:` source URLs become clickable links. Unsupported or unsafe schemes render as escaped plain text.
- **Empty data:** Selected groups with no usable data are omitted, including their headings and rows. The export is invalid only when no optional group is selected at all.
- **Browser fallback:** If the browser blocks the standalone print window, Print automatically downloads the generated standalone HTML and shows a non-blocking fallback notice.
- **Electron PDF:** Reuse `getPlatform().exportMenuPdf()` and the existing `menu:exportPdf` IPC channel as the generic HTML-to-PDF save capability. No new recipe-specific IPC channel is added.
- **Layout:** The initial layout identifier is `basic-recipe`. The document model includes an explicit layout field so future layouts can be added without changing the legacy recipe JSON contract.

---

# Execution Plan & Handoffs

## Phase 1: Specification Contract and Export Boundary
- **Status:** COMPLETED
- **Objective:** Convert the approved decisions into a precise recipe presentation contract and confirm the smallest implementation boundary before coding.

### Tasks
- [x] Inspect the current `RecipeDetail`, recipe payload, serving/unit helpers, menu export platform flow, renderer API helpers, and existing print CSS; record any deviations from this plan.
- [x] Define the recipe presentation document types, including basic identity, optional groups, normalized ingredients, instructions, metadata, explicit initial layout, and generated/export context.
- [x] Define the Advanced selection type and defaults: description, ingredients, instructions, cook notes, basic metadata, and source/tags enabled by default; personal/status and lineage opt-in; selections reset on every workflow open.
- [x] Define the exact rendering policy for raw instructions, HTTP(S)-only source links, tags, rating/favourite/origin/last-made metadata, compact lineage references, null fields, omitted empty sections, ingredient groups, and current serving/unit state.
- [x] Define the fixed CSV columns `section,type,key,value,group,quantity,unit,notes,order`, row types, ordering, and empty/null behavior for each selection group.
- [x] Confirm whether presentation exports are client-generated or require a new attachment route; preserve the existing recipe JSON route either way.
- [x] Record the `basic-recipe` layout identifier and the extension point for future recipe layouts without implementing additional layouts.

### Verification & Acceptance Criteria
- [x] **Automated Checks:** Run focused existing recipe detail, menu export, and API tests discovered during baseline inspection.
- [x] **Functional Assertions:** Every requested field and decision maps to a typed document or selection contract; no legacy JSON/data-archive contract is changed.
- [x] **Functional Assertions:** The fixed CSV schema, Advanced defaults, raw-instruction policy, empty-export validation, serving/unit behavior, HTTP(S)-only source-link behavior, empty-section policy, Print entry-point behavior, PDF channel reuse, and lineage policy are written as implementation acceptance criteria before Phase 2 begins.

### Plan Compliance Checklist
- [x] **Required Files:** `src/renderer/components/recipes/RecipeDetail.tsx`, `src/shared/types.ts`, recipe ingredient/unit helpers, existing menu export/platform/API files, and the focused tests identified during discovery.
- [x] **Boundaries:** No application behavior or files are changed beyond discovery/contract documentation; no universal export model; no changes to recipe JSON import/export or data-management archives.
- [x] **Legacy Code Removed:** None in this preparation phase; existing print and JSON export paths remain until their replacement/refactor phase is validated.
- [x] **Acceptance Checks:** Baseline commands and the written document/selection/CSV contract are verified before implementation starts.

### Phase 1 Handoff & Verification Report
- **Compliance Check:** PASSED
- **Verification Result:** PASSED
- **Execution Proof / Logs:**
  - `npm run test -- src/renderer/components/meal-plan/MenuPrintExportModal.test.tsx src/renderer/pages/recipes/detail.test.tsx src/main/server/routes/menu-export.test.ts` -> 3 files passed, 19 tests passed.
- **Artifacts Created/Modified:**
  - `docs/plans/recipe-export-plan/recipe-export-plan.md` - Recorded the Phase 1 contract, baseline evidence, and implementation boundary.
- **Decisions & Deviations:**
  - `RecipeDetail` already computes scaled quantities and unit conversions in `ingredientDisplays`; Phase 3/4 must consume equivalent live state rather than stored quantities.
  - The current detail Print action calls `window.print()` directly and must be replaced in Phase 4.
  - Presentation exports are client-generated; no recipe attachment route is required. The typed recipe JSON API and data-management archive remain unchanged.
  - Existing Electron PDF support is exposed through `getPlatform().exportMenuPdf()` and the unchanged `menu:exportPdf` channel.
  - Existing menu export code contains local download and filename helpers; Phase 2 will centralize only the download mechanics while preserving domain-specific filenames.
- **Next Phase Context:** Phase 2 may add the shared renderer download utility and focused regression tests. Preserve existing menu and recipe JSON filenames/payloads and do not begin recipe-specific formatter work until Phase 2 validation passes.

---

## Phase 2: Shared Download and Binary Export Foundation

* **Status:** COMPLETED
* **Objective:** Centralize browser download behavior and reuse binary response handling without changing user-visible export contracts.

### Tasks

* [x] Create `src/renderer/lib/download.ts` with `downloadBlob` and `downloadJson`, including object URL cleanup and safe JSON serialization.
* [x] Add generic filename primitives only where they remove duplication, keeping menu and recipe filename construction domain-specific.
* [x] Refactor `MenuPrintExportModal` and the recipe library JSON export flow to use the shared download utility without changing filenames, toast behavior, or JSON payload shape.
* [x] Refactor binary export callers to use the existing `fetchBinary` path where duplication remains; do not route typed recipe JSON through binary handling.
* [x] Add focused tests for blob downloads, JSON downloads, URL revocation, temporary anchor cleanup, fallback names, and UTF-8/content-disposition handling where applicable.

### Verification & Acceptance Criteria

* [x] **Automated Checks:** Run the focused download/API/menu export tests and the existing recipe library export tests.
* [x] **Functional Assertions:** Object URLs are revoked, temporary anchors are removed, fallback filenames remain stable, and menu/JSON export behavior is unchanged.
* [x] **Functional Assertions:** Existing binary filename parsing continues to handle encoded and quoted content-disposition filenames.

### Plan Compliance Checklist

* [x] **Required Files:** `src/renderer/lib/download.ts`; `src/renderer/lib/api.ts`; `src/renderer/components/meal-plan/MenuPrintExportModal.tsx`; `src/renderer/pages/recipes.tsx`; and focused tests for each affected path.
* [x] **Boundaries:** No domain formatter or API contract is moved into the generic utility; no direct renderer `window.api` calls are added; no unrelated download behavior is refactored.
* [x] **Legacy Code Removed:** Local duplicate download implementations are removed only after their callers use the shared utility and tests pass.
* [x] **Acceptance Checks:** Focused tests pass before recipe-specific formatter/UI work begins.

### Phase 2 Handoff & Verification Report

* **Compliance Check:** PASSED
* **Verification Result:** PASSED
* **Execution Proof / Logs:**
  - `npm run test -- src/renderer/lib/download.test.ts src/renderer/components/meal-plan/MenuPrintExportModal.test.tsx src/renderer/pages/recipes/detail.test.tsx src/main/server/routes/menu-export.test.ts` -> 4 files passed, 22 tests passed.
  - `npx eslint src/renderer/lib/download.ts src/renderer/lib/download.test.ts src/renderer/lib/api.ts src/renderer/pages/recipes.tsx src/renderer/components/meal-plan/MenuPrintExportModal.tsx` -> passed.
  - `get_errors` on all Phase 2 files -> no errors found.
* **Artifacts Created/Modified:**
  - `src/renderer/lib/download.ts` - Added shared blob and JSON download lifecycle helpers.
  - `src/renderer/lib/download.test.ts` - Added download lifecycle and UTF-8 serialization tests.
  - `src/renderer/lib/api.ts` - Routed user-data and menu binary downloads through `fetchBinary`.
  - `src/renderer/pages/recipes.tsx` - Reused shared JSON download helper.
  - `src/renderer/components/meal-plan/MenuPrintExportModal.tsx` - Reused shared blob download helper.
* **Decisions & Deviations:** No deviations. Generic helpers do not construct domain filenames or alter typed recipe JSON handling.
* **Next Phase Context:** Phase 3 can add `src/shared/recipe-export.ts` and pure formatter tests. Use `RecipePayload`, live servings/unit state, and `convertIngredient`; keep the legacy `RecipeExportJson` and menu document separate.

---

## Phase 3: Recipe Presentation Model and Formatters

* **Status:** COMPLETED
* **Objective:** Build the pure recipe document pipeline for the initial layout and all agreed output formats.

### Tasks

* [x] Add the recipe-specific presentation module, likely `src/shared/recipe-export.ts`, with typed document, selection, layout, metadata, and normalized ingredient structures.
* [x] Implement document construction from `RecipePayload` plus current serving/unit state and Advanced selections.
* [x] Implement HTML formatting with escaped user values, HTTP(S)-only safe links, standalone document styles, print page-break behavior, omitted empty sections, and the `basic-recipe` layout class/identifier.
* [x] Implement Markdown formatting with escaped text, headings, grouped ingredients, raw ordered instructions, selected metadata, and safe source links.
* [x] Implement CSV formatting with the fixed Phase 1 columns and row types, selected group filtering, ingredient/instruction ordering, explicit empty/null behavior, and robust CSV escaping.
* [x] Keep the model ready for future recipe layouts without adding extra layout implementations now.
* [x] Add pure formatter tests covering all fields, selected/unselected groups, null/empty data, ingredient quantities and notes, scaling, unit conversion, escaping, links, lineage, and CSV row output.

### Verification & Acceptance Criteria

* [x] **Automated Checks:** Run the recipe-export unit test file(s) and TypeScript diagnostics for the shared module.
* [x] **Functional Assertions:** HTML, Markdown, and CSV outputs contain exactly the selected groups and omit unselected groups.
* [x] **Functional Assertions:** Current visible servings and units are reflected in ingredient amounts and yield metadata, while instructions remain raw and ordered.
* [x] **Functional Assertions:** HTML and Markdown escape user-controlled content, reject unsafe source-link schemes, omit empty selected sections, and CSV output follows the fixed schema while preserving commas, quotes, and newlines.
* [x] **Functional Assertions:** No formatter reads or mutates the legacy `RecipeExportJson` shape or recursively expands linked recipes.

### Plan Compliance Checklist

* [x] **Required Files:** `src/shared/recipe-export.ts` or the Phase 1-approved recipe presentation module; shared recipe export schemas/types if needed; and formatter tests.
* [x] **Boundaries:** No menu document reuse, no React/UI dependencies in the pure shared formatter module, no persistence of Advanced selections, and no database/schema changes.
* [x] **Legacy Code Removed:** None unless Phase 1 identifies a duplicate recipe formatter that is fully replaced with equivalent tested behavior.
* [x] **Acceptance Checks:** Formatter tests cover every selection group and every required escaping/empty-field case before UI integration.

### Phase 3 Handoff & Verification Report

* **Compliance Check:** PASSED
* **Verification Result:** PASSED
* **Execution Proof / Logs:**
  - `npm run test -- src/shared/recipe-export.test.ts` -> 1 file passed, 4 tests passed.
  - `npx eslint src/shared/recipe-export.ts src/shared/recipe-export.test.ts` -> passed after one targeted regex correction.
  - `get_errors` on both Phase 3 files -> no errors found.
* **Artifacts Created/Modified:**
  - `src/shared/recipe-export.ts` - Added the typed basic recipe document builder and HTML/Markdown/CSV formatters.
  - `src/shared/recipe-export.test.ts` - Added pure presentation contract and formatter coverage.
* **Decisions & Deviations:** The shared builder accepts injected quantity conversion/formatting functions so it remains independent of renderer modules while Phase 4 can pass the existing live unit helper.
* **Next Phase Context:** Phase 4 must add a recipe-specific export workflow, pass live `RecipeDetail` servings/unit state into `buildRecipeDocument`, use `getPlatform()` for PDF, and replace direct Print behavior. Keep Advanced defaults ephemeral and preserve browser-mode safety.

---

## Phase 4: Recipe Detail Export UI and Platform Integration

* **Status:** COMPLETED
* **Objective:** Add the user-facing export/print workflow to `RecipeDetail` and connect browser, Electron, and download behavior.

### Tasks

* [x] Add a recipe-specific export modal/panel, using the existing modal and menu-export interaction patterns without creating a universal export modal.
* [x] Add format selection for print/PDF, HTML, Markdown, and CSV, with the initial basic layout selected by default.
* [x] Add the Advanced section with grouped controls, recommended defaults, accessible labels, reset-on-open behavior, and validation requiring at least one content or metadata group.
* [x] Build the presentation document from the live recipe detail state, including current servings, current unit mode, ingredient groups, raw ordered instructions, and the `basic-recipe` layout contract.
* [x] Implement browser print in a standalone window using formatted HTML; when popup creation is blocked, automatically download the standalone HTML and show a non-blocking fallback notice.
* [x] Implement Electron PDF through `getPlatform().exportMenuPdf()` and the existing `menu:exportPdf` capability; use normal browser/download APIs for non-native formats and do not add a recipe-specific IPC channel.
* [x] Change the existing RecipeDetail Print action to open the recipe export workflow.
* [x] Add component tests for opening/closing, format selection, Advanced defaults and toggles, empty-selection validation, preview/output actions, error states, and current serving/unit propagation.
* [x] Add platform integration tests for browser print-window behavior, popup fallback, Electron PDF invocation, and download filenames.

### Verification & Acceptance Criteria

* [x] **Automated Checks:** Run focused `RecipeDetail` and recipe-export component tests, menu export regression tests, and relevant API/platform tests.
* [x] **Functional Assertions:** Users can export a single recipe in every agreed format and the selected sections/metadata are reflected in the output.
* [x] **Functional Assertions:** Reopening the export flow restores per-export defaults and does not persist Advanced selections.
* [x] **Functional Assertions:** Browser mode never requires `window.api`; popup-blocked Print downloads HTML with a notice; Electron PDF reuses the existing platform abstraction and reports saved, canceled, and error outcomes without leaving the modal stuck in a loading state.
* [x] **Functional Assertions:** The workflow is keyboard accessible, labels all grouped controls, restores focus on close, exposes validation errors, rejects no-group exports, and does not produce an empty document.

### Plan Compliance Checklist

* [x] **Required Files:** `src/renderer/components/recipes/RecipeDetail.tsx`; a recipe-specific export modal/panel; relevant renderer styles; platform/API/download modules; and focused component/platform tests.
* [x] **Boundaries:** No universal export modal, no direct `window.api` calls outside the platform adapter, no changes to recipe JSON import/export, and no persistence of export selections.
* [x] **Legacy Code Removed:** Any replaced direct print/download handler is removed only after equivalent browser, Electron, and regression tests pass; unrelated recipe detail actions remain intact.
* [x] **Acceptance Checks:** All format, Advanced, platform, accessibility, and failure-state checks above are executed and recorded.

### Phase 4 Handoff & Verification Report

* **Compliance Check:** PASSED
* **Verification Result:** PASSED
* **Execution Proof / Logs:**
  - Focused export regression command -> 7 files passed, 38 tests passed.
  - `npx eslint` on all Phase 4 and dependent Phase 2/3 files -> passed.
  - `get_errors` on the Phase 4 implementation files -> no errors found.
* **Artifacts Created/Modified:**
  - `src/renderer/components/recipes/RecipeDetailExportModal.tsx` - Added recipe-specific format selection, grouped Advanced controls, preview, browser fallback, and Electron PDF integration.
  - `src/renderer/components/recipes/RecipeDetailExportModal.test.tsx` - Added UI/platform workflow coverage.
  - `src/renderer/components/recipes/RecipeDetail.tsx` - Replaced direct Print with the recipe export workflow and passed live state.
  - `src/shared/recipe-export.ts` and `src/shared/recipe-export.test.ts` - Shared document/formatter pipeline and tests.
* **Decisions & Deviations:** No deviations from the approved plan. The existing `menu:exportPdf` channel remains intentionally reused for recipe HTML-to-PDF output.
* **Next Phase Context:** Phase 5 must update export documentation, run focused and full tests, lint, web build, and applicable production checks. Manual Electron/browser smoke checks may be limited by the current development process and should be recorded honestly.

## Phase 5: Full Verification, Documentation, and Release Readiness

* **Status:** COMPLETED
* **Objective:** Validate the complete feature across renderer, shared, Electron, and browser paths and document its contracts.

### Tasks

* [x] Run focused recipe export tests, existing menu export tests, recipe JSON export/import tests, and related API/platform tests.
* [x] Run `npm run lint`, `npm run build:web`, and the applicable production/Electron build checks; use the documented Windows Prisma workaround if a locked query-engine DLL blocks generation.
* [x] Run the full test suite and distinguish feature regressions from known unrelated baseline failures.
* [x] Perform available automated browser/Electron integration coverage for Print opening the export workflow, PDF, HTML, Markdown, and CSV flows, including popup-blocked HTML fallback behavior.
* [x] Check exported formatter behavior for print styles, page breaks, theme-independent light surfaces, escaped content, and selected-section output; component tests cover keyboard/focus behavior and validation.
* [x] Update the appropriate developer/export documentation with raw-instruction behavior, Advanced selection semantics, fixed CSV schema, safe source-link policy, platform differences, Print/PDF behavior, and the preserved JSON/archive boundaries.
* [x] Record final artifacts, validation evidence, known limitations, and deferred layout or metadata work in this plan.

### Verification & Acceptance Criteria

* [x] **Automated Checks:** Focused tests, `npm run lint`, `npm run build:web`, the full Electron production build, the data-management build check, the IPC documentation check, and the full test suite are run and recorded.
* [x] **Functional Assertions:** All source requirements are mapped to working behavior, including Advanced controls, per-export reset, current serving/unit output, all formats, browser fallback, and Electron PDF.
* [x] **Functional Assertions:** Existing menu export and recipe JSON export/import behavior remains compatible through regression coverage and unchanged legacy routes.
* [x] **Functional Assertions:** Developer documentation describes the three export boundaries: presentation export, recipe JSON compatibility export, and data-management archive.

### Plan Compliance Checklist

* [x] **Required Files:** All files created or modified by Phases 1-4, the developer guide, and the focused/full validation evidence are recorded.
* [x] **Boundaries:** No unrelated refactor, schema migration, compatibility contract change, or additional layout/metadata scope is included without a recorded decision.
* [x] **Legacy Code Removed:** Superseded duplicate download paths and direct RecipeDetail print behavior are absent; preserved JSON/archive paths remain intentionally available.
* [x] **Acceptance Checks:** Automated validation is complete; manual desktop/browser smoke testing limitations are recorded explicitly below.

### Phase 5 Handoff & Verification Report

* **Compliance Check:** PASSED
* **Verification Result:** PASSED with manual smoke-test limitation
* **Execution Proof / Logs:**
  - Focused Phase 4 export/regression suite -> 7 files passed, 38 tests passed.
  - `npm run test` -> 103 files passed, 504 tests passed.
  - `npm run lint` -> passed.
  - `npm run build:web` -> passed; Vite emitted only existing Browserslist and chunk-size warnings.
  - `npm run build` -> passed; Electron main/preload/renderer bundles and `check:data-management:build` passed.
  - `npm run docs:check:ipc` -> passed; `docs/ipc-channels.md` is synchronized with code channel names.
  - `git diff --check` -> passed; Git reported only an existing LF/CRLF normalization warning.
  - `get_errors` on touched implementation files -> no errors found.
* **Artifacts Created/Modified:**
  - `src/shared/recipe-export.ts` and its tests -> typed `basic-recipe` document builder plus HTML, Markdown, and fixed-schema CSV formatters.
  - `src/renderer/components/recipes/RecipeDetailExportModal.tsx` and its tests -> grouped Advanced workflow, preview, browser fallback, downloads, and Electron PDF integration.
  - `src/renderer/components/recipes/RecipeDetail.tsx` -> live serving/unit state wiring and export workflow Print entry point.
  - `src/renderer/lib/download.ts` and its tests -> shared blob/JSON download lifecycle.
  - Existing menu, recipe JSON, and binary API callers -> shared helper/fetchBinary reuse with legacy contracts preserved.
  - `docs/developer-guide.md` -> presentation export behavior and boundary documentation.
* **Decisions & Deviations:** No implementation deviations from the approved plan. Full interactive browser/Electron smoke testing was not run in this validation environment; automated component/platform tests cover popup success/fallback, PDF invocation, downloads, error states, reset behavior, and focus/validation behavior. Manual viewport checks, native save-dialog interaction, and physical print/PDF rendering remain release-operator checks.
* **Next Phase Context:** No implementation phase remains. Before a public release, run the documented manual browser/Electron smoke checklist at supported viewport sizes and verify native print/PDF rendering on a packaged build.

---

## Resolved Decision Register

The following decisions were closed during adversarial review and decision-closure rounds. They are incorporated into the contract and phase requirements above.

| ID | Decision | Resolution | Implementation consequence |
|---|---|---|---|
| `d1-instructions` | Which instruction representation is exported? | Raw ordered instructions; annotated and cooking-mode representations are out of scope. | The document builder and formatters consume the stored instruction order. |
| `d2-print-action` | What does the RecipeDetail Print action do? | It opens the recipe export workflow. | The existing direct `window.print()` action is replaced after equivalent workflow tests pass. |
| `d3-empty-selection` | Is identity-only output valid? | No. Mandatory identity is retained, but at least one optional group must be selected. | The UI validates and blocks an all-groups-cleared export. |
| `d4-metadata` | Which fields belong to each metadata group? | Basic metadata: difficulty, cuisine, servings, prep time, cook time. Source/tags: source label, URL, tags. Personal/status: favourite, rating, origin, scalar last-made date. Lineage: compact source and derived summaries. | Personal/status and lineage default off; other agreed groups default on. |
| `d5-pdf-channel` | How does Electron PDF export integrate? | Reuse `getPlatform().exportMenuPdf()` and `menu:exportPdf`; no new recipe-specific channel. | IPC, preload, and documentation contracts remain unchanged. |
| `d6-csv-schema` | What is the stable CSV contract? | Fixed columns: `section,type,key,value,group,quantity,unit,notes,order`. | Metadata, ingredient, and instruction row semantics are deterministic and documented. |
| `d7-source-links` | Which source URLs become links? | Only `http:` and `https:` URLs; all other values are escaped plain text. | Formatter tests must cover unsafe schemes. |
| `d8-empty-sections` | What happens to selected groups with no data? | Omit the empty section and its rows. | Only an all-groups-cleared selection is invalid. |
| `d9-popup-fallback` | What happens when the browser blocks Print? | Download standalone HTML automatically and show a non-blocking fallback notice. | Browser integration tests cover popup success and fallback. |

### Decision-Closure Handoff

* **Decision status:** RESOLVED
* **Plan handoff status:** ADVANCED TO IMPLEMENTATION
* **Implementation status:** Authorized and completed through Phase 5; the implementation follows the resolved decisions above.
* **Remaining material decisions:** None identified.
* **Remaining assumptions:** The scalar `lastMadeAt` value is treated as personal/status metadata; the existing menu-named PDF IPC channel remains intentionally unchanged for this release.

---

# Overall Plan Completion Status

* **Final State:** COMPLETED
* **Total Phases Completed:** 5 / 5
* **Summary of Outcome:** RecipeDetail now provides a recipe-specific presentation export workflow for Print, PDF, HTML, Markdown, and CSV. It preserves legacy recipe JSON and data-management contracts, uses grouped ephemeral Advanced selections, exports the visible serving/unit state, applies safe link and escaping rules, and reuses the existing Electron PDF capability.
