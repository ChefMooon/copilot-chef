# Specification Change Impact Assessment: Settings Experience Refresh

## Decision Summary

- Overall disposition: hand off to planning agent
- Confidence: medium-high
- Scope assessed: Settings navigation, sidebar/detail layout, category structure, search, removal of obsolete Grocery & planning controls, Data Management boundaries, and modularization of `settings.tsx`

The proposed direction is beneficial with conditions. The settings page should be reorganized into a master-detail experience with a left-aligned category sidebar and a right-side scrollable settings pane. The six user-oriented categories are:

1. General
2. Appearance
3. Dietary Profile
4. Meal Plans
5. Network
6. Data Management

The sidebar should include sticky search because the visible settings count exceeds 15. Search should match labels, descriptions, keywords, and category names, preserve category context, highlight matching text where practical, and provide a resettable empty state.

The existing preference and archive contracts should remain unchanged unless a separate migration effort is explicitly approved.

## Proposed Changes

### C1: Reorganize settings categories

- Intended outcome: Make settings easier to scan and discover by grouping controls according to user intent.
- In scope:
  - Replace the current `App Settings` category with `General` and `Appearance`.
  - Use a left-aligned sidebar for the six top-level categories and a right-side scrollable detail pane for the selected category.
  - Add a sticky sidebar search field that filters settings by label, description, keyword, and category.
  - Move theme, Home Dashboard, Meal Bank placement, recipe library default sort, default recipe view, default unit mode, and other presentation controls into Appearance.
  - Keep desktop lifecycle behavior, update checks, diagnostics, and similar device-level options in General.
  - Preserve Dietary Profile and Meal Plans as independent categories.
  - Preserve Network and Data Management as independent categories.
- Out of scope:
  - Changing the behavior or persistence model of individual settings.
  - Adding a new About category unless future requirements justify it.
  - Replacing the settings persistence model with URL routing or a new state store.
- Dependencies:
  - Existing tab persistence and keyboard navigation.
  - App-setting keys and preference API contracts.
  - Responsive styles in `settings.module.css`.
- Implementation assumptions:
  - Home Dashboard, Meal Bank placement, and recipe sorting are presentation/layout settings and belong in Appearance.
  - Six categories are acceptable under the guideline’s 4-6 category recommendation.
  - At desktop widths, the sidebar remains sticky while the independently scrollable detail pane contains the selected category content.
  - At narrow widths, the sidebar may collapse or become a horizontal category selector while the selected detail pane remains usable and all settings remain reachable.
  - The layout must remain usable at the minimum supported window width, with no clipped controls or horizontal overflow.
  - The active category must have a clear visual distinction, and keyboard focus must move predictably between category navigation, search, and detail controls.
  - Constrain the settings content to the guideline’s approximately 1000-1100px width so the detail pane remains readable on larger windows.

### C1 acceptance criteria

- The right detail pane scrolls independently from the sidebar on desktop.
- Search results retain category context, highlight matching text where practical, and show a clear reset action when no settings match.
- Every category and setting remains keyboard reachable and usable at the minimum supported width.

### C2: Remove obsolete Grocery & planning UI

- Intended outcome: Remove settings that are no longer useful while preserving the two recipe display defaults.
- In scope:
  - Remove:
    - Auto-generate grocery list
    - Consolidate similar ingredients
    - Default plan length
    - Grocery list grouping
  - Keep:
    - Default recipe view
    - Default unit mode
  - Place the retained defaults in Appearance with the other recipe presentation settings.
- Out of scope:
  - Removing the underlying preference fields.
  - Removing database columns, API payload fields, archive fields, or migration behavior.
- Dependencies:
  - `SettingsPreferences`
  - Preference service normalization and defaults
  - Data archive safe-preference fields
  - Existing compatibility behavior
- Implementation assumptions:
  - The removed settings should be hidden from the UI only and remain persisted for backward compatibility.

### C3: Consolidate Data & privacy handling

- Intended outcome: Avoid presenting two competing data-management surfaces.
- In scope:
  - Remove the legacy preferences JSON export action.
  - Remove the “Reset all preferences” action from the routine settings content.
  - Add a clearly separated, confirmed “Reset preferences” action to Data Management.
  - Keep versioned export, restore, merge, replace, and conflict handling in Data Management.
  - Update Data Management descriptions so users understand what is included and what destructive actions affect.
  - Style reset as a danger action and provide pending, success, cancellation, and inline failure states without losing the user’s current settings view.
- Out of scope:
  - Removing the `/api/preferences/export` endpoint immediately.
  - Removing preference reset support from the service or API.
  - Changing archive format or safe preference contents.
- Dependencies:
  - `DataManagementSection`
  - Legacy `exportUserData` and `resetPreferences` renderer calls
  - Preferences reset API
  - Data archive schema and restore flow
- Implementation assumptions:
  - Removing the controls means removing them from the UI, while backend endpoints remain available for compatibility or future use.
  - Resetting preferences remains available, but only as a clearly scoped destructive action in Data Management.

### C4: Modularize the settings implementation

- Intended outcome: Make the page easier to maintain by separating each tab and reducing the responsibility of `settings.tsx`.
- In scope:
  - Extract tab views into separate components or files.
  - Extract shared settings types, constants, and reusable control patterns where useful.
  - Keep shared persistence/error behavior centralized enough to avoid duplicated save logic.
  - Preserve public exports used by current tests, especially `getNextSettingsTabId` and `getPairingCodeRemainingSeconds`.
- Out of scope:
  - Rewriting the settings persistence architecture.
  - Refactoring unrelated settings components that are already separate.
- Dependencies:
  - Large state and handler surface currently owned by `SettingsPage`.
  - LAN pairing lifecycle and connection-specific effects.
  - Shared `styles` import and common controls.
- Implementation assumptions:
  - A shared controller hook or context is preferable to passing dozens of unrelated props through every tab.
  - “One file per tab” should be treated as a target structure, not an absolute rule if a tab has tightly coupled subcomponents.

## Clarifications

### Asked and answered

- Appearance scope: include visual settings, Home Dashboard controls, Meal Bank placement, recipe library default sort, default recipe view, and default unit mode.
- Legacy export/reset controls: remove the legacy JSON export; move preference reset into a separated destructive area within Data Management.
- Removed Grocery & planning settings: hide them only and retain the underlying contracts.
- Navigation: implement the guideline-required left sidebar and right-side scrollable detail pane.
- Search: include sticky sidebar search in this iteration.

### Outstanding decisions

No material clarification is required before planning.

### Assumptions used for this assessment

- “Grocery & planning” refers to the four controls currently rendered in the `Grocery & planning` card, not pantry staples, grocery-list display on the Home Dashboard, or the Data Management archive’s grocery domain.
- The existing versioned archive is the preferred supported data portability workflow.
- Existing persisted `app-settings` tab IDs should migrate to `general`, which preserves the closest broad application-behavior context.

## Current-State Evidence

- The page currently defines five tabs: App Settings, Dietary Profile, Meal Plans, Network, and Data Management in `settings.tsx:190`.
- App Settings currently mixes theme, desktop lifecycle, update checks, diagnostics, Meal Bank layout, Home Dashboard controls, Grocery & planning, and Data & privacy. The theme and desktop settings begin in `settings.tsx:1640`.
- Home Dashboard controls are persisted through independent app-setting keys such as `home_upcoming_days`, `home_show_grocery_list`, and `home_show_meal_activity` in `settings.tsx:590`.
- The Grocery & planning card currently contains the four obsolete controls and the two retained recipe display controls in `settings.tsx:2380`.
- Data & privacy currently exposes the legacy JSON export and preference reset actions in `settings.tsx:2450`.
- Versioned archive export and restore are already encapsulated by `DataManagementSection` in `settings.tsx:1400` and `DataManagementSection.tsx:1`.
- The preference service still owns the obsolete Grocery & planning fields, their defaults, and their serialized payload contract in `preference-service.ts:24` and `preference-service.ts:58`.
- The shared renderer/server preference payload still includes those fields in `types.ts:7`.
- The archive allowlist and strict schema still include those fields in `data-management-schemas.ts:42` and `data-management-schemas.ts:580`.
- The legacy JSON export route remains separate from the versioned archive flow in `preferences.ts:106`.
- Settings keyboard navigation tests assume the current five-tab order in `settings-tabs.test.ts:5`.
- The settings stylesheet already supports a constrained page width, responsive two-column forms, collapsible sections, and tab styling in `settings.module.css:1`.
- The current stylesheet does not yet establish the required sidebar/detail layout or search presentation; those are new layout responsibilities for the settings surface.
- Existing settings-related components already provide a pattern for extraction: `DataManagementSection`, `MealTypesSection`, `MealSubTypesSection`, `ChipList`, `TagCloud`, `SegmentedControl`, and `ToggleSwitch`.
- The Home Dashboard independently reads and normalizes the same Home settings in `home-dashboard.tsx:60`, so moving the controls in the UI should not change their app-setting keys.
- The current page persists the selected category in `localStorage` through `settings-active-tab`; the `app-settings` value should migrate to `general` when the category split is introduced.

## Impact Findings

### C1: Reorganize settings categories

- Classification: beneficial with conditions
- Positive impact:
  - Separates broad device behavior from visual presentation.
  - Makes the new Appearance concept concrete without removing useful existing settings.
  - Preserves Dietary Profile and Meal Plans as first-class workflows.
  - Fits the guideline’s recommended category count.
- Negative impact or unintended consequence:
  - Existing users may have a stored `settings-active-tab` value of `app-settings`.
  - Renaming or splitting that tab could cause the page to fall back to an unexpected category.
  - Moving Home Dashboard settings without updating descriptions could make display controls difficult to find.
- Affected surfaces:
  - `TABS`, `TAB_IDS`, tab rendering, local-storage persistence, keyboard navigation, responsive layout.
  - Theme, Home Dashboard, Meal Bank, recipe display defaults, desktop behavior, updates, and diagnostics.
- Dependencies and interactions:
  - C2 determines which controls remain in the reorganized layout.
  - C4 determines whether category components receive state through props, context, or a controller hook.
- Confidence and rationale:
  - High confidence that the current grouping is too broad, because the App Settings tab combines multiple unrelated concerns.
  - The category ownership decision is closed: Meal Bank placement and recipe sorting are presentation/layout preferences and belong in Appearance.
- Discriminating check:
  - Render the sidebar and detail pane at desktop and minimum supported widths, then verify every setting remains reachable, searchable, labeled, and associated with the correct category.
- Recommendation: proceed

### C2: Remove obsolete Grocery & planning UI

- Classification: beneficial with conditions
- Positive impact:
  - Reduces visible settings that users no longer need.
  - Keeps the two recipe-detail preferences that still affect the cooking workflow.
  - Avoids unnecessary schema and migration risk by retaining the underlying fields.
- Negative impact or unintended consequence:
  - Existing users may have configured the removed values and will no longer be able to edit them.
  - The UI, documentation, and archive descriptions could become inconsistent if they continue to describe these fields as active user controls.
  - Future code could mistakenly interpret retained fields as user-editable despite their hidden status.
- Affected surfaces:
  - `settings.tsx` controls and now-unused option arrays.
  - User-facing settings documentation.
  - No immediate changes required to Prisma, API, preference service, or archive schemas.
- Dependencies and interactions:
  - The retained default recipe view and unit mode belong in Appearance with the other recipe presentation settings.
  - The archive should continue importing/exporting the retained and hidden fields to preserve compatibility.
- Confidence and rationale:
  - High confidence that hiding the controls is safer than deleting the contracts. The fields are present in the service payload, shared types, database schema, seed data, and archive schema.
- Discriminating check:
  - Start with a database containing non-default values for all four removed fields, open Settings, verify the controls are absent, then export/import an archive and confirm the values survive unchanged.
- Recommendation: proceed

### C3: Consolidate Data & privacy handling

- Classification: beneficial with conditions
- Positive impact:
  - Removes duplicate export concepts.
  - Directs users toward the more capable versioned archive workflow.
  - Retains a recovery path for preferences without mixing destructive behavior into routine settings.
  - Keeps backup and restore behavior in the component already designed for validation, preview, conflict resolution, and safe application.
- Negative impact or unintended consequence:
  - Moving preference reset into Data Management makes the action less visible, so it must be clearly labeled and separated from archive import/export actions.
  - Keeping the backend legacy export endpoint while removing its UI access may create undocumented behavior unless the endpoint is explicitly treated as compatibility-only.
- Affected surfaces:
  - `settings.tsx` imports, handlers, dialogs, and rendered actions.
  - Data Management copy and possibly its action layout.
  - Legacy API endpoints can remain unchanged.
- Dependencies and interactions:
  - Data Management must expose reset as a visually separated, confirmed destructive action.
  - The legacy JSON export endpoint should remain unchanged for compatibility, but its renderer helper and visible action can be removed if no other caller exists.
- Confidence and rationale:
  - High confidence. Removing the legacy export is supported by the existing archive flow, and relocating reset preserves the guideline-required recovery path.
- Discriminating check:
  - Review the final Data Management workflow against the guideline and verify that users still have a clearly scoped way to restore preferences without deleting meal plans or recipes.
- Recommendation: revise

The confirmed direction is to remove the legacy JSON export action and move “Reset preferences” into a clearly separated destructive area within Data Management.

### C4: Modularize the implementation

- Classification: beneficial with conditions
- Positive impact:
  - Reduces the current page’s very large state, effect, handler, and JSX surface.
  - Makes each category independently reviewable and testable.
  - Matches the existing pattern of extracted settings components.
  - Makes later additions to Appearance or Accessibility less risky.
- Negative impact or unintended consequence:
  - Naive extraction could create prop-heavy components with worse coupling than the current file.
  - LAN pairing contains timers, visibility handling, generation guards, modal state, and platform capabilities; it needs to remain cohesive.
  - Shared autosave and preference mutation behavior must not be duplicated across tabs.
- Affected surfaces:
  - `settings.tsx`
  - New tab components
  - Shared types/constants/controller logic
  - Existing settings tests and potentially new component tests
- Dependencies and interactions:
  - C1 defines the target category boundaries used by extraction.
  - C2 and C3 reduce the code that needs to be moved.
  - Connection/Network should probably be extracted as one cohesive component with its pairing lifecycle.
- Confidence and rationale:
  - High confidence that modularization is worthwhile. The page currently imports many independent settings components but still owns all tab rendering and most behavior in one file.
- Discriminating check:
  - Extract one low-coupling tab first, run TypeScript/build and focused settings tests, then use that boundary as the pattern for the remaining tabs.
- Recommendation: proceed

## Cross-Change Considerations

- Split the current App Settings category using the confirmed ownership: Home Dashboard, Meal Bank placement, recipe display defaults, and recipe sorting belong in Appearance.
- Preserve old tab persistence by mapping `app-settings` to `general` rather than silently treating it as invalid.
- Update keyboard navigation tests for the new tab count and order.
- Retain obsolete Grocery & planning fields in:
  - Prisma/database schema
  - preference service defaults and serialization
  - shared payload types
  - data archive schema and safe-field allowlist
- Remove obsolete option constants from the renderer only when no longer referenced.
- Keep Network/LAN extraction cohesive because its timer and visibility lifecycle is more complex than the other tabs.
- The sidebar/detail pane is a required structural redesign for this iteration, not an optional tab-strip refinement.
- Search is required in the sidebar because the visible settings count exceeds 15. It must filter labels, descriptions, keywords, and category names, preserve category context, and provide a resettable empty state.
- Each visible setting must document or implement its label, description, default value, persistence key, application behavior, pending state, failure behavior, contextual disabled state, and reset path. Controls should use the appropriate interaction type for the value, such as toggles for binary settings, segmented controls for small mutually exclusive sets, and menus or inputs for option/value selection.
- The settings surface must provide visible active-category styling, keyboard and focus support, screen-reader names and relationships, responsive behavior at the minimum supported width, and independent detail-pane scrolling on desktop.
- The empty search state must explain that no settings match and provide a clear way to reset the search.
- Preference reset must use danger styling, explain its consequences before confirmation, prevent duplicate submission while pending, report failures inline, and refresh the displayed settings after success.

## Handoff Options

1. **Continue specification assessment**: No further material clarification is required before planning. Implementation details such as the exact responsive collapse behavior can be resolved in the plan while preserving the required sidebar/detail intent.
2. **Hand off to the planning agent**: Create a phased plan for:
   - Final category and navigation structure
   - Appearance and General ownership
   - UI-only removal of obsolete Grocery & planning controls
    - Removal of the legacy JSON export action and relocation of preference reset into Data Management
  - Required sidebar/detail layout and sticky settings search
   - Incremental tab extraction with a shared settings controller boundary
   - Accessibility, responsive, persistence, and focused test updates

Recommended handoff scope:

- Preserve all existing persistence and archive contracts.
- Add Appearance as a top-level category containing theme, Home Dashboard, and retained recipe display preferences.
- Hide obsolete Grocery & planning controls without schema/API deletion.
- Remove legacy JSON export.
- Relocate preference reset into a separated destructive area in Data Management to satisfy the reset-path guideline.
- Implement the left category sidebar, right scrollable detail pane, responsive narrow-window behavior, and sticky search in this iteration.
- Update tab persistence and keyboard navigation tests.
- Extract tabs incrementally, beginning with a lower-coupling tab and keeping Network/LAN lifecycle logic together.

## Quality Gate

- Every requested change was identified and mapped:
  - Settings UX/category redesign
  - Appearance category
  - Dietary Profile retention
  - Data and privacy consolidation
  - Grocery & planning removal with two retained settings
  - Settings modularization
- Material clarifications were asked and answered.
- Current-state claims are tied to renderer, service, schema, archive, documentation, and test evidence.
- Benefits, risks, dependencies, and cross-change interactions are explicit.
- Each classification includes a cheap discriminating check.
- The reset-path, category ownership, search, and navigation decisions are resolved before implementation planning.
- No application files were modified.