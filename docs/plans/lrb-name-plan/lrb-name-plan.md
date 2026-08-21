# Implementation Plan: Local Recipe Book Naming Cleanup

## Source
- Document: `docs/plans/lrb-name-plan/lrb-name-spec.md`
- Basis: impact assessment

## Objective
Replace the remaining live `copilot-chef` product, package, storage, configuration, browser, protocol, and documentation identifiers with the settled Local Recipe Book contract. The change is an intentional breaking release: old database, photo, settings, browser, environment, configuration-file, protocol, and installed-app identities are not migrated or used as fallbacks. Users recover content through the existing `.lrb` export and re-import workflow.

## Scope
- In scope: live application and package identity; Electron application identity; database and meal-photo paths; Prisma and runtime configuration; environment variables and config discovery; browser persistence and config events; drag-and-drop MIME values; stream sentinel; export filenames; active documentation and links; focused tests; build outputs regenerated from source; fresh-user-data, archive import, and packaged Windows validation.
- Out of scope: historical `docs/archive` content; old exported JSON files already held by users; automatic database or photo migration; compatibility fallbacks or warnings; raw SQLite import; preservation of old device settings; unrelated `@github/copilot-sdk` names; manual edits to generated `out/` or `dist/` artifacts.

## Assumptions and Open Decisions
- The naming decisions are closed: use `local-recipe-book` for package, filenames, storage keys, and protocol values; use `LOCAL_RECIPE_BOOK_*` for environment variables; use `com.local-recipe-book.app` for the Electron app ID.
- The configured Git remote remains `ChefMooon/local-recipe-book`; release metadata may continue to target that repository.
- The `.lrb` archive is a content recovery mechanism, not a complete device migration. It does not restore the database, raw settings, secrets, or device configuration.
- Old installed builds do not retain update continuity after the app ID change. This must be stated in release documentation and verified in the packaged Windows acceptance checks.
- No naming-scope decisions remain open. Any implementation discovery must preserve the settled identifiers and hard-break behavior.

## Phases
### Phase 1: Contract inventory and implementation baseline
- Goal: Establish a verified inventory of live naming surfaces, tests, documentation links, generated artifacts, and release configuration before changing the contracts.
- Tasks:
	1. Search the live source, active documentation, scripts, package metadata, tests, and build configuration for `copilot-chef` identifiers, excluding historical `docs/archive` content and disposable generated output where appropriate.
	2. Identify every producer and consumer for the selected environment prefix, config filenames and search directory, storage paths, browser localStorage keys, config update event, meal-plan drag MIME type, stream sentinel, and export filename defaults.
	3. Confirm the repository's generated-artifact tracking status and the available test, lint, build, IPC-doc-check, packaging, and archive import workflows.
	4. Record any discovery that changes the affected surface before implementation; do not introduce compatibility behavior.
- Dependencies: Source assessment and settled naming decisions.
- Validation: The inventory covers the C1-C4 surfaces from the source assessment, and each identified producer has an identified consumer or an explicit reason it is standalone.
- Exit criteria: The implementation surface is complete enough to apply the hard break atomically, with no unresolved naming decision.

### Phase 2: Update package, runtime identity, and storage paths
- Goal: Make new Local Recipe Book builds own only the new package identity, Electron identity, database location, and meal-photo locations.
- Tasks:
	1. Change the npm package and lockfile metadata to `local-recipe-book`, preserving unrelated dependency names and metadata.
	2. Change the Electron `appId` to `com.local-recipe-book.app` and update live product, log, updater, and release identity strings where the baseline inventory shows they are active.
	3. Change the default SQLite filename and all runtime, Prisma, development fallback, seed, test, and datasource path contracts to the Local Recipe Book names, including WAL/SHM sibling behavior and temporary test directories where applicable.
	4. Change the meal-photo fallback directory to `.local-recipe-book/meal-photos`, and verify the packaged `{userData}/data/meal-photos` contract explicitly rather than assuming its generic directory name needs no review.
	5. Ensure old database and photo locations are ignored without migration, fallback, cleanup, or warning logic.
- Dependencies: Phase 1 inventory; Windows development process must not hold Prisma engine files during any required generation or database update operation.
- Validation: Focused path and bootstrap tests demonstrate that new locations are selected and old locations are not read; Prisma/client generation or the repository's documented Windows-safe equivalent completes; package metadata and app ID tests or inspection show the new identity.
- Exit criteria: A clean runtime configuration creates and uses only the Local Recipe Book database and photo paths, with no old-location fallback.

### Phase 3: Rename configuration, browser, and wire contracts
- Goal: Move all live external and internal naming contracts to the coordinated Local Recipe Book values.
- Tasks:
	1. Rename all `COPILOT_CHEF_*` and `COPILOT_CHEF_CLIENT_*` environment mappings and examples to `LOCAL_RECIPE_BOOK_*`, including database and seed settings.
	2. Rename active server/client config filenames and the config search directory to the Local Recipe Book names.
	3. Rename browser localStorage keys and the renderer configuration update event, ensuring browser reconnect and persistence code uses the new keys only.
	4. Rename the meal-plan drag MIME type in the shared calendar helpers and every renderer producer and consumer.
	5. Rename the shared stream sentinel and update its producer/consumer contract, adding focused coverage for streamed response framing.
	6. Rename default JSON export filenames and any active user-facing export fallbacks to the Local Recipe Book slug.
- Dependencies: Phase 2 runtime identity; Phase 1 producer/consumer inventory. These changes must ship as one breaking contract with no old-name compatibility layer.
- Validation: Focused tests cover config loading, browser persistence and reconnect, drag-and-drop, stream sentinel production/consumption, and export defaults. A scoped live-source search finds no old identifiers outside explicitly excluded historical or generated locations.
- Exit criteria: All live producers and consumers agree on the new values, and stale browser/config/protocol contracts are intentionally unsupported.

### Phase 4: Align active documentation, tests, and generated outputs
- Goal: Make operational guidance and repository validation describe the new identity and the intentional break.
- Tasks:
	1. Update `README.md`, architecture, configuration, developer, release, data-management, structure, and other relevant active documentation to remove obsolete compatibility guidance and document the new paths and identifiers.
	2. Rename active documentation files whose names contain `copilot-chef` to `local-recipe-book` names, then update all active links and the workspace instruction map; leave `docs/archive` unchanged.
	3. Update relevant active plans/reports only where required to keep current operational guidance coherent, while preserving historical reports as historical records.
	4. Add or update tests and build checks for the hard-break behavior, including absence of old live keys and path fallback behavior.
	5. Regenerate `out/` and `dist/` through the normal build/package process rather than editing generated output manually, and check whether those artifacts are committed or disposable.
- Dependencies: Phases 2 and 3; documentation ownership and link locations identified in Phase 1.
- Validation: Run `npm run test`, `npm run lint`, `npm run build`, and `npm run docs:check:ipc`; verify active links and the scoped live-source search; inspect regenerated output for the new identity.
- Exit criteria: Active docs, tests, and generated products consistently describe Local Recipe Book, while historical archive content remains untouched.

### Phase 5: Fresh-user-data, archive recovery, and packaged Windows release acceptance
- Goal: Prove the breaking release works for a clean installation and that the documented `.lrb` recovery path restores supported content before release publication.
- Tasks:
	1. Export an `all` `.lrb` archive from the pre-change installation before installing or launching the breaking build.
	2. Launch the new build with an isolated user-data directory and verify creation/use of the new database and photo paths, absence of old-path reads, and expected WAL/SHM behavior.
	3. Import the archive into the fresh database and validate meals, recipes, opt-in preferences, and photos; separately confirm that runtime settings, tokens, secrets, and device configuration are not incorrectly represented as migrated.
	4. Build an unpacked Windows package and inspect the app ID, executable identity, install/start-menu behavior, and update metadata for `com.local-recipe-book.app`.
	5. Confirm release notes and release guidance state the new app identity, renamed environment/config/browser/protocol contracts, hard-break storage behavior, required export/re-import sequence, and loss of update continuity from old installs.
- Dependencies: All prior phases pass; a valid pre-change archive exists; Windows packaging prerequisites are available; no running Electron process locks files needed by packaging or Prisma generation.
- Validation: Execute the source assessment's fresh-user-data and export/import checks; complete the Windows packaged identity inspection; run the full required test, lint, build, and documentation checks again on the release candidate.
- Exit criteria: The new build uses only the new contracts, supported content survives archive recovery, the Windows identity matches the selected app ID, and release documentation accurately communicates the intentional incompatibilities.

## Cross-Phase Dependencies
- Phase 1 must precede all edits so every producer and consumer of a renamed contract is updated together.
- C2 and C3 must ship atomically: new storage paths cannot coexist with old environment overrides or config discovery without creating ambiguous data ownership.
- Package/app identity changes affect installed behavior and update continuity; package acceptance must occur after source changes and regenerated outputs are available.
- Documentation renames and link updates depend on the final active-source names, but must be complete before release validation so operational instructions are tested as part of the candidate.
- Prisma generation and database update commands on Windows must be sequenced around any running Electron development process to avoid locked engine files.

## Risks and Mitigations
- Changing the Electron `appId` creates a new Windows application identity and may break shortcuts, install behavior, notifications, and update continuity: inspect an unpacked Windows package and document the break before publication.
- Users can lose access to old databases, photos, settings, and browser state if they do not export first: require a pre-upgrade `.lrb` export and document that archive recovery covers content only.
- A missed producer or consumer can silently break streaming, drag-and-drop, browser persistence, or configuration: maintain the Phase 1 inventory, add focused contract tests, and run the scoped absence search.
- Old WAL/SHM files and photo directories may remain orphaned: do not delete or migrate them; verify the new runtime never reads them and describe the hard-break behavior.
- Historical documentation may be accidentally rewritten during cleanup: constrain searches and edits to active documentation, preserve `docs/archive`, and review the changed-file set.
- Prisma engine files may be locked on Windows during generation: stop the development process or use the repository's documented Windows-safe generation/database workflow before retrying.
- Generated output may retain stale names if the rebuild is incomplete: regenerate from source and inspect packaging output rather than manually patching artifacts.

## Final Validation
- Run the complete automated suite: `npm run test`, `npm run lint`, `npm run build`, and `npm run docs:check:ipc`.
- Run a scoped live-source search that excludes `docs/archive`, disposable `out/` and `dist/` output, `.copilot-sessions`, and virtual-environment metadata; confirm no unintended live `copilot-chef` identifiers remain.
- Verify the new package slug, Electron app ID, runtime log/product identity, database filename, photo fallback path, environment prefix, config filenames/search directory, browser keys/event, drag MIME type, stream sentinel, and export defaults.
- With isolated user data, confirm the new build creates and uses only new locations and ignores old database/photo locations without migration or fallback.
- Import a representative `all` `.lrb` archive and validate supported content, including photo-bearing data and opt-in preferences; confirm excluded device/runtime secrets are not treated as migrated.
- Build and inspect an unpacked Windows package for `com.local-recipe-book.app`, executable/install identity, start-menu behavior, and updater metadata.
- Review active documentation links and release guidance, and confirm historical `docs/archive` content was preserved.

## Completion Criteria
- All C1-C4 source assessment requirements are implemented and mapped to passing tests or inspection evidence.
- The live application and package use the Local Recipe Book naming contract exclusively, with the intentional hard break and no old-path fallback.
- Configuration, browser, drag/drop, stream, export, storage, and packaging producers and consumers are coordinated and covered by focused validation.
- Active documentation and workspace instruction links are updated, while historical archive documents remain unchanged.
- Generated build and package outputs are regenerated from the updated source.
- Fresh-user-data and `.lrb` export/import acceptance checks pass.
- Windows packaging confirms the new app identity and release documentation explicitly communicates the loss of old-install update continuity.
