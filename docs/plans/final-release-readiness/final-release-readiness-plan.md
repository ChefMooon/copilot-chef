# Final Release Readiness Plan

> Status: Proposed. This document defines the checks and decisions required before the first beta release. It does not authorize application code changes by itself.

## 1. Goal

Prepare Local Recipe Book for an initial beta release with a stable SQLite database contract, recoverable user data, and evidence that a packaged Windows build works with both fresh and existing databases.

The release should preserve the current database approach:

- `prisma/schema.prisma` remains the declarative schema source.
- `src/main/server/lib/schema.ts` remains the runtime raw SQL creation and compatibility layer.
- `src/main/server/lib/bootstrap.ts` remains the owner of the database initialization sequence.
- Prisma migration history is not introduced as a last-minute release change.

## 2. Scope

This plan covers:

- Final database schema review and freeze
- Fresh-database creation
- Upgrade and compatibility behavior for existing databases
- SQLite pragmas and startup initialization
- `.lrb` export, import, replace, and recovery behavior
- Packaged Windows validation
- Release documentation and operator signoff

It does not cover a broad database architecture rewrite, a switch away from SQLite, or conversion to Prisma migrations before beta.

## 3. Release Gates

The beta is ready only when every gate below has evidence attached to the release checklist or issue.

### Gate A: Freeze the final schema

- [ ] Review the final models, fields, indexes, unique constraints, and relations in `prisma/schema.prisma`.
- [ ] Classify every change as additive, data-transforming, constraint-changing, renamed, or destructive.
- [ ] Confirm the matching table, index, column, repair, and backfill behavior in `src/main/server/lib/schema.ts`.
- [ ] Confirm that required fields have safe defaults or an explicit backfill before the application reads them.
- [ ] Run `npm run db:push` and `npm run db:generate` with Electron stopped on Windows.
- [ ] Do not make further schema changes after the release candidate database tests begin.

### Gate B: Test database creation and upgrade

Use isolated temporary database files so the test does not depend on a developer's existing app data.

- [ ] Start the app against an empty database and confirm all expected tables and indexes are created.
- [ ] Start the app against a database created by the previous beta or release candidate.
- [ ] Verify existing meals, recipes, groceries, prep lists, preferences, and photos remain usable after startup.
- [ ] Exercise each compatibility repair that applies to the final schema.
- [ ] Verify concurrent bootstrap callers initialize once and a failed initialization can be retried.
- [ ] Confirm production/package startup does not seed sample data unless explicitly enabled.
- [ ] Run SQLite integrity checks after fresh creation and after upgrade.

The minimum automated coverage should include a real temporary SQLite database for fresh creation and upgrade reconciliation. Mock-only bootstrap tests are useful for lifecycle ownership but cannot prove that the raw SQL schema matches the Prisma client.

### Gate C: Verify SQLite runtime settings

- [ ] Confirm `journal_mode` is `WAL`.
- [ ] Confirm `busy_timeout` is `5000` milliseconds.
- [ ] Confirm `synchronous` is `NORMAL`.
- [ ] Confirm `foreign_keys` is enabled.
- [ ] Exercise a representative read/write workflow after startup and inspect logs for connection or lock errors.

### Gate D: Verify user data recovery

- [ ] Export an `all` `.lrb` archive from a realistic fixture database.
- [ ] Validate and preview the archive without mutation.
- [ ] Test merge with conflicts and confirm explicit decisions are required.
- [ ] Test replace and retain the generated recovery archive outside temporary storage.
- [ ] Verify meal-photo export and restoration for supported image types.
- [ ] Inject or simulate a transaction failure and confirm database changes roll back and staged photo writes are compensated.
- [ ] Confirm the archive contains no SQLite files, WAL/SHM files, secrets, or device settings.
- [ ] Record the archive format/schema version separately from the SQLite schema version; they are different contracts.

### Gate E: Validate the packaged Windows build

- [ ] Run the local delivery checks:

  ```bash
  npm run lint
  npm run test
  npm run build
  npm run docs:check:ipc
  ```

- [ ] Build or obtain the Windows installer through the release workflow.
- [ ] Install the package on a clean Windows environment.
- [ ] Launch it with no existing database and verify local server startup.
- [ ] Upgrade or replace the app while preserving the user-data directory, then verify the existing database still opens.
- [ ] Confirm Prisma engine resources and the runtime raw SQL schema are available in the packaged app.
- [ ] Exercise the desktop data-management dialogs with a real fixture archive.

### Gate F: Document the beta operator path

- [ ] Keep [developer-guide.md](../developer-guide.md) aligned with the final `db:push` and `db:generate` workflow.
- [ ] Keep [architecture.md](../architecture.md) aligned with schema ownership and bootstrap behavior.
- [ ] Keep [data-management.md](../data-management.md) aligned with archive limitations and recovery behavior.
- [ ] Provide beta testers with a short backup instruction: export an `all` archive before installing a build that changes the database.
- [ ] Record known limitations, especially best-effort old-photo cleanup and process interruption during replace.

## 4. Recommended Sequence

1. Finish and review the final schema changes.
2. Update the runtime compatibility layer and any required backfills.
3. Regenerate Prisma and run focused database tests.
4. Run the full automated delivery checks.
5. Perform fresh-install, upgrade, backup, restore, and packaged Windows checks.
6. Resolve release-blocking findings and freeze the release candidate.
7. Update release metadata and follow [release-guide.md](../release-guide.md) for packaging and publication.

## 5. Release-Blocking Findings

The following findings block beta release until resolved or explicitly accepted by the release owner:

- A fresh packaged install cannot create or open the database.
- An existing database cannot start after the final schema change.
- A schema change can silently discard user data.
- A required backfill or constraint repair is not idempotent.
- An `all` archive cannot be created, validated, or restored for a representative fixture.
- The packaged Windows build does not include the Prisma engine or runtime dependencies.
- Production startup seeds sample data unexpectedly.

## 6. Post-Beta Improvements

These are worthwhile but should not delay the initial beta unless testing exposes a direct failure:

- Add an explicit database schema-version table and named compatibility steps.
- Add integration fixtures for every supported legacy database shape.
- Reduce duplication between the Prisma schema and runtime table declarations.
- Add automated SQLite pragma and integrity-check assertions.
- Revisit whether formal Prisma migrations are justified once the release cadence and upgrade requirements are known.

## 7. Signoff Evidence

The release record should link to:

- The final schema diff
- Fresh-database test output
- Existing-database upgrade test output
- Archive export/import and recovery test output
- Packaged Windows verification notes
- The known-limitations list provided to beta testers
