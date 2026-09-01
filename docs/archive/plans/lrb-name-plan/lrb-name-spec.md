# Pre-Plan Impact Assessment: Local Recipe Book Naming Cleanup

## Decision Summary
- Overall disposition: ready for implementation handoff
- Confidence: high for the live-source impact and the selected naming contract; medium for packaging/update behavior because the hard break intentionally abandons the old installed-app identity
- Scope assessed: live application source, Electron packaging, runtime configuration, database and photo paths, browser persistence/protocol identifiers, tests, active documentation, and generated build outputs. Historical `docs/archive` content is intentionally excluded.

The requested change is worthwhile and internally coherent because the product is already presented as Local Recipe Book while several live contracts still use `copilot-chef`. The user has confirmed that this is a breaking change: old database/photo locations will not be migrated or used as a fallback, and the exported `.lrb` archive followed by re-import is the recovery path.

## Proposed Changes
### C1: Rename live product and package identity
- Intended outcome: Local Recipe Book is the only live product name and package/build identity.
- In scope: npm package name and lockfile metadata, application log prefix, Electron `appId`, active UI/runtime strings, updater/release metadata where applicable, and generated output after rebuilding.
- Out of scope: historical references in `docs/archive`, old reports/plans that document the former product, and unrelated `@github/copilot-sdk` functionality or dependency names.
- Dependencies: confirm the release/update behavior for the new Electron `appId`; the configured Git remote already points to `ChefMooon/local-recipe-book`.
- Decisions: use package and machine-readable slug `local-recipe-book`; use Electron app ID `com.local-recipe-book.app`; accept the resulting new Windows application identity and update-continuity break.

### C2: Move database and file locations with a hard break
- Intended outcome: new installations and the renamed build use Local Recipe Book storage paths, while old `copilot-chef` data is ignored.
- In scope: default SQLite filename, Prisma/default datasource URL, Electron `{userData}` data path, development fallback path, meal-photo fallback directory, and any active documentation or scripts that describe these locations.
- Out of scope: automatic copy/rename, startup migration, compatibility fallback, raw SQLite import, or preservation of old device settings.
- Dependencies: the existing export/import archive workflow must remain the supported recovery route; the user has already exported data and will re-import it after the change.
- Decisions: use `local-recipe-book.db` and `.local-recipe-book`; verify every path, including WAL/SHM siblings and test temporary directories.

### C3: Rename live configuration, browser, and wire identifiers
- Intended outcome: no live runtime contract continues to publish or consume `copilot-chef` identifiers.
- In scope: `COPILOT_CHEF_*` environment variables and `.env` examples, config filenames and config search directory, browser localStorage keys, config update event, meal-plan drag MIME type, stream sentinel prefix, and default JSON export filenames.
- Out of scope: historical archive documents and old exported JSON filenames already held by the user; those files are user data and do not need in-place rewriting.
- Dependencies: all producers and consumers must change together because this is a hard break; tests need to assert the new names and the absence of old live keys.
- Decisions: use `LOCAL_RECIPE_BOOK_*` for environment variables and `local-recipe-book` for filenames, storage keys, and protocol values. The sentinel is an especially sensitive stream contract and needs a focused producer/consumer test.

### C4: Align active documentation and validation with the new contract
- Intended outcome: active setup, architecture, configuration, release, and data-management guidance describes only Local Recipe Book live behavior and the intentional break.
- In scope: `README.md`, `docs/ARCHITECTURE.md`, `docs/copilot-chef-config.md` and its ownership references, `docs/developer-guide.md`, `docs/release-guide.md`, `docs/STRUCTURE.md`, relevant active plans/reports, source tests, build checks, and a clean rebuild of generated `out/` output.
- Out of scope: bulk rewriting `docs/archive` or treating generated build artifacts as source edits.
- Dependencies: rename active documentation filenames from `copilot-chef-*` to `local-recipe-book-*`, update all active links and the workspace instruction map, and leave `docs/archive` unchanged.
- Decisions: generated `out/` and `dist/` content is disposable and should be regenerated rather than manually edited; committed/generated status must be checked during implementation.

## Clarifications
- Asked and answered:
	- Historical references in `docs/archive` may remain as historical context.
	- All live identifiers should be renamed, including runtime, packaging, storage, protocol, and user-facing export names.
	- Old `copilot-chef` locations should be ignored; no warning, fallback, or automatic migration is required.
	- This is a hard break; the user has exported data and will re-import it.
- Still needed:
	- None for the naming scope. Implementation must preserve the explicit hard-break release behavior and validate the new app identity in a packaged Windows build.
- Assumptions used for this assessment:
	- Old settings and database contents do not need migration because the archive workflow is the chosen breakover mechanism.

## Current-State Evidence
- The product is already named Local Recipe Book in the Electron window/tray, `productName`, and architecture documentation, but the live package is still named `copilot-chef` and the Electron builder `appId` is `com.copilot-chef.app` in [package.json](../../package.json). The selected replacement is `local-recipe-book` with app ID `com.local-recipe-book.app`.
- The Electron startup path resolves the default database to `{userData}/data/copilot-chef.db`, reads and writes `COPILOT_CHEF_DATABASE_URL`, and uses `COPILOT_CHEF_SEED_DATABASE` in [src/main/server/start.ts](../../src/main/server/start.ts).
- Prisma and the shared server schema still use `COPILOT_CHEF_DATABASE_URL` and `file:./data/copilot-chef.db` in [prisma/schema.prisma](../../prisma/schema.prisma), [src/main/server/lib/prisma.ts](../../src/main/server/lib/prisma.ts), and [src/shared/config/server-config.ts](../../src/shared/config/server-config.ts).
- The meal-photo fallback path is `.copilot-chef/meal-photos` in [src/main/server/lib/meal-photo-storage.ts](../../src/main/server/lib/meal-photo-storage.ts); the packaged Electron path is under `{userData}/data/meal-photos` and therefore needs explicit path-contract review even though its directory name is generic.
- Shared config loading maps multiple `COPILOT_CHEF_*` and `COPILOT_CHEF_CLIENT_*` variables and searches for `copilot-chef-server.toml`, `copilot-chef-client.toml`, and `~/.config/copilot-chef` in [src/shared/config/loader.ts](../../src/shared/config/loader.ts).
- Browser persistence uses `copilot-chef.browser.*` keys and the renderer config event uses `copilot-chef:config-updated` in [src/renderer/lib/platform/browser.ts](../../src/renderer/lib/platform/browser.ts) and [src/renderer/lib/config.ts](../../src/renderer/lib/config.ts).
- Drag-and-drop producers/consumers use `application/x-copilot-chef-meal-plan-drag` in [src/renderer/lib/calendar.ts](../../src/renderer/lib/calendar.ts), [src/renderer/components/meal-plan/DayView.tsx](../../src/renderer/components/meal-plan/DayView.tsx), and [src/renderer/components/meal-plan/WeekView.tsx](../../src/renderer/components/meal-plan/WeekView.tsx).
- Export fallbacks and recipe export names still use `copilot-chef` in [src/renderer/lib/api.ts](../../src/renderer/lib/api.ts), [src/renderer/pages/recipes.tsx](../../src/renderer/pages/recipes.tsx), and [src/main/server/routes/preferences.ts](../../src/main/server/routes/preferences.ts).
- The shared stream sentinel is `COPILOT_CHEF_EVENT` in [src/shared/api/constants.ts](../../src/shared/api/constants.ts); changing it requires coordinated stream producer/consumer coverage.
- Active operational docs explicitly describe the old identifiers as compatibility identifiers, including [docs/ARCHITECTURE.md](../ARCHITECTURE.md), [docs/copilot-chef-config.md](../copilot-chef-config.md), [docs/developer-guide.md](../developer-guide.md), and [docs/STRUCTURE.md](../STRUCTURE.md). Those statements become incorrect after this hard break; the selected implementation will rename active `copilot-chef-*` documentation files to `local-recipe-book-*` and update their links.
- The archive workflow is already a supported `.lrb` contract and does not include the SQLite database, raw settings, secrets, or device configuration, as documented in [docs/data-management.md](../data-management.md). This supports export/re-import of content but is not a migration of runtime identity or settings.
- The configured Git remote is already `https://github.com/ChefMooon/local-recipe-book.git`; release metadata can therefore target the existing repository rather than inventing a new remote destination.
- Generated `out/` and `dist/` artifacts contain stale strings, but they are build products and should be regenerated after source/package changes. The repository also contains many historical matches under `docs/archive`, which are intentionally excluded by the confirmed scope.

## Impact Findings
### C1: Rename live product and package identity
- Classification: beneficial with conditions
- Positive impact: removes contradictory branding and makes new installers, logs, package metadata, Windows identity, and release artifacts consistently identify Local Recipe Book.
- Negative impact or unintended consequence: changing `appId` can create a distinct Windows application identity, affect shortcuts, installed location behavior, notification identity, and update continuity. Changing package identity also invalidates assumptions in scripts and release tooling.
- Affected surfaces: `package.json`, `package-lock.json`, `src/main/index.ts`, logging/scripts, release config, tests, and regenerated build/package output.
- Dependencies and interactions: the update provider already points at the Local Recipe Book GitHub repository, but the old installed app identity may not receive or apply updates after the change.
- Confidence and rationale: high for source impact; medium for installer/update consequences because changing to `com.local-recipe-book.app` intentionally creates a new Windows application identity.
- Discriminating check: build an unpacked Windows package and compare `appId`, executable identity, install/start-menu behavior, and update metadata against the intended hard-break release.
- Recommendation: proceed with the selected app ID and document that old installed builds do not retain update continuity.

### C2: Move database and file locations with a hard break
- Classification: beneficial with conditions
- Positive impact: new runtime artifacts no longer carry the obsolete product name, and the deliberate break avoids ambiguous mixed-version data ownership.
- Negative impact or unintended consequence: old content, preferences, and photos disappear from the new runtime until the archive is re-imported; raw settings and device configuration are not restored by `.lrb` archives. Existing WAL/SHM files and photo files at old locations will be orphaned rather than cleaned up.
- Affected surfaces: Electron startup, Prisma datasource/defaults, runtime bootstrap, photo storage, seed/backfill scripts, tests, developer docs, and reset/release procedures.
- Dependencies and interactions: export must happen before installing/running the breaking build; import must be tested against a fresh database and photo-bearing archive. Prisma generation/db push must be sequenced carefully on Windows because a running Electron process can lock the engine DLL.
- Confidence and rationale: high; the storage owners are directly identified and the archive contract explicitly excludes raw database/settings migration.
- Discriminating check: with an isolated user-data directory, launch the new build, assert the new database/photo paths are created, verify no old path is read, then import an `all` archive and validate meals, recipes, preferences opt-in, and photos.
- Recommendation: proceed with a documented pre-upgrade export and fresh-install/re-import acceptance test.

### C3: Rename live configuration, browser, and wire identifiers
- Classification: beneficial with conditions
- Positive impact: eliminates stale external contracts and makes browser persistence, localStorage, drag/drop, event signaling, and stream framing match the product identity.
- Negative impact or unintended consequence: every producer and consumer must change atomically. Existing browser sessions, saved connection data, external scripts, `.env` files, config files, and clients using the old sentinel/MIME value will stop working by design.
- Affected surfaces: shared config loader/schema, Electron startup, Prisma, `.env` examples, browser adapter, renderer config/calendar, API export helpers, stream constants, and focused tests.
- Dependencies and interactions: `LOCAL_RECIPE_BOOK_*` must be consistent across Prisma CLI, Electron runtime, scripts, tests, and documentation. The sentinel and MIME type are protocol values, not mere display strings.
- Confidence and rationale: high for the affected code; medium for external consumers because repository search cannot reveal untracked personal configs or LAN browser storage.
- Discriminating check: run a clean test suite with only the new env/config names, clear browser storage, exercise LAN/browser reconnect, drag a meal, consume a streamed response, and assert a repository-wide live-source search finds no old identifiers outside excluded archive/generated paths.
- Recommendation: proceed as one coordinated breaking-contract change, with an explicit release note and the selected `LOCAL_RECIPE_BOOK_*`/`local-recipe-book` contract.

### C4: Align active documentation and validation with the new contract
- Classification: beneficial with conditions
- Positive impact: prevents setup/reset/release instructions from recreating old paths or compatibility assumptions and makes the hard break operable for the sole user.
- Negative impact or unintended consequence: renaming active documentation files creates link churn and requires updating the workspace instruction map; historical reports can become misleading if they are not clearly labeled as pre-break evidence.
- Affected surfaces: active docs, `.github/copilot-instructions.md`, tests, build scripts, generated artifacts, and release documentation.
- Dependencies and interactions: docs checks and package/build checks must run after source changes; archive policy should continue to explain why `docs/archive` retains old names.
- Confidence and rationale: high; current docs explicitly say the old names are retained for compatibility, which will be false after implementation.
- Discriminating check: run `npm run test`, `npm run lint`, `npm run build`, `npm run docs:check:ipc`, and a scoped live-source search that excludes `docs/archive`, `.copilot-sessions`, `out`, `dist`, and virtual-environment metadata.
- Recommendation: proceed with active documentation file renames, keep historical docs untouched, and update the archive README if needed to explain the boundary.

## Cross-Change Considerations
- Sequence the work as: update source contracts and paths using the settled `local-recipe-book`/`LOCAL_RECIPE_BOOK_*`/`com.local-recipe-book.app` contract; update tests; rename active docs and links; regenerate outputs; run clean-build and fresh-user-data validation; export/import acceptance test; then package/release.
- C2 and C3 must ship together. A new database path with an old env override or old config discovery would produce an ambiguous split-brain migration.
- C1 and C3 affect installed clients and saved browser state. The release notes should state that old settings, browser localStorage, env names, config filenames, protocol identifiers, and app identity are intentionally incompatible.
- The `.lrb` archive is content recovery, not a complete device migration: runtime settings, tokens, secrets, and database files remain excluded by contract.
- Do not rewrite `docs/archive` or manually edit `out/`/`dist/`; preserve the historical boundary and regenerate build products from source.
- Existing release guidance says compatibility identifiers were intentionally retained. That rationale must be removed or superseded in active docs, while the historical report remains accurate as a record of the previous state. The release must explicitly call out the new app identity and lack of update continuity from old installs.

## Handoff Options
1. **Continue pre-planning**: no additional naming decisions are required. Any implementation discovery must preserve the settled identifiers and hard-break behavior.
2. **Hand off to the planning agent**: implement the hard break atomically with package/protocol slug `local-recipe-book`, env prefix `LOCAL_RECIPE_BOOK_`, app ID `com.local-recipe-book.app`, active documentation renames, preserved `docs/archive`, and fresh-user-data plus export/re-import validation before release.

Recommended handoff: proceed to implementation planning. Treat packaged Windows identity/update discontinuity as an explicit release acceptance condition, not an unresolved naming decision.

## Quality Gate
- Every requested change was decomposed into live identity, storage break, runtime contracts, and documentation/validation work.
- Material clarifications were asked and answered for archive scope, live identifiers, and old-location behavior.
- Current-state claims are tied to the owning source, configuration, documentation, test, build, or repository evidence.
- Benefits, risks, dependencies, and cross-change interactions are explicit.
- Each impact classification includes a cheap discriminating check.
- The app ID, package slug, env prefix, protocol slug, documentation-file policy, and update-continuity behavior are resolved and visible before implementation handoff.
- No application code or unrelated files were modified; only this requested pre-plan document was written.
