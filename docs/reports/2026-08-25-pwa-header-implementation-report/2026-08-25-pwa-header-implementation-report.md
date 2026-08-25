# Implementation Report: PWA Header Safe Area

## Goal and Scope
- Goal: Remove excess top space from installed iPhone and iPad PWAs while preserving normal Safari and Electron header behavior.
- In scope: Standalone safe-area fallback policy, focused tests, header geometry regression checks, and QA documentation.
- Out of scope: Navigation redesign, unrelated responsive changes, and Electron title-bar changes.

## Phase Checklist
1. Baseline and contract - completed
	- Acceptance: Preserve native Safari safe-area behavior; constrain fallback to standalone PWA; retain shared header-height consumers.
	- Validation: Existing code-path review and focused safe-area/AppShell tests passed; physical Safari/PWA matrix pending.
2. Focused implementation - completed
	- Acceptance: Minimal standalone fallback without breakpoint or dependent-offset drift.
	- Validation: Focused tests and web build passed; repository lint is blocked by two unrelated existing errors.
3. Regression coverage and verification - completed
	- Acceptance: Unit coverage for fallback decisions and documented physical verification status.
	- Validation: Full required checks when shared geometry changes; physical device matrix.

## Phase Results
1. Baseline and contract - completed
	- Changes: Confirmed `src/renderer/lib/safe-area.ts` is the standalone-only fallback owner; native Safari and Electron remain outside the fallback path.
	- Validation: `npx vitest run src/renderer/lib/safe-area.test.ts src/renderer/components/layout/app-shell.test.tsx` passed with 2 test files and 12 tests.
	- Notes: Physical iPhone/iPad measurements remain pending.

2. Focused implementation - completed
	- Changes: Reduced the zero-inset standalone fallback from 32px to 24px and clear stale inline fallback state when the condition no longer applies.
	- Validation: Focused safe-area/AppShell tests passed.
	- Notes: Web build passed. Repository lint remains blocked by unrelated existing errors in `src/renderer/components/ui/segmented-code-input.test.tsx` and `src/renderer/pages/connect.tsx`.

3. Regression coverage and verification - completed
	- Changes: Added regression coverage for clearing the inline fallback when standalone mode no longer applies.
	- Validation: Focused tests passed (2 files, 12 tests); `npm run build:web` passed.
	- Notes: Physical Safari/PWA device verification remains pending.

## Final Validation
- `npx vitest run src/renderer/lib/safe-area.test.ts src/renderer/components/layout/app-shell.test.tsx` - passed, 2 files and 12 tests.
- `npm run build:web` - passed.
- `npm run lint` - blocked by pre-existing unrelated errors in `src/renderer/components/ui/segmented-code-input.test.tsx` and `src/renderer/pages/connect.tsx`.

## Remaining Issues
- Physical iPhone/iPad Safari and installed-PWA verification requires device access.

## Status
complete for automated implementation; physical Safari/PWA verification remains pending
