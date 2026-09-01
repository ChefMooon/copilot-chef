## Plan: Data Management Backup And Restore

Implement Electron desktop-first data management as a versioned archive workflow behind the existing Hono server boundary, then add a dedicated Settings tab and native file dialogs. The archive is the single new format: a manifest plus domain JSON payloads and meal-photo assets. The implementation must preserve existing recipe-only JSON compatibility, exclude secrets, preview merge conflicts before mutation, and make replace recoverable before enabling destructive changes.

**Steps**

### Phase 1: Contract and archive foundation
1. Add shared data-management schemas and types under `src/shared/` for archive metadata, supported format versions, export scopes (`meal-plan`, `recipes`, `all`), domain payloads, asset manifests, import modes, safe preference fields, validation errors, conflict records, conflict decisions, and import summaries. Use strict parsing and reject unknown/invalid top-level structure where appropriate. Include app/schema version, export timestamp, scope, and per-domain payload versioning.
2. Define canonical archive layout and naming in the shared contract: manifest JSON, domain JSON files, and an `assets/meal-photos/` namespace. Preserve source IDs inside the archive, but require an import-time ID map for merge/replace references. Make meal-plan archives self-contained by including referenced recipes and all required meal-type profile/definition metadata. Define deterministic filenames and archive extension.
3. Add one maintained ZIP implementation for Node/Electron archive creation and extraction, preferring a pure-JS dependency that works in the packaged Electron main process. Keep compression and archive I/O in a main/server library rather than the renderer. Add size/count/type limits and path traversal protection before extraction.

### Phase 2: Domain serialization and export service
4. Create a server-side `DataManagementService` (likely `src/main/server/services/data-management-service.ts`) and register it in `src/main/server/services.ts`. Inject/reuse the existing meal, recipe, grocery, prep-list, meal-type, and preference services where that avoids duplicate serialization rules; reuse `RecipeService.exportRecipes` payload rules and keep `/api/recipes/export` unchanged.
5. Implement scope-aware export assembly from the Prisma source of truth. Cover scheduled and unscheduled meals, meal type profiles/definitions, recipes and their ingredients/tags/links/iteration lineage, grocery lists/items including checked state, prep lists/items including checked state, and user preferences. Include photos for meals that are present in the selected scope. For meal-plan scope, include linked recipe dependencies and ensure every included reference resolves within the archive.
6. Serialize JSON-backed fields through domain serializers and schemas, never as opaque database strings. Normalize dates and nullable values consistently with existing API payloads. Read photo files only through the existing meal-photo storage boundary, create generated archive asset names, and record MIME type, original filename, meal ID, and checksum/size in the manifest.
7. Add an authenticated export route under `src/main/server/routes/` with scope validation, stable `Content-Disposition`, archive content type, and structured error codes. Register it in `src/main/server/app.ts`. Add focused service and route tests for each scope, linked recipe closure, all grocery/prep checked state, JSON fields, photos, stable filenames, secret exclusion, and missing-photo behavior.

### Phase 3: Validation, preview, merge, and replace
8. Implement archive parsing and validation before any database or filesystem mutation. Validate supported format versions, scope/payload consistency, references, asset metadata, archive entry names, maximum uncompressed size, maximum photo size/count, MIME allowlist, and checksums. Return structured validation errors suitable for renderer display.
9. Implement conflict detection and a preview endpoint/service operation. Establish deterministic identity rules: retain archive IDs only when safe; otherwise map by stable domain identity, reusing existing recipe title/source conflict semantics and defining explicit identities for meals, lists/items, meal-type definitions, and preferences. Produce per-record conflicts with local/imported summaries and safe bulk decision options. Do not mutate during preview.
10. Implement merge as an explicit decision-driven operation. Require decisions for detected conflicts, apply only selected records, map foreign IDs before writing dependent records, preserve referential integrity, and import photo assets only for accepted meals. Report imported, skipped, replaced, unresolved, and asset results without silently overwriting local records.
11. Implement replace as a guarded operation. Before mutation, validate the complete archive, create a fresh recoverable backup of current user data using the same archive service, stage photo extraction into a temporary directory, then perform content replacement in a Prisma transaction where SQLite supports it. Default to content-only; accept one explicit `restorePreferences` option that restores only the allowlisted non-secret preference fields. Never restore remote API keys, machine tokens, connection credentials, runtime settings, or device identity. Add compensating rollback/cleanup for transaction failure, asset failure, cancellation, and interrupted staging; document any unavoidable restart requirement.
12. Add import routes for validation/preview and apply operations, with request schemas, explicit mode (`merge` or `replace`), conflict decisions, and preference-restore opt-in. Keep archive bytes out of JSON request bodies if the server boundary supports multipart/file streaming; otherwise use a desktop-only IPC file handoff that still invokes the server-owned service. Return structured status codes for invalid archives, unsupported versions, unresolved conflicts, canceled operations, rollback failure, and success summaries.
13. Add integration tests against isolated temporary SQLite/database and photo roots. Cover export/import round trips, linked meal recipes, recipe lineage/link graphs, custom meal types, unscheduled meals, grocery/prep checked state, invalid archive rejection with no mutation, path traversal and oversized asset rejection, merge conflict preview and decisions, replace content-only/preferences opt-in, rollback after injected database/photo failure, and secret exclusion.

### Phase 4: Electron file boundary and renderer API
14. Add typed IPC contracts in `src/shared/ipc.ts` only for native file selection/saving and any progress/cancellation signal that cannot be handled over HTTP. Add `dialog.showOpenDialog` and `dialog.showSaveDialog` handlers in `src/main/ipc/index.ts`, following the existing PDF export pattern. Return canceled/saved paths and user-facing errors without exposing arbitrary filesystem access to the renderer.
15. Expose the new IPC calls through `src/preload/index.ts`, `src/renderer/lib/platform/types.ts`, and `src/renderer/lib/platform/electron.ts`. Add browser adapter stubs/capabilities that leave the feature disabled or clearly unsupported in browser/LAN mode; do not call `window.api` directly from Settings or other renderer code. Keep desktop-first scope explicit.
16. Extend `src/renderer/lib/api.ts` with typed archive export, import validation/preview, and apply wrappers. Handle binary export/import consistently, parse API error codes, and return filenames/content metadata. Add a single query-invalidation helper covering preferences, meals, meal-type definitions/profiles, recipes, grocery, prep, statistics, and any dependent dashboard queries. Clear/reload configuration only if replace implementation requires a server/database reconnect.
17. Add renderer tests for API error/response parsing, platform capability behavior, native dialog cancellation, and query-cache invalidation after successful import.

### Phase 5: Settings experience
18. Add a new `data-management` peer tab to `src/renderer/pages/settings.tsx` using the existing accessible tab pattern, persisted active-tab behavior, and settings CSS conventions. Keep the existing preference export/reset controls unchanged or relabel them as compatibility behavior rather than silently changing their format.
19. Build the data-management panel as focused components under `src/renderer/components/settings/`. Provide scope selection for meal plan, recipes, and all data; clear inclusion summaries; export progress/success/error states; import file selection; archive validation state; merge/replace mode selection; replace confirmation; the allowlisted restore-preferences toggle; conflict preview with per-record choices and safe bulk actions; cancellation and final result summaries. Explain that secrets are excluded and that replace creates a recovery backup.
20. After successful import, invalidate/refetch all affected React Query keys and reset local Settings drafts only where preferences were restored. Ensure errors leave the current UI and database state intact. Follow the style guide’s semantic theme variables, accessible focus/keyboard behavior, compact data-first layout, and existing modal/button/icon patterns.
21. Add focused Settings/component tests for keyboard tab navigation, scope summaries, disabled/loading/error states, merge conflict choices, replace confirmation/defaults, preference toggle behavior, browser-mode unsupported state, and cache refresh callbacks.

### Phase 6: Documentation, hardening, and delivery
22. Update `docs/ipc-channels.md` for any new IPC channels, `docs/architecture.md` for archive ownership and desktop-only file operations, and `docs/developer-guide.md` or a focused data-management document for archive format, supported versions, security limits, rollback behavior, and test fixtures. Update `docs/STRUCTURE.md` if new documentation is added.
23. Add package/build checks for the archive dependency in Electron development and packaged Windows builds. Verify archive assets are not omitted by electron-vite/electron-builder. Confirm Prisma generation/database commands follow the Windows lock workaround when Electron is running.
24. Run focused Vitest suites after each phase, then `npm run test`, `npm run lint`, `npm run build`, and the relevant browser/Electron smoke checks. Manually verify export/import with fixture data, native dialogs, photo restoration, merge preview, replace recovery, dark/light/custom themes, and stale-cache absence.

**Relevant files**
- `prisma/schema.prisma` — source models and relations for meals, recipes, grocery/prep lists, preferences, meal types, and JSON-backed fields.
- `src/shared/` — new archive schemas/types and typed IPC contracts.
- `src/main/server/services.ts` — register `DataManagementService` and its dependencies.
- `src/main/server/services/recipe-service.ts` — reuse version-2 recipe serialization/import identity rules.
- `src/main/server/lib/meal-photo-storage.ts` — read/write boundary and photo metadata/path safety.
- `src/main/server/routes/` and `src/main/server/app.ts` — authenticated export, validation/preview, and import route registration.
- `src/main/settings/store.ts` — allowlist safe preference settings; never serialize `remote_api_key`, `machine_api_key`, or connection/device secrets.
- `src/main/ipc/index.ts`, `src/preload/index.ts` — native open/save dialog bridge.
- `src/renderer/lib/platform/types.ts`, `src/renderer/lib/platform/electron.ts`, `src/renderer/lib/platform/browser.ts` — runtime capabilities and adapters.
- `src/renderer/lib/api.ts` — typed archive HTTP wrappers and error handling.
- `src/renderer/pages/settings.tsx` and `src/renderer/components/settings/` — new tab, workflow state, dialogs, and styles.
- Existing domain service tests and `src/renderer/components/settings/*.test.tsx` — implementation templates and focused coverage locations.
- `docs/architecture.md`, `docs/developer-guide.md`, `docs/ipc-channels.md`, and a new focused data-management guide if needed — operational and contract documentation.

**Verification**
1. Validate every archive scope against fixtures containing scheduled and unscheduled meals, linked recipes, recipe lineage/links, custom meal types, grocery/prep items with checked state, preferences, and at least one photo.
2. Assert archive round-trip equivalence after import, including rewritten photo paths and all resolvable foreign-key references.
3. Assert malformed, unsupported, oversized, traversal-containing, checksum-invalid, and secret-bearing archives are rejected before mutation.
4. Assert merge preview is non-mutating, requires conflict decisions, honors per-record and bulk choices, and reports deterministic results.
5. Assert replace creates a recoverable pre-import backup, defaults to content-only, restores only the explicit safe preference allowlist when opted in, and rolls back on injected failure.
6. Run renderer tests for Settings accessibility and state transitions, API/platform tests, and cache invalidation across meals, recipes, grocery, prep, stats, and preferences.
7. Run `npm run test`, `npm run lint`, and `npm run build`; verify packaged Windows archive creation/extraction and the Electron native dialogs with a real fixture archive.
8. Manually verify browser/LAN mode presents the documented unsupported state and does not attempt native IPC or silently offer a workflow it cannot complete.

**Decisions**
- Electron desktop is the first supported runtime; browser/LAN and remote-server parity are deferred, but the contract remains server-owned for later reuse.
- One canonical versioned archive is used for all new scopes. The existing recipe-only JSON endpoint remains a compatibility surface.
- Meal-plan exports include referenced recipes and required meal-type metadata; all-data exports include grocery/prep lists and checked state.
- Archives include meal photos, but never raw SQLite files, credentials, API tokens, machine tokens, or connection/runtime secrets.
- Merge uses a non-mutating preview and explicit per-record conflict decisions; no silent overwrite is allowed.
- Replace requires explicit confirmation, creates a pre-import recovery backup, defaults to content-only, and has one opt-in allowlisted preference restore toggle.
- No automatic scheduled backups, cloud destinations, arbitrary table-level scope selection, or browser/LAN import/export is included.
- Implementation should prefer an existing maintained archive dependency if present; otherwise add a pure-JS ZIP dependency suitable for packaged Electron builds and test it in CI.

**Further Considerations**
1. Confirm the archive dependency and transport before coding: use a pure-JS ZIP package in the main process and multipart/streaming upload if supported by the current Hono stack; fall back to a typed desktop IPC file-path handoff without moving archive ownership into the renderer.
2. Treat replace enablement as a release gate: do not expose destructive replace until the isolated-database rollback test and packaged-app backup path pass.
3. Keep format version migration narrow: support the initial contract and explicit future migration hooks, but do not promise arbitrary cross-version imports beyond declared supported versions.
