---
name: publish-release
description: "Create and publish a Local Recipe Book desktop release from this repository. Use for release preparation, version bumps, changelog checks, v* Git tags, GitHub Actions Windows packaging, GitHub Release publishing, and post-release verification."
argument-hint: "Release version or tag, for example 1.1.1 or v1.1.1"
user-invocable: true
---

# Publish Release

Create a versioned release for the Local Recipe Book Electron app using the repository's documented GitHub Actions workflow. The workflow publishes Windows installer artifacts to a GitHub Release; it does not publish a local build directly.

## Inputs

- Requested release version or tag, such as `v1.1.1`.
- Optional release notes or changelog text.
- The target remote, normally `origin`.

If the version, release notes policy, target remote, or permission to push a tag is unclear, ask before changing files or running a publish command. Never invent a version or release notes.

## Procedure

1. Read `docs/release-guide.md` and confirm the release workflow still matches this skill. Inspect `.github/workflows/release-client.yml` if the guide and repository behavior appear inconsistent.
2. Check the repository state with `git status --short --branch`, the current branch, and the configured remotes. Confirm the intended release commit is on `main`. Treat uncommitted changes to the release metadata files (`package.json`, `package-lock.json`, and `CHANGELOG.md`) as preparatory work that this skill owns; stop only for unrelated changes or an unexpected branch.
3. Normalize the requested tag to the `vMAJOR.MINOR.PATCH` form, preserving prerelease suffixes such as `v1.1.1-rc.1`. Reject tags that do not start with `v` or are not valid semver-style release tags.
4. Compare the tag version with `package.json`'s `version`. They must match exactly after removing the leading `v`. If they differ, update `package.json` to the requested release version and update the root `package-lock.json` using the repository's normal npm versioning workflow. Do not leave a version mismatch for the user to repair manually. Review the resulting metadata diff; if any release file contains unrelated user changes, stop and ask before committing it.
5. Validate the release entry in `CHANGELOG.md` for the identified version before running release checks:
   - Normalize the requested tag to its version form by removing the leading `v`, while preserving a prerelease suffix such as `1.1.1-rc.1`.
   - Require an exact release heading in the form `## [VERSION] - YYYY-MM-DD`, where `VERSION` is the normalized requested version and the date is a real ISO calendar date.
   - Require that the entry contains meaningful release notes before the next `## [` release heading. A heading with no notes, placeholder text, or only empty subsections is invalid.
   - Treat an entry for another version, a malformed heading, or a missing entry as invalid. Do not infer or silently create release notes.
6. If the `CHANGELOG.md` entry is missing or invalid, stop the release workflow and ask the user whether they want to use the `/update-changelog` skill to create or repair the entry. Do not commit, run lint/test/build, create a tag, or push anything until the user resolves this decision. If they decline, stop without publishing.
7. After the requested version and changelog entry are valid, inspect the release metadata diff. Ensure it contains the intended version updates and changelog entry, and that no unrelated changes are included. If release metadata is uncommitted, stage only `package.json`, `package-lock.json`, and `CHANGELOG.md`, then create a commit with this exact message:

   ```bash
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "chore: prepare v1.1.1 release"
   ```

   Substitute the normalized requested tag in the commit message. If the metadata is already committed in the current `main` history, do not create an empty duplicate commit.
8. Run the documented local checks from the repository root:

   ```bash
   npm run lint
   npm run test
   npm run build
   ```

   Stop on the first failure, report the command and relevant output, and do not create or push a release tag.
9. Recheck the final version, worktree, branch, and diff. Ensure the release commit is present on `main`, the worktree is clean, and the package version exactly matches the normalized tag. Push the release preparation commit to the configured remote before creating the tag:

   ```bash
   git push origin main
   ```

   Substitute the confirmed remote and current release branch. This push is part of the requested release-preparation workflow; never force-push.
10. Create and push the release tag from the verified release commit. The requested release workflow authorizes this push without an additional confirmation:

   ```bash
   git tag v1.1.1
   git push origin v1.1.1
   ```

   Substitute the requested tag and configured remote. Do not use force-push or overwrite an existing tag.
11. Monitor the `Release Client` GitHub Actions workflow. It runs on `windows-latest` and performs `npm ci`, `npm run db:generate`, `npm run build`, `npm run lint`, `npm run test`, and `npx electron-builder --win --publish always` with the repository `GITHUB_TOKEN`.
12. Once the workflow has created the GitHub Release, extract the validated changelog entry for the requested version into a temporary notes file. Preserve the meaningful release notes and omit the `## [VERSION] - YYYY-MM-DD` heading if the release title already contains the version. Do not infer or rewrite the notes. Read the existing draft body and prepend the changelog notes to it so generated commit information is retained; avoid duplicating the changelog if it is already present.
13. Before final verification, confirm that the matching release is still a draft:

   ```bash
   gh release view v1.1.1 --repo OWNER/REPOSITORY --json isDraft --jq .isDraft
   ```

   Then update the draft release body with the combined notes file:

   ```bash
   gh release edit v1.1.1 --repo OWNER/REPOSITORY --notes-file PATH_TO_TEMP_NOTES
   ```

   Substitute the requested tag, repository derived from the configured remote, and temporary notes path. Require the draft-state command to return `true` before editing. If the release is not found, the workflow failed, the release is already published, or the edit fails, report the exact failure and do not claim the release notes were updated. Remove the temporary notes file after the edit without modifying the repository.
14. Verify the GitHub Release exists for the pushed tag, contains the changelog notes, and has the Windows installer artifacts uploaded. Retrieve its browser URL and present that GitHub Release draft link to the user for review. Leave the release as a draft; do not publish it or change its draft state.
15. For a successful release, recommend downloading and installing the Windows build, launching the app, checking startup and settings persistence, confirming browser bundle availability, and checking the updater feed when auto-update is in scope.

## Safety Rules

- Never publish from an unexpected branch or with unrelated uncommitted changes without explaining the risk and receiving explicit approval. Release metadata changes are expected to be committed by this skill.
- Always commit requested release metadata with the exact message `chore: prepare vX.Y.Z release` before pushing the release branch.
- Always push the release preparation commit before creating the tag, and verify that the remote branch contains it.
- The requested release workflow authorizes creating and pushing the requested tag without an additional confirmation prompt.
- Always copy the validated changelog entry into the matching GitHub Release draft after the packaging workflow creates it, and verify the draft body before reporting success.
- Never push a tag before local lint, test, and build checks pass.
- Never push a tag whose version differs from `package.json`.
- Never assume the tag push succeeded; verify the remote tag and workflow result.
- Do not change compatibility identifiers such as `copilot-chef` merely as part of a release.
- If Prisma generation fails on Windows because a running Electron process locks the engine DLL, stop the dev process and retry using the documented repository workaround before continuing.
- Do not force-push, delete, or retarget an existing release tag without explicit authorization.

## Repository References

- [Release guide](../../../docs/release-guide.md)
- [Release workflow](../../../.github/workflows/release-client.yml)
- [Package metadata and scripts](../../../package.json)
- [Developer guide](../../../docs/developer-guide.md)
