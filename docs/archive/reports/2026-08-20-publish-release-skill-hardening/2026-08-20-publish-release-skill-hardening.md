# Implementation Report: Publish Release Skill Hardening

## Goal and Scope
- Goal: Make the publish-release skill deterministic, resumable, fail-fast, and exact when updating GitHub Release drafts.
- In scope: `.github/skills/publish-release/SKILL.md`.
- Out of scope: release workflow runtime changes, including the Node.js 20 warning.

## Phase Checklist
1. Release-draft notes contract - completed
	- Acceptance: Extract exact changelog notes, preserve generated release text, guard draft state, and verify the merged body.
	- Validation: Focused text checklist against the skill and both run logs.
2. Deterministic workflow polling - completed
	- Acceptance: Match the run by ref and SHA, use bounded non-interactive polling, and stop on failure or timeout.
	- Validation: Focused text checklist against the workflow definition and run logs.
3. Resume and mutation gates - completed
	- Acceptance: Define resumable phases, separate mutating commands, and verify remote refs before and after tag creation.
	- Validation: Focused text checklist for checkpoint and exit-code requirements.
4. Final verification and wording - completed
	- Acceptance: Require exact release/body/assets assertions and accurate draft wording.
	- Validation: Full skill consistency review against the plan, release guide, and workflow.

## Phase Results
1. Release-draft notes contract - completed
	- Changes: Added exact changelog extraction, title-dependent heading handling, body-preserving composition, draft-state and exit-code gates, and post-edit body verification to `SKILL.md`.
	- Validation: Focused PowerShell text checklist passed for all eight acceptance checks.
	- Notes: The procedure now explicitly prevents `gh release edit --notes-file` from overwriting a non-empty generated body.
2. Deterministic workflow polling - completed
	- Changes: Added release SHA/ref matching, non-interactive `gh api` polling, a 15-30 second interval, a 30-minute timeout, and terminal failure handling.
	- Validation: Focused PowerShell checklist passed against `SKILL.md` and the tag-triggered workflow.
	- Notes: The first validation attempt exposed only an over-strict line-ending-sensitive test assertion; the corrected assertion passed.
3. Resume and mutation gates - completed
	- Changes: Added resumable phase checkpoints, separate-command requirements, native exit-code hard stops, and remote branch/tag verification gates.
	- Validation: Focused PowerShell checklist passed for all nine acceptance checks.
	- Notes: The skill now explicitly handles interruption after tag creation without recreating tags or selecting a different workflow run.
4. Final verification and wording - completed
	- Changes: Added exact final assertions to the safety rules and corrected draft-release terminology to state that the draft remains unpublished.
	- Validation: Full PowerShell acceptance checklist passed against the skill, release guide, and workflow; `git diff --check` passed.
	- Notes: The Node.js 20 warning remains intentionally out of scope for this skill-only implementation.

## Final Validation
- Focused PowerShell acceptance checklist - passed.
- `git diff --check -- .github/skills/publish-release/SKILL.md` - passed.
- No application test/build run: only Markdown skill/report files changed.

## Remaining Issues
- Node.js 20 workflow warning remains a separate follow-up.

## Status
complete
