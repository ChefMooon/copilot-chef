## Plan: Live Dashboard Meal Count

Update the home dashboard's current-week meal total so it represents remaining scheduled meal slots at the current local date and time. Preserve the existing slot-based meaning of `totalSlots`, exclude all slots on prior calendar days, and exclude today's slot once that meal type's configured cutoff time has passed. Store cutoff times on meal-type definitions so the default profile and user-created/custom profiles remain self-contained and date-ranged profile resolution continues to work.

**Steps**
1. **Define the cutoff contract and defaults.** Add a persisted `cutoffTime` value to each `MealTypeDefinition`, represented as a validated 24-hour `HH:mm` string. Recommend these initial defaults for the built-in template: Breakfast `10:00`, Morning Snack `11:30`, Lunch `14:00`, Afternoon Snack `17:00`, Dinner `21:00`, and Snack `23:59`. Treat a missing/legacy value as `23:59` so existing data remains countable until configured. Document that the cutoff is a local wall-clock boundary for the scheduled date, not a timestamp stored on each meal. Keep the count unit as one slot per date + meal type, including multi-dish slots only once.
2. **Extend the meal-type persistence contract.** Update `prisma/schema.prisma` and the runtime schema/bootstrap migration in `src/main/server/lib/schema.ts` to add the nullable/default-compatible cutoff column to `MealTypeDefinition`. Update `src/shared/types.ts`, `src/shared/api/constants.ts`, and the meal-type service serializers/inputs so API payloads include `cutoffTime`, create/update operations validate `HH:mm`, and default bootstrap data seeds the recommended values. Preserve old installations with a migration/backfill path and keep the fallback at `23:59` for rows created before the field exists. Per repository convention, run `db:push` then `db:generate` after the schema change; on Windows with the dev process holding Prisma's engine DLL, use the documented `--skip-generate` / `generate --no-engine` workaround.
3. **Expose cutoff editing in the existing meal-type UI.** Extend `MealTypesSection` and `MealTypeProfileModal` so every meal-type draft has a user-facing time input, including the default profile's built-in definitions and newly added custom definitions. Thread the value through `CreateMealTypeDefinitionInput` and `UpdateMealTypeDefinitionInput`; normalize empty/invalid input before save and show a focused validation error rather than silently creating an uncountable type. Keep profile duplication/reordering/removal behavior unchanged, and make the modal copy explain that the time determines when today's dashboard count stops including that slot.
4. **Implement a live, range-aware summary in the service.** Add a focused `MealService` method beside `getMealCountInRange` that computes the current local calendar day and current-week bounds, groups scheduled rows into unique `(date, meal type)` slots, retains future dates, excludes prior dates, and for today compares the current local `HH:mm` against the resolved definition's cutoff. Resolve the meal type definition using the stored definition relation when available and a normalized meal-type fallback for legacy rows; use the active profile/date-aware definitions for unresolved/custom data. Keep the method deterministic under fake timers and define edge behavior explicitly: a slot counts at the cutoff instant and stops counting immediately afterward; an unset/unknown cutoff uses `23:59`; unscheduled meals (`date = null`) do not count. Return the existing `from`, `to`, and `totalSlots` response shape unless a separate display label is needed.
5. **Make the stats route call the new summary method.** Replace the route's direct weekly `getMealCountInRange` call in `src/main/server/routes/stats.ts` with the live summary method, keeping the API endpoint and current-week range contract stable for existing clients. Update route mocks and assertions to verify the service is called once and that the response reflects the filtered total.
6. **Keep the home dashboard contract compatible.** `HomeDashboard` should continue reading `data.totalSlots` and displaying the same user-facing metric, but its query should refresh at a practical cadence (for example, a minute or at the next cutoff) so the number changes without a full reload. Avoid client-side reimplementation of cutoff logic; the server remains authoritative for Electron and browser/LAN clients. Add a narrow renderer assertion only if the refresh behavior or loading/error state changes.
7. **Prepare documentation for the later dashboard-settings expansion.** Update `docs/copilot-chef-config.md` with the new meal-type cutoff contract and the settings ownership boundary. Record that this iteration intentionally adds cutoff editing to meal-type profiles but does not add a dashboard layout builder, widget ordering, arbitrary dashboard visibility configuration, or a separate dashboard settings page. The future dashboard settings page can reuse the existing platform settings path for presentation preferences, while meal-type timing remains part of meal-type profile configuration.

**Relevant files**
- `src/main/server/services/meal-service.ts` — owner of slot aggregation and current-week analytics; add the date/time-aware summary method and legacy definition fallback.
- `src/main/server/routes/stats.ts` — `/stats/meal-summary` route currently calls `getMealCountInRange`; preserve its response contract while switching the implementation.
- `src/main/server/services/meal-type-service.ts` — owner of meal-type definition validation, default bootstrap, profile resolution, serialization, and create/update behavior.
- `src/main/server/routes/meal-types.ts` — pass and validate cutoff input through create/update HTTP requests.
- `src/renderer/components/settings/MealTypesSection.tsx` — include cutoff values in drafts and mutation payloads for default and custom profiles.
- `src/renderer/components/settings/MealTypeProfileModal.tsx` — render the per-meal-type time controls and validation-facing copy.
- `src/shared/types.ts` — extend meal-type definition payload and create/update input types.
- `src/shared/api/constants.ts` — add default cutoff metadata alongside `DEFAULT_MEAL_TYPE_TEMPLATES`.
- `prisma/schema.prisma` — persist the definition cutoff.
- `src/main/server/lib/schema.ts` — keep runtime-created/legacy SQLite schemas compatible with the field and migration/backfill.
- `src/main/server/routes/stats.test.ts` — route contract and service-call assertions.
- `src/main/server/services/meal-service.analytics.test.ts` — fake-time tests for prior/today/future dates, exact cutoff boundaries, multiple dishes in one slot, null dates, custom types, and legacy fallback.
- `src/main/server/services/meal-type-service.test.ts` and `src/renderer/components/settings/MealTypesSection.test.tsx` — validation, default/custom cutoff editing, and payload regression coverage.
- `docs/copilot-chef-config.md` — document cutoff semantics, defaults, persistence, and scope boundary.

**Verification**
1. Run the focused meal-type service and analytics tests with Vitest using fake local times around each cutoff, including one test just before and one just after a cutoff.
2. Run the focused stats route test and meal-type settings component test; verify the endpoint still returns `from`, `to`, and `totalSlots` and existing profile workflows still save/reload.
3. Run the repository typecheck/lint command from `docs/developer-guide.md` plus the full `npm run test` task.
4. Apply the Prisma/runtime schema update in a disposable or test database, verify existing definitions receive the fallback/default, and verify a newly created custom definition persists and returns its cutoff through the API.
5. Manually verify the home dashboard at a controlled system time or with test data: yesterday is absent, today's meal disappears after its configured cutoff, tomorrow remains, and multiple dishes in one slot still count as one.

**Decisions**
- Count meal slots, not individual dishes, preserving the current `totalSlots` contract.
- Make cutoff times configurable for every meal-type definition, including user-created definitions and definitions in custom date-ranged profiles.
- Use the proposed built-in defaults: Breakfast `10:00`, Morning Snack `11:30`, Lunch `14:00`, Afternoon Snack `17:00`, Dinner `21:00`, and Snack `23:59`.
- New custom definitions always start at `23:59`; they do not inherit a cutoff from a matching built-in slug.
- At the exact cutoff minute the slot still counts; it stops counting only when the current local time is later than the cutoff.
- For existing databases, backfill known built-in slugs with the proposed defaults and assign `23:59` to unknown/custom existing definitions. Missing legacy values use the same `23:59` fallback.
- Invalid non-empty cutoff input is rejected with a validation error/HTTP 400. Omitted legacy values are normalized to `23:59`; there is no explicit null/no-cutoff mode.
- Disabled meal-type definitions still count when an existing slot is scheduled; `enabled` controls planner availability, not historical or already-scheduled analytics.
- For meals without a linked definition, resolve the active profile for the meal date, match normalized slug/name, and use `23:59` if no definition matches.
- Use local wall-clock semantics because scheduled meals are date-only and the app already computes calendar ranges locally. The API/service is authoritative for desktop and browser/LAN clients.
- Refresh the home dashboard summary every minute while it is active.
- Prefer persisted per-definition cutoff data over a dashboard-specific code map.
- Keep the first iteration focused on live counting plus per-meal-type cutoff editing; defer a general dashboard settings/layout page, widget ordering, and arbitrary dashboard display configuration.

**Implementation-Ready Acceptance Criteria**
- The API returns the current week's `from`, `to`, and `totalSlots` without counting any prior calendar date.
- A scheduled slot for today counts at its cutoff minute and is absent at the next minute; future slots remain counted.
- Multiple dishes sharing a date and meal type count as one slot.
- Null-date meals do not count.
- Linked definitions use their persisted cutoff; unresolved legacy meals use the date-resolved profile or `23:59` fallback.
- Default and custom meal-type profile editing persists and returns valid cutoff values, and invalid values are rejected without partially saving a profile.
- Existing databases upgrade with known default slugs backfilled and unknown definitions preserved with `23:59`.
- The dashboard refreshes the summary at one-minute intervals without duplicating filtering logic in the renderer.
3. Treat the future dashboard settings page as presentation configuration. Keep meal timing attached to meal-type profiles so changing dashboard layout cannot accidentally alter planning semantics.


**Handoff**
- Status: Pause after decision closure.
- The plan is implementation-ready, but no implementation should begin in this session.
- The broader dashboard layout/settings builder remains deferred.
- Repository plan document update is deferred because the active planning mode permits only session-memory writes.
