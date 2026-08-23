# Implementation Report: iPhone Safe-Area Header

## Goal and Scope
- Goal: Keep the browser and standalone PWA header clear of the iPhone top unsafe region.
- In scope: Viewport metadata, shared safe-area offsets, AppShell and dependent top-positioned browser UI, focused regression coverage, and QA documentation.
- Out of scope: New browser automation, unrelated responsive redesign, and changes to Electron's existing 64px title-bar behavior.

## Phase Checklist
1. Viewport contract - completed
	- Acceptance: Modern iOS edge-to-edge viewport metadata is present without changing Electron behavior.
	- Validation: `npm run build:web` passed.
2. Shared safe-area tokens - completed
	- Acceptance: Browser/mobile safe-area compensation has a zero fallback and preserves the 64px desktop/Electron contract.
	- Validation: `npx vitest run src/renderer/components/layout/app-shell.test.tsx` passed (5 tests).
3. Shell and dependent offsets - completed
	- Acceptance: Header contents, shell content, mobile menu, connection banner, Meal Bank, and Meal Plan viewport calculations share the effective top offset.
	- Validation: `npx vitest run src/renderer/components/layout/app-shell.test.tsx` passed (5 tests).
4. Regression coverage and QA docs - completed
	- Acceptance: Deterministic shell coverage and explicit Safari/PWA notched-device checks are documented.
	- Validation: Focused test and lint pending final validation.

## Phase Results
1. Viewport contract
	- Changes: Added `viewport-fit=cover` to the renderer viewport metadata.
	- Validation: `npm run build:web` passed.
2. Shared safe-area tokens
	- Changes: Added `--app-safe-area-top` and `--app-header-height` with zero-safe-area fallback.
	- Validation: AppShell test passed (5 tests).
3. Shell and dependent offsets
	- Changes: Applied the effective header height to AppShell, mobile navigation, connection banner, Meal Bank, and week-board viewport calculations.
	- Validation: AppShell test passed (5 tests).
4. Regression coverage and QA docs
	- Changes: Added global-header test coverage and documented the Safari/PWA notch matrix and finding.
	- Validation: Focused test passed (6 tests); `npm run lint` passed.

## Final Validation
- `npx vitest run src/renderer/components/layout/app-shell.test.tsx` - passed (6 tests)
- `npm run lint` - passed
- `npm run build:web` - passed
- Changed-file diagnostics - no errors found
- Physical iPhone Safari/PWA matrix - not run; requires a real iPhone

## Remaining Issues
- Physical iPhone Safari and standalone PWA verification requires a real device; it cannot be completed from this Windows workspace.

## Status
complete
