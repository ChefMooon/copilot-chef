# Pre-Plan Impact Assessment: Data Management Backup, Export, and Import

## Decision Summary

- Overall disposition: hand off to planning agent, with the implementation split into a versioned data contract/archive slice and a settings/UI slice
- Confidence: high for product scope and behavior; medium for archive/rollback implementation complexity
- Scope assessed: Electron desktop-first data management in Settings, including selective export, full user-data backup, import, and restore safeguards. Browser/LAN and remote-server parity is explicitly deferred.

The feature is worthwhile, but it should not extend the existing preferences export in place. The current endpoint is a narrow JSON convenience export, while a true backup must coordinate SQLite records, JSON-encoded fields, external meal-photo files, and device settings without exporting secrets. A versioned archive contract should be established before the Settings tab is implemented.

## Proposed Changes

### C1: Data Management Settings Tab

- Intended outcome: Give users a dedicated Settings tab for exporting and importing their Local Recipe Book data.
- In scope: A new accessible tab and panel; export scope selection; import file selection; progress, success, validation, conflict, cancellation, and error states; Electron desktop-first behavior.
- Out of scope: Browser/LAN and remote-server parity in the first slice; automatic scheduled backups; cloud sync; exporting API keys, machine tokens, or connection credentials.
- Dependencies: The shared data-management contract, server/service endpoints, Electron file dialogs or download handling, and query-cache invalidation after import.
- Open assumptions: The tab is a new peer to the existing Settings tabs. Existing preferences reset behavior remains unchanged.

### C2: Selective and Full Export

- Intended outcome: Let users export only meal-plan data, only recipe data, or all user data according to an explicit scope.
- In scope: Versioned export metadata; meal-plan export; recipe-library export; full user-data export; inclusion of preferences and content according to the selected scope; meal photos in full backups; stable filenames and clear scope summaries.
- Out of scope: Secrets and credentials; raw SQLite database copying as the user-facing format; arbitrary table-by-table export controls; cloud destinations.
- Dependencies: Prisma models and relations, existing recipe serializer/exporter, meal photo storage, and a decision about linked recipes referenced by meal-plan records.
- Open assumptions: “Meal plan” means scheduled and unscheduled `Meal` records plus the meal-type profile/definition metadata needed to render them. “Recipe data” means `Recipe` records and their ingredients, tags, links, and iteration lineage. “All data” means user content plus preferences, not device/runtime secrets.

### C3: Import and Restore

- Intended outcome: Restore a backup or bring data from another Local Recipe Book installation into the current app.
- In scope: Import validation before mutation; version compatibility checks; both merge and replace modes; duplicate/conflict reporting; transactional database changes where possible; photo extraction and path remapping; post-import cache refresh.
- Out of scope: Silent destructive replacement; importing arbitrary JSON without a schema/version envelope; restoring machine tokens, remote API keys, or other credentials; cross-version migration guarantees beyond the supported contract versions.
- Dependencies: C2 archive format, ID/reference policy, asset storage, database transaction boundaries, and a restart or cache-invalidation strategy.
- Open assumptions: Replace is explicitly confirmed and should preserve a recoverable pre-import backup. Merge needs deterministic identity and duplicate rules rather than relying only on generated IDs.

## Clarifications

- Asked and answered:
  - Import should offer both merge and replace modes.
  - “All data” should mean user data only: include preferences and app content, but exclude secrets such as API tokens and connection credentials.
  - Meal photos should be included in backups.
  - Electron desktop is the first supported runtime; browser/LAN and remote parity are deferred.
  - Meal-plan exports include referenced recipes as dependencies so linked meals restore correctly.
  - Replace import defaults to content-only and offers a separate opt-in choice to restore preferences.
  - Merge import asks the user how to resolve detected conflicts.
  - “All user data” includes grocery lists, prep lists, and their checked state.
  - All new scopes use one canonical archive format; the existing recipe-only JSON endpoint remains a compatibility surface.
  - Merge conflict handling uses a pre-import preview with per-record choices and safe bulk actions.
  - Replace uses one allowlisted “restore preferences” toggle, off by default; credentials and device secrets are never restored.
- Still needed:
  - No material product decisions remain. Technical implementation details such as archive library choice and transaction/rollback mechanics belong in the implementation plan and must preserve the decisions above.
- Assumptions used for this assessment:
  - The existing local database is the source of truth for content.
  - Export/import is authenticated through the existing server boundary and is initiated by the current user/device.
  - A file archive is acceptable for photo-bearing backups.

## Current-State Evidence

- [src/renderer/pages/settings.tsx](../../src/renderer/pages/settings.tsx) owns the Settings tab list and currently has four tabs: App Settings, Dietary Profile, Meal Plans, and Network. It already has a data/privacy card, but that card only offers the existing broad export and preference reset.
- [src/main/server/routes/preferences.ts](../../src/main/server/routes/preferences.ts) exposes `GET /api/preferences/export`, which serializes only `preferences` and `meals`. It does not include recipes, grocery lists, prep lists, meal-type definitions, photos, or Electron app settings.
- [src/renderer/lib/api.ts](../../src/renderer/lib/api.ts) downloads the preferences export as a browser blob. It has no import wrapper for that format.
- [prisma/schema.prisma](../../prisma/schema.prisma) persists `Meal`, `GroceryList`/`GroceryItem`, `PrepList`/`PrepItem`, `UserPreference`, `Recipe`, `RecipeIngredient`, `RecipeTag`, `RecipeLink`, `MealTypeProfile`, and related definitions. Several fields are JSON strings, including meal ingredients/instructions and prep source IDs, so import/export must serialize them through domain contracts rather than copying opaque values blindly.
- [src/main/server/services/recipe-service.ts](../../src/main/server/services/recipe-service.ts) already provides a versioned recipe export (`version: "2"`) and recipe import service. [src/main/server/routes/recipes.ts](../../src/main/server/routes/recipes.ts) exposes `GET /api/recipes/export` and `POST /api/recipes/import`. The full archive should reuse its serialization and identity rules where compatible, rather than creating a second recipe format.
- [src/main/server/lib/meal-photo-storage.ts](../../src/main/server/lib/meal-photo-storage.ts) stores meal photos on disk below the Electron user-data directory and keeps `photoPath`, MIME type, and filename in `Meal`. A JSON-only export cannot restore these files; a ZIP-like archive or equivalent manifest-plus-assets package is required for complete photo backup.
- [src/main/settings/store.ts](../../src/main/settings/store.ts) stores device/runtime settings separately in `settings.json`, including connection and machine-token values. The user-data export must explicitly whitelist safe preference/settings fields and exclude credentials rather than dumping `getAllSettings()`.
- [src/renderer/lib/platform/types.ts](../../src/renderer/lib/platform/types.ts), [src/renderer/lib/platform/electron.ts](../../src/renderer/lib/platform/electron.ts), and [src/preload/index.ts](../../src/preload/index.ts) establish the platform boundary for desktop capabilities and IPC. New Electron file-dialog operations should go through this boundary; renderer code should not call `window.api` directly.
- [src/main/ipc/index.ts](../../src/main/ipc/index.ts) already uses Electron `dialog.showSaveDialog` for PDF export, providing a local pattern for native save-file handling. There is no current native open-file/import dialog.
- [docs/architecture.md](../architecture.md) confirms that the renderer talks to the embedded Hono server over HTTP, SQLite is the persistence layer, and browser/LAN clients use a separate machine-token path. This supports a server-owned data contract with desktop-specific file selection as a first-runtime concern.
- Unknown: There is no existing cross-domain transaction/import service, backup retention mechanism, or tested archive format. These need to be designed and tested before replace mode is considered reliable.

## Impact Findings

### C1: Data Management Settings Tab

- Classification: beneficial with conditions
- Positive impact: Makes a high-value recovery workflow discoverable and gives users one place to understand export scope and restore consequences.
- Negative impact or unintended consequence: Adding another tab increases navigation density. A tab that presents export/import without explaining scope, secrets, photos, or destructive replace behavior could create false confidence.
- Affected surfaces: `settings.tsx`, settings CSS/components, renderer API/platform adapters, Electron preload/IPC if native file dialogs are used, and query invalidation after import.
- Dependencies and interactions: The UI should follow the existing accessible tab pattern and should be built against the final archive contract. Import success must invalidate meal, recipe, grocery, prep, stats, and preference queries, or the UI will show stale data.
- Confidence and rationale: Medium-high. The owning tab architecture and platform boundary are verified, but the exact file interaction model is not yet established.
- Discriminating check: Build a narrow Settings test that renders the new tab in Electron and browser adapters, verifies keyboard tab navigation, and exercises disabled/loading/error states without requiring a real database file.
- Recommendation: proceed after the data contract and runtime boundary are agreed; keep the tab separate from the existing preference reset card.

### C2: Selective and Full Export

- Classification: beneficial with conditions
- Positive impact: Selective exports support sharing or migration of recipes without exposing unrelated household data; full exports provide practical disaster recovery. Including photos makes the backup meaningful rather than merely textual.
- Negative impact or unintended consequence: “Meal plan,” “recipe data,” and “all data” overlap through meal-to-recipe references. A partial export can produce broken links or silently omit required content. Photos also increase archive size and introduce path/security concerns.
- Affected surfaces: New export service/route and shared schemas; recipe and meal serializers; grocery/prep/list serializers; preference serialization; photo archive extraction; renderer download/save flow; export tests.
- Dependencies and interactions: The archive needs a top-level format version, scope, app/schema version, export timestamp, per-domain payloads, and asset manifest. IDs should normally be retained within an archive, while cross-scope references need an explicit policy. Secrets must be excluded by allowlist.
- Confidence and rationale: Medium. The domains and existing recipe contract are verified, but the product meaning of a meal-plan-only export and full-content scope remains partly open.
- Discriminating check: Create fixture data covering linked meals, recipe iteration/link graphs, custom meal types, grocery/prep lists, and a photo; export each scope and assert that every included reference is either resolvable or intentionally represented as a snapshot.
- Recommendation: proceed with one versioned archive strategy. Meal-plan exports must include referenced recipes as dependencies; full exports include grocery/prep lists and checked state. Retain the existing recipe-only format as a compatibility surface, but do not create another new export format.

### C3: Import and Restore

- Classification: beneficial with conditions
- Positive impact: Completes the backup story and supports migration to a new installation. Merge supports bringing in selected content; replace supports disaster recovery.
- Negative impact or unintended consequence: Replace can destroy current data; merge can duplicate records or violate unique constraints. Malformed archives, partial photo extraction, interrupted writes, stale caches, and imported foreign IDs all need deliberate handling. Restoring secrets would also create a credential disclosure and machine-identity problem.
- Affected surfaces: New import schema/parser and service; Prisma transaction and conflict logic; photo extraction/storage; Electron open-file flow; settings/preferences handling; query cache and possibly server restart behavior; tests for invalid, duplicate, partial, and interrupted imports.
- Dependencies and interactions: Replace should first create a fresh backup of the current user data, validate the entire archive, stage/extract assets safely, then perform a transaction or documented compensating rollback. Replace defaults to content-only and separately opts into safe preferences. Merge needs stable identity rules, likely reusing recipe normalized title/source conflict logic and mapping imported IDs to local IDs; detected conflicts must enter an explicit review flow.
- Confidence and rationale: Medium. Existing recipe import proves domain-level import is viable, but no cross-domain transaction or rollback primitive currently exists.
- Discriminating check: Run an integration test against a temporary SQLite database that imports a valid archive in merge and replace modes, injects a duplicate and malformed photo, and verifies no partial database mutation remains after failure.
- Recommendation: proceed with conditions; implement validation and a recoverable pre-replace backup before enabling destructive replace. Implement the agreed conflict-review interaction before enabling merge for conflicting records. Consider shipping non-conflicting merge and recipe/full export first, then enabling replace once rollback behavior is proven.

## Cross-Change Considerations

- Sequence the work as: archive/schema decision, domain serializers and import services, focused integration tests, Electron file boundary, then Settings UI. Building the tab first would hard-code ambiguous scope and conflict behavior.
- Use one canonical archive containing a manifest, domain JSON files, and photo assets. The existing recipe-only JSON endpoint remains supported for compatibility, but all new export scopes use the canonical archive.
- Recommended scope semantics:
  - **Meal plan:** meals, scheduled/unscheduled state, meal-type profiles/definitions, meal photos, and any recipes referenced by included meals as dependencies.
  - **Recipe data:** recipes, ingredients, tags, links, and iteration lineage, using the existing recipe import/export rules.
  - **All user data:** all content models above, grocery/prep lists with checked state, and user preferences, excluding runtime/device secrets.
- Do not export `remote_api_key`, `machine_api_key`, or equivalent connection credentials. Device settings such as theme and layout may be separately classified as non-secret preferences, but should not be confused with content backup.
- Import must never trust archive paths or filenames. Asset extraction must prevent path traversal, enforce size/type limits, and remap stored photo paths to generated local names.
- Merge must show a pre-import conflict preview with per-record choices and safe bulk actions; it must not silently overwrite matching local records.
- Replace must default to content-only. A single opt-in restore-preferences toggle may restore allowlisted user preferences, never credentials or device secrets.
- After a successful import, invalidate or reload all affected React Query keys. In Electron, consider whether the embedded server or Prisma client needs a controlled reconnect for replace mode.
- Keep browser/LAN and remote-server support as a later plan. Their authenticated HTTP path can eventually consume the same contract, but native file dialogs, permissions, and server ownership differ from Electron local mode.

## Handoff Options

1. **Continue pre-planning**: No material product decision remains. Reopen this stage only if implementation discovery reveals a new user-visible scope or safety choice.
2. **Hand off to the planning agent**: Plan an Electron desktop-first implementation around one versioned manifest-plus-assets archive, dependency-complete meal-plan exports, all-data coverage for grocery/prep lists, explicit allowlisted non-secret settings, content-default replace with one opt-in preferences toggle, preview-based per-record merge conflict review, and integration tests for references, conflicts, photo assets, rollback, and cache refresh.

## Resolved Decision Register

| ID                     | Decision                                 | Selected outcome                                                    | Implementation constraint                                                                  |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| d1-linked-recipes      | Meal-plan exports with recipe references | Include referenced recipes as dependencies                          | Meal-plan archives must be self-contained for linked meals.                                |
| d2-replace-preferences | Preference behavior during replace       | Content-only by default, with one opt-in restore-preferences toggle | Restore only an explicit allowlist; never restore credentials or device secrets.           |
| d3-merge-conflicts     | Merge conflict handling                  | Pre-import preview with per-record choices and safe bulk actions    | No silent overwrite; report unresolved conflicts before mutation.                          |
| d4-all-data            | Full user-data scope                     | Include grocery/prep lists and checked state                        | “All data” must include every persisted user-content domain named by the archive contract. |
| d5-archive-format      | New export format                        | One canonical versioned archive                                     | Keep the existing recipe-only JSON endpoint as compatibility, not as a second new format.  |

## Quality Gate

- Every requested change is identified and mapped: Settings tab, selective export, full export, and import strategy.
- Material clarifications were asked and incorporated: merge/replace, user-data-only scope, photos, and Electron-first runtime support.
- Current-state claims have repository evidence at the Settings, route/service, Prisma, photo-storage, settings-store, IPC/platform, and architecture boundaries.
- Benefits, risks, dependencies, and cross-change interactions are explicit.
- Each impact finding has a cheap discriminating check.
- All material product decisions are resolved; remaining archive-library and rollback mechanics are implementation-planning concerns constrained by the resolved register.
- No application code or unrelated files were modified; only this strategy document was written.
