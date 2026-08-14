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
2. Check the repository state with `git status --short --branch`, the current branch, and the configured remotes. Confirm the intended release commit is on `main` and identify whether unrelated or uncommitted changes would make tagging unsafe.
3. Normalize the requested tag to the `vMAJOR.MINOR.PATCH` form, preserving prerelease suffixes such as `v1.1.1-rc.1`. Reject tags that do not start with `v` or are not valid semver-style release tags.
4. Compare the tag version with `package.json`'s `version`. They must match exactly after removing the leading `v`. If they differ, update `package.json` only when the user explicitly requested that version change, then update `package-lock.json` with the repository's normal npm versioning workflow and review the diff.
5. Validate the release entry in `CHANGELOG.md` for the identified version before running any release checks or changing release metadata:
   - Normalize the requested tag to its version form by removing the leading `v`, while preserving a prerelease suffix such as `1.1.1-rc.1`.
   - Require an exact release heading in the form `## [VERSION] - YYYY-MM-DD`, where `VERSION` is the normalized requested version and the date is a real ISO calendar date.
   - Require that the entry contains meaningful release notes before the next `## [` release heading. A heading with no notes, placeholder text, or only empty subsections is invalid.
   - Treat an entry for another version, a malformed heading, or a missing entry as invalid. Do not infer or silently create release notes.
6. If the `CHANGELOG.md` entry is missing or invalid, stop the release workflow and ask the user whether they want to use the `/update-changelog` skill to create or repair the entry. Do not update files, run lint/test/build, create a tag, or push anything until the user resolves this decision. If they decline, stop without publishing.
7. Run the documented local checks from the repository root:

   ```bash
   npm run lint
   npm run test
   npm run build
   ```

   Stop on the first failure, report the command and relevant output, and do not create or push a release tag.
8. Recheck the final version, worktree, branch, and diff. Ensure the release commit is present on `main`, and ensure no unrelated file changes will be included. Commit changes only if the user asked for a commit; otherwise leave commit creation to the user.
9. Before pushing anything, show the exact tag and remote that will be used and ask for explicit confirmation. A release push is an external side effect.
10. After confirmation, create and push the tag from the release commit:

   ```bash
   git tag v1.1.1
   git push origin v1.1.1
   ```

   Substitute the confirmed tag and remote. Do not use force-push or overwrite an existing tag without explicit authorization.
11. Monitor the `Release Client` GitHub Actions workflow. It runs on `windows-latest` and performs `npm ci`, `npm run db:generate`, `npm run build`, `npm run lint`, `npm run test`, and `npx electron-builder --win --publish always` with the repository `GITHUB_TOKEN`.
12. Verify the GitHub Release exists for the pushed tag and that the Windows installer artifacts were uploaded. Report the workflow result and artifact names or the exact failure point.
13. For a successful release, recommend downloading and installing the Windows build, launching the app, checking startup and settings persistence, confirming browser bundle availability, and checking the updater feed when auto-update is in scope.

## Safety Rules

- Never publish from a dirty or unexpected branch without explaining the risk and receiving explicit approval.
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
