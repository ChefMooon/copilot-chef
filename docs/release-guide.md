# Release Guide

This guide covers the current GitHub Actions release flow for the Electron app.

---

## How Releases Work

| Artifact | Trigger tag | Workflow | Output |
|---|---|---|---|
| Copilot Chef desktop app | `v*` | `release-client.yml` | GitHub Release + Windows installer artifacts |

Pushing a `v` tag starts the desktop release workflow.

---

## Before Tagging

- Ensure `main` contains the release commit.
- Update `package.json` `version` to match the intended release.
- Update `CHANGELOG.md` if you are maintaining release notes.
- Verify local validation passes:

```bash
npm run lint
npm run test
npm run build
```

The release workflow reruns build, lint, and test on GitHub before packaging, so a bad tag should fail before publishing.

---

## Create a Release

Tag from the repository root:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## What the Workflow Does

`release-client.yml` runs on `windows-latest` and:

1. Checks out the repo.
2. Installs dependencies with `npm ci`.
3. Generates the Prisma client.
4. Builds the Electron app with `npm run build`.
5. Reruns `npm run lint`.
6. Reruns `npm run test`.
7. Packages and publishes the Windows installer with `electron-builder --win --publish always`.

The workflow uses the repository `GITHUB_TOKEN` to publish the release assets defined by the Electron Builder config in `package.json`.

---

## Verify the Release

1. Open GitHub Releases and confirm the `v1.0.0` release exists.
2. Confirm the Windows installer artifacts were uploaded.
3. Download and install the build on Windows.
4. Launch the app and confirm startup, local server boot, and settings persistence.
5. If auto-update is part of the release you are testing, confirm the updater can see the GitHub-hosted release feed.

---

## Hotfixes and Prereleases

Patch releases use the same flow:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Prerelease-style semver tags still match the workflow trigger as long as they start with `v`, for example:

```bash
git tag v1.0.1-rc.1
git push origin v1.0.1-rc.1
```

---

## Troubleshooting

**Release workflow did not start**
Confirm the pushed tag begins with `v` and exists on the remote: `git push origin v1.0.0`.

**Release validation failed**
Run `npm run lint`, `npm run test`, and `npm run build` locally. The workflow uses the same commands.

**Windows packaging failed**
Check the Electron Builder publish config in `package.json`, the repository release permissions, and the workflow logs from the `Package & publish Windows release` step.

**Prisma-related packaging errors**
Confirm `npm run db:generate` succeeds locally and that the Prisma resources listed under `build.extraResources` in `package.json` are still correct.
