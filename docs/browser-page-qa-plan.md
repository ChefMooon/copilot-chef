# Browser Page QA Plan

## Scope

This plan validates browser-mode routes for:

- Visual consistency (style-guide alignment)
- Common accessibility expectations (labels, landmarks, name-role-value)
- Keyboard navigation (focusability and activation paths)
- Functional sanity (core load/empty/error/primary-action paths)

Runtime scope for this cycle is browser mode only.

## Severity Rubric

| Severity | Meaning                                                                               | Ship Guidance                              |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| P0       | Critical breakage (cannot complete primary flow, severe a11y blocker, data-loss risk) | Block release                              |
| P1       | Major UX or accessibility defect in common path                                       | Fix before release or formally risk-accept |
| P2       | Moderate issue with workaround or limited impact                                      | Schedule next patch window                 |
| P3       | Minor polish issue or low-impact inconsistency                                        | Backlog                                    |

## Required Evidence Per Finding

Each finding must include:

1. Route and component area
2. Reproduction steps
3. Expected vs actual behavior
4. Severity (P0/P1/P2/P3)
5. Screenshot or output evidence
6. Environment notes (browser, viewport)

## Required Route Order

Execute in this order and do not skip ahead:

1. `/connect`
2. `/`
3. `/meal-plan`
4. `/recipes`
5. `/recipes/:recipeId`
6. `/grocery-list`
7. `/grocery-list/shop/:id`
8. `/prep-lists`
9. `/prep-lists/prep/:id`
10. `/stats`
11. `/settings`

## Per-Page Test Matrix

Use the same matrix on each page.

### A. Visual Consistency

- Spacing and hierarchy align with style guide tokens
- Typography scale and emphasis are consistent
- Colors and contrast are consistent with semantic usage
- Layout remains coherent at desktop and mobile viewport widths

### B. Accessibility Basics

- Exactly one primary heading is present
- Inputs and controls have accessible names
- Interactive controls expose expected roles
- Status and error messages are perceivable

### C. Keyboard Navigation

- Primary controls are keyboard focusable
- Focus remains visible and predictable
- Enter/Space activate expected controls
- Escape behavior is correct for overlays/dialogs where present

### D. Functional Sanity

- Page renders without crash in normal state
- Empty state and loading behavior are understandable
- Error state is readable and actionable
- Core user action on the page succeeds

## Reporting Workflow

1. Record each page result in `docs/browser-page-qa-findings.md`.
2. Add issue IDs in `QA-<route-shortname>-<number>` format.
3. After all pages complete, produce severity totals and route impact summary.
4. Generate remediation plans in `docs/browser-page-remediation-plan.md` split into:
   - Quick Wins
   - Deep Refactors

## Automation Baseline

Current automation baseline for this phase:

- Browser page smoke test scaffold
- Connect-page accessibility/keyboard baseline checks
- Shared QA helper utilities for computed accessible names, minimum hit areas,
  and tooltip policy
- Connect-page adoption of the shared named-control and tooltip-policy checks

As route QA suites are added or expanded, use the same helpers for every
interactive control under test. Hit-area assertions should pass `32` for
compact icon controls and `40` for standard icon buttons.

### iOS Safe-Area Regression Matrix

For browser shell changes that affect the top inset, test `/meal-plan` and at
least one additional authenticated route in both normal Safari and the
installed standalone PWA:

- Portrait orientation on a notched iPhone, with Safari's toolbar expanded and collapsed
- Header logo, navigation controls, and first visible content fully below the device's unsafe top region
- Mobile navigation opens immediately below the full header without covering header content
- Connection banners and Meal Bank surfaces do not overlap the header
- Meal Plan week-board scrolling remains usable as browser chrome changes height
- Wide browser and Electron layouts retain the existing 64px header behavior

When available, use Safari Web Inspector to compare the header bounds and
viewport values while changing toolbar state:

```js
document.querySelector("header")?.getBoundingClientRect();
window.innerHeight;
window.visualViewport?.height;
getComputedStyle(document.querySelector("header")).paddingTop;
```
