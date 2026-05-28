# Browser Page Remediation Plan

Generate this plan only after `docs/browser-page-qa-findings.md` is populated.

## Inputs

- Findings source: `docs/browser-page-qa-findings.md`
- Scope: Browser-mode routes
- Severity model: P0/P1/P2/P3

## Plan A: Quick Wins

Low-risk, high-impact fixes with minimal architectural changes.

Status: Implemented on 2026-05-28

| Item | Source Issue IDs | Change Area | Risk | Validation | Order |
|---|---|---|---|---|---|
| Add descriptive accessible labels for heatmap day-cell buttons on Home and Stats (`aria-label` with date and count metadata) | QA-A11Y-002 | `src/renderer/components/stats/*` and heatmap usage in home widgets | Low | Completed: day-cell controls report explicit labels in QA snapshots | 1 |
| Replace symbol-only settings header link text with explicit accessible name (`aria-label="Settings"`) while preserving visual icon | QA-A11Y-003 | `src/renderer/components/layout/app-shell.tsx` | Low | Completed: settings header link now exposes `aria-label="Settings"` | 2 |
| Add route-level handling for throttled responses (friendly retry messaging and bounded retry) for recipe/stats/home data queries | QA-NAV-001 | Renderer query hooks/components in affected pages | Medium | Completed: bounded retry and route-level retry messaging/buttons added; monitor in next regression cycle | 3 |
| Manually verify and patch unlabeled form controls flagged by scanner in recipes/grocery/prep/settings | QA-A11Y-004 | Page and component forms across routes | Medium | Completed: scanner-confirmed unlabeled controls patched in grocery/prep/settings surfaces | 4 |

## Plan B: Deep Refactors

Cross-cutting or structural fixes requiring broader coordination.

Status: Items 1 and 2 implemented on 2026-05-28

| Item | Source Issue IDs | Change Area | Risk | Validation | Order |
|---|---|---|---|---|---|
| Introduce shared accessible-interactive primitives for dense grids/lists (named button helper + metadata contract) | QA-A11Y-002, QA-A11Y-004 | Shared UI primitives and stats/plan grid renderers | Medium | Completed: shared heatmap-cell helper and metadata contract added; unit coverage in `src/renderer/components/ui/accessible-heatmap-cell.test.tsx` | 1 |
| Standardize route data-error UX with a common retry panel and throttle-aware messaging | QA-NAV-001 | Query error boundaries and page-level loading/error states | Medium | Completed: shared `RouteErrorState` extracted and existing throttling regression suite remains green | 2 |
| Add automated page QA suite for required route order (smoke + keyboard baseline + accessibility assertions) | QA-A11Y-002, QA-A11Y-003, QA-A11Y-004, QA-NAV-001 | `src/renderer/pages/*.qa.test.tsx` + shared `src/renderer/test/qa/*` | Medium | CI run includes route QA suite and fails on regressions | 3 |

## Execution Gates

1. Complete and verify all Plan A items.
2. Re-run page smoke + targeted keyboard/a11y checks.
3. Re-baseline remaining issues.
4. Execute Plan B in phased order.

## Verification Checklist

- Every remediation item maps to one or more issue IDs.
- Every completed item includes validation evidence.
- Severity totals are recalculated after each phase.
- Any residual P1+ issue is explicitly risk-accepted.

## Current Recommendation

1. Extend the automated QA suite to remaining high-value routes after the shared retry-state extraction.
2. Re-baseline browser QA findings after the shared retry-state refactor to confirm the issue inventory stays closed.
3. Evaluate whether route loading states should also be standardized into the same shared UX family.
