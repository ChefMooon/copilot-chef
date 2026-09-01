# Hidden Settings

This document records preference fields that are being hidden from the Settings UI while their underlying contracts remain active. It is a maintenance note for a future decision about whether these fields should be retained, migrated, deprecated, or removed.

The current UI decision is documented in [settings-update-spec.md](settings-update-spec.md), and the implementation sequence is documented in [settings-update-spec-plan.md](settings-update-spec-plan.md).

## Current Decision

Hide these four controls from the user-facing Settings page:

| UI label | Preference field | Current behavior | Current disposition |
| --- | --- | --- | --- |
| Auto-generate grocery list | `autoGenerateGrocery` | Boolean preference; defaults to `true` | Hidden from UI; contract retained |
| Consolidate similar ingredients | `consolidateIngredients` | Boolean preference; defaults to `true` | Hidden from UI; contract retained |
| Default plan length | `defaultPlanLength` | String preference; defaults to `"7"` | Hidden from UI; contract retained |
| Grocery list grouping | `groceryGrouping` | String preference; defaults to `"category"` | Hidden from UI; contract retained |

These fields are hidden only. Existing values must not be reset, discarded, renamed, or removed as part of the Settings Experience Refresh.

The following related controls remain visible and move to the `Appearance` category:

- Default recipe view (`defaultRecipeView`)
- Default unit mode (`defaultUnitMode`)

## Why They Are Hidden

The four fields belong to older grocery and planning controls that are no longer part of the intended Settings experience. Removing their UI reduces visible settings without making a compatibility-breaking change to stored preferences or data archives.

This is not a decision that the fields are permanently obsolete. Their current values may still exist in user databases and exported archives, and existing application or compatibility code may still read them.

## Contract Locations

Keep the four fields synchronized across all current contract surfaces until a separate removal or migration effort is approved:

- Preference defaults, normalization, serialization, and updates: [src/main/server/services/preference-service.ts](../../../src/main/server/services/preference-service.ts)
- Database schema and runtime database bootstrap: [prisma/schema.prisma](../../../prisma/schema.prisma) and [src/main/server/lib/schema.ts](../../../src/main/server/lib/schema.ts)
- Shared server/renderer payload: [src/shared/types.ts](../../../src/shared/types.ts)
- Archive safe-field allowlist and strict validation schema: [src/shared/schemas/data-management-schemas.ts](../../../src/shared/schemas/data-management-schemas.ts)
- Seed and compatibility fixtures: [src/main/server/lib/seed.ts](../../../src/main/server/lib/seed.ts), [src/main/server/services/data-management-import.test.ts](../../../src/main/server/services/data-management-import.test.ts), and [src/main/server/services/data-management-service.test.ts](../../../src/main/server/services/data-management-service.test.ts)
- Current renderer controls and removal boundary: [src/renderer/pages/settings.tsx](../../../src/renderer/pages/settings.tsx)

The legacy preferences JSON export endpoint remains a backend compatibility surface even though its renderer action is being removed. Preference reset support also remains available through the backend and is being exposed only through the separated Data Management workflow.

## Rules While Hidden

- Do not delete the fields from `PreferencesPayload`, preference update inputs, normalization, defaults, or serialization.
- Do not remove the corresponding Prisma columns or runtime schema/bootstrap definitions.
- Do not remove the fields from archive allowlists, schemas, import/export code, or compatibility fixtures.
- Do not silently overwrite existing values when loading, saving, resetting, exporting, or restoring preferences.
- Do not add replacement UI for these fields without revisiting their product purpose and the future-resolution checklist below.
- Do not describe these fields as active user-configurable Settings controls in new user-facing copy.
- Keep tests that prove archive import/export compatibility with non-default values.

## Future Resolution Checklist

Before deciding what happens to these fields, answer the following questions:

- [ ] Are any current application workflows still reading each field, or are they only persisted for compatibility?
- [ ] Do existing archives contain non-default values for these fields, and how many supported archive versions include them?
- [ ] Are there external clients, browser sessions, scripts, or integrations that send or consume these preference properties?
- [ ] Should the fields remain editable through a replacement workflow, become permanently fixed defaults, or be formally deprecated?
- [ ] If values are migrated, what is the source-to-target mapping for every existing value, including invalid or unknown values?
- [ ] What archive import behavior is required for old files after the change: preserve, transform, warn, or reject?
- [ ] What database migration and rollback behavior is required if columns are removed or renamed?
- [ ] Which API and shared-type compatibility guarantees must remain for older clients?
- [ ] Which tests and documentation must change, and what evidence proves that no supported workflow regresses?
- [ ] Has a separate migration/removal plan been approved before changing the contracts listed above?

## Verification Expectations

Until the fields are resolved, the Settings refresh should demonstrate all of the following:

1. The four controls are absent from the rendered Settings UI.
2. Default recipe view and default unit mode remain visible and usable in `Appearance`.
3. Existing non-default values for all four hidden fields survive archive export and import unchanged.
4. Reset preferences is scoped to preferences and does not remove recipes, meals, or meal plans.
5. The application continues to accept and serialize the fields wherever the current contracts require them.

When a future resolution is approved, update this document with the decision, migration scope, compatibility policy, and links to the tests or release notes that verify it.
