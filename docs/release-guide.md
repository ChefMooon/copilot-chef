# Release Guide

This guide walks through everything needed to cut a production release of Copilot Chef. The server and client are released independently via separate GitHub Actions workflows.

---

## How Releases Work

| Artifact | Trigger tag | Workflow | Output |
|---|---|---|---|
| `copilot-chef-server` npm package | `server-v*` | `release-server.yml` | GitHub Release + `.tgz` tarball |
| Copilot Chef desktop app | `client-v*` | `release-client.yml` | GitHub Release + installers for Windows, macOS, Linux |

Pushing a tag to GitHub is all it takes to start a build. The workflows handle everything else.

---

## One-Time Setup (Required Before First Release)

### 1. Generate Tauri Signing Keys

The Tauri updater requires a signing keypair so the desktop app can verify update authenticity. This is a one-time step. Run from the repo root:

```bash
cd src/client
npx @tauri-apps/cli@^2 signer generate -w tauri.key
```

You will be prompted for a password to protect the private key. Press Enter twice to use no password, or set one and save it for the next step.

This produces two files:

- `tauri.key` — private key (keep this secret, never commit it)
- `tauri.key.pub` — public key (this goes into `tauri.conf.json`)

### 2. Set GitHub Repository Secrets

In your GitHub repository → **Settings → Secrets and variables → Actions**, add:

| Secret name | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of `tauri.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password you set during key generation (leave blank if none) |

### 3. Add the Public Key to `tauri.conf.json`

Open `src/client/src-tauri/tauri.conf.json` and set the `plugins.updater.pubkey` field to the contents of `tauri.key.pub`:

```json
"plugins": {
  "updater": {
    "active": true,
    "endpoints": [
      "https://github.com/copilot-chef/copilot-chef/releases/latest/download/latest.json"
    ],
    "dialog": true,
    "pubkey": "<paste contents of tauri.key.pub here>"
  }
}
```

Commit this change to `main` before tagging a client release.

### 4. Create a CHANGELOG.md

The server release notes reference `CHANGELOG.md` but it does not yet exist. Create it at the repo root before the first release. Minimum structure:

```markdown
# Changelog

All notable changes to this project will be documented here.

## [1.0.0] - YYYY-MM-DD

### Added
- Initial production release
```

---

## Pre-Release Checklist

Run through this before pushing any release tag.

- [ ] All tests pass locally: `npm run test`
- [ ] No lint errors: `npm run lint`
- [ ] CI is green on `main`
- [ ] `CHANGELOG.md` is up to date at the repo root
- [ ] Tauri signing keys are generated and secrets are set in GitHub (first release only)
- [ ] `pubkey` is filled in `tauri.conf.json` (first release only)
- [ ] Versions are bumped in all files (see section below)
- [ ] All version-bumped files are committed and pushed to `main`

---

## Bumping Versions

For the initial `0.1.0` release, no version changes are needed — all packages are already at `0.1.0`.

For future releases, update the version in these files before tagging:

| File | Field |
|---|---|
| `package.json` | `"version"` |
| `src/core/package.json` | `"version"` |
| `src/shared/package.json` | `"version"` |
| `src/server/package.json` | `"version"` |
| `src/client/package.json` | `"version"` |
| `src/client/src-tauri/tauri.conf.json` | `"version"` |
| `src/client/src-tauri/Cargo.toml` | `version` |

After editing, commit all changes:

```bash
git add .
git commit -m "chore: bump versions to <new-version>"
git push origin main
```

Wait for CI to go green before tagging.

---

## Releasing the Server

### 1. Tag and push

```bash
git tag server-v1.0.0
git push origin server-v1.0.0
```

### 2. What happens automatically

The `release-server.yml` workflow triggers and:

1. Installs dependencies
2. Builds `shared` → `core` → `server` in dependency order
3. Runs all server tests
4. Packs the server as `copilot-chef-server-1.0.0.tgz`
5. Creates a GitHub Release named **"Server server-v1.0.0"** with the tarball attached

### 3. Verify

1. Go to **GitHub → Releases** and confirm `server-v1.0.0` appeared
2. Check the release has the `.tgz` asset attached
3. Test by installing the tarball: `npm install -g ./copilot-chef-server-1.0.0.tgz`

---

## Releasing the Client

### 1. Tag and push

```bash
git tag client-v1.0.0
git push origin client-v1.0.0
```

### 2. What happens automatically

The `release-client.yml` workflow triggers a matrix build across three platforms simultaneously:

| Platform | Output |
|---|---|
| `windows-latest` | `.msi` / `.exe` installer |
| `macos-latest` | Universal `.dmg` (Apple Silicon + Intel) |
| `ubuntu-latest` | `.deb` / `.AppImage` |

Each job uses `tauri-apps/tauri-action` which builds the Tauri app, signs the bundle with your `TAURI_SIGNING_PRIVATE_KEY`, and uploads installers to the GitHub Release. It also uploads a `latest.json` file that the in-app updater polls.

### 3. Verify

1. Go to **GitHub → Releases** and confirm `client-v1.0.0` appeared with assets for all three platforms
2. Confirm `latest.json` is present in the release assets (required by the Tauri updater)
3. Install the app on each platform and confirm it launches
4. On an older installed version, confirm the update prompt appears

---

## Pre-release / Beta Tags

Both workflows automatically mark releases as pre-release if the tag contains a hyphen (e.g. `server-v1.0.0-beta.1` or `client-v1.0.0-rc.1`). Use this for testing before a stable release:

```bash
git tag server-v1.0.0-rc.1
git push origin server-v1.0.0-rc.1
```

The server updater (`src/server/src/updater.ts`) filters out pre-releases when checking for updates, so beta tags will not be served to existing users.

---

## Hotfix Releases

For a patch release (e.g. `1.0.1`):

1. Apply fixes to `main` (or a `hotfix/1.0.1` branch merged to `main`)
2. Bump versions to `1.0.1` in all files, commit, push
3. Tag the affected component(s):

```bash
git tag server-v1.0.1
git push origin server-v1.0.1

# or
git tag client-v1.0.1
git push origin client-v1.0.1
```

You only need to tag the component that changed. Server and client releases are independent.

---

## Troubleshooting

**CI workflow does not trigger after tagging**
Ensure you pushed the tag itself (`git push origin server-v1.0.0`), not just the commit. `git push --tags` also works.

**Tauri build fails with signing error**
Check that both `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets are set correctly in GitHub. The password secret must exist even if it is an empty string.

**`latest.json` is missing from the client release**
This file is generated by `tauri-apps/tauri-action`. If the signing key is missing or the build fails mid-way, it may not be created. Re-run the failed workflow job once the secret issue is resolved.

**Server update check returns no update**
The `checkForUpdate` function in `src/server/src/updater.ts` compares semver numerically. Confirm the tag name exactly matches `server-v<semver>` with no extra characters.
