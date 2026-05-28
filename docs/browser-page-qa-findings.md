# Browser Page QA Findings

## Cycle Metadata

- Date: 2026-05-28
- Scope: Browser mode
- Severity model: P0/P1/P2/P3
- Status: Plan A implemented and validated; Plan B item 1 implemented

## Summary

| Metric | Count |
|---|---|
| Total findings | 4 |
| P0 | 0 |
| P1 | 2 |
| P2 | 2 |
| P3 | 0 |

## Findings Log

| Issue ID | Route | Category | Severity | Title | Repro Steps | Expected | Actual | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| QA-NAV-001 | `/recipes` (also affects `/`, `/stats`, `/settings`) | Functional / Reliability | P2 | Rapid route sweeps trigger `429` responses and temporary degraded state | 1) Start at `/` 2) Navigate quickly through page sequence 3) Open `/recipes` 4) Observe console and page data sections | App should recover cleanly from throttled responses with clear state recovery | Console reports repeated `429 (Too Many Requests)` and temporary retry/degraded states before recovery | Browser console capture during QA run; deterministic regression tests in `src/renderer/pages/throttling-ui.qa.test.tsx` | Mitigated (retry UI, bounded retries, and deterministic regression coverage implemented) |
| QA-A11Y-002 | `/` and `/stats` | Accessibility | P1 | Heatmap day cells expose many unnamed interactive buttons | 1) Open `/` or `/stats` 2) Inspect accessibility snapshot 3) Review heatmap grid controls | Interactive controls should have accessible names/announcements | Large sets of `button` controls appear without accessible names in snapshots | Accessibility snapshot from browser tooling | Resolved |
| QA-A11Y-003 | Global app header | Accessibility | P2 | Settings shortcut uses symbol-only link text (`⚙`) | 1) Open any authenticated route 2) Inspect header controls | Settings navigation should have a descriptive accessible name | Header link appears as symbol text instead of explicit label | Header snapshot across routes | Resolved |
| QA-A11Y-004 | `/recipes`, `/grocery-list`, `/prep-lists`, `/settings` | Accessibility | P2 | Automated DOM scan found potentially unlabeled form controls requiring manual confirmation | 1) Run baseline DOM scanner on route sequence 2) Compare input/select labels against a11y names | Form controls should be explicitly labeled | Scanner reports unlabeled controls (counts vary by route) | Playwright DOM-scan output | Resolved |

## Route Completion

| Route | Visual | Accessibility | Keyboard | Functional | Result |
|---|---|---|---|---|---|
| `/connect` | Pass | Pass | Pass | Pass | Complete |
| `/` | Pass | Fail | Pass | Pass | Complete with issues |
| `/meal-plan` | Pass | Pass | Pass | Pass | Complete |
| `/recipes` | Pass | Pass | Pass | Pass | Complete |
| `/recipes/:recipeId` | Pass | Pass | Pass | Pass | Complete |
| `/grocery-list` | Pass | Pass | Pass | Pass | Complete |
| `/grocery-list/shop/:id` | Pass | Pass | Pass | Pass | Complete |
| `/prep-lists` | Pass | Pass | Pass | Pass | Complete |
| `/prep-lists/prep/:id` | Pass | Pass | Pass | Pass | Complete |
| `/stats` | Pass | Pass | Pass | Pass | Complete |
| `/settings` | Pass | Pass | Pass | Pass | Complete |

## Root-Cause Clusters

- Error/retry handling under rapid route transitions and request throttling (mitigated; deterministic regression coverage added)

## Release Risk

- Current risk: Low (no open accessibility findings; throttling UX now has deterministic regression coverage)
- Recommended follow-up: continue broadening automated browser-page QA coverage for additional route-specific loading and keyboard flows.
