### Settings Page Guidelines

#### 1. Scope and Design Principles

These guidelines apply to settings pages in desktop applications. Settings pages
must prioritize discoverability, accessibility, predictable behavior, and clear
feedback over visual density.

Use the simplest control that clearly communicates the setting's state, available
choices, and application behavior. Any exception to these guidelines should be
intentional and documented in the feature's design or implementation notes.

#### 2. Layout and Navigation

- **Master-detail pattern:** Use a left-aligned sidebar for top-level categories
  and a right-side scrollable pane for settings content. The active category must
  be visually distinct.
- **Content width:** Constrain the settings form to approximately 1000-1100px
  overall, or to a narrower readable width when the detail pane would otherwise
  become too wide. Do not stretch settings across the full width of ultra-wide
  windows.
- **Window resizing:** The layout must remain usable at the minimum supported
  window size. The sidebar may collapse or the detail pane may become full-width
  when space is limited.
- **Categorization:** Prefer 4-6 top-level categories, such as General,
  Appearance, Behavior, Advanced, and About. Group settings by user intent rather
  than by implementation details.
- **Navigation state:** Preserve the selected category while the settings page is
  open. Consider restoring the last selected category and support deep links to a
  specific setting when the application needs them.
- **Search:** When an application has more than 15 settings, provide a sticky
  search field near the top of the sidebar. Search labels, descriptions, keywords,
  and category names, and filter the detail pane as the user types.
- **Search results:** Matching categories should remain identifiable, matches
  should be highlighted where practical, and an empty-results state must explain
  that no settings matched the query and provide a clear way to reset the search.

#### 3. Recommended Settings Categories

Use categories that match how users think about the application, not how the
codebase is organized. The following categories are the recommended baseline for
desktop applications:

| Category | Settings that belong here |
| --- | --- |
| **General** | Startup behavior, default workspace or profile, language, regional format, notifications, link handling, and other broad application preferences that do not belong elsewhere. |
| **Appearance** | Theme, color scheme, accent color, font size, density, layout preferences, sidebar visibility, animations, and other visual presentation options. |
| **Behavior** | Interaction preferences, confirmation prompts, autosave, drag-and-drop behavior, keyboard shortcuts, navigation behavior, and how the application responds to user actions. |
| **Privacy and Security** | Telemetry, diagnostics, permissions, local data handling, authentication, session security, data sharing, and privacy-sensitive integrations. |
| **Accessibility** | Screen-reader support, reduced motion, high contrast, text scaling, keyboard access, captions, and other options that improve access. Promote this to a top-level category when the application has several accessibility settings. |
| **Advanced** | Developer-oriented, experimental, performance, networking, storage, logging, cache, database, and other settings that most users should not need to change. |
| **About** | Application name and version, licenses, acknowledgments, update status, documentation links, support resources, diagnostics, and legal information. |

These categories are a menu of options, not a requirement to create every tab.
Use 4-6 top-level categories for most applications. Omit empty or trivial
categories and place a small number of related settings in General instead.

- **Promote a category:** Make Accessibility, Privacy and Security, or Updates a
  top-level category when it contains enough settings to be discoverable and
  useful on its own.
- **Combine a category:** Combine Privacy and Security only when the application
  has very few settings in both areas and the combined label remains clear.
- **Keep About separate:** Do not mix routine configuration with About content.
  About should not contain settings that change application behavior.
- **Place updates carefully:** Put automatic update preferences in General or
  Updates. Put the current version, update history, release notes, and manual
  update actions in About or Updates.
- **Separate dangerous actions:** Keep reset, data deletion, database removal,
  and account sign-out actions in the category most relevant to their impact,
  usually Privacy and Security, Advanced, or Account. Visually separate them
  from routine settings.
- **Resolve overlap by user intent:** If a setting could fit in multiple
  categories, place it where a user would most likely look first and use search
  keywords or cross-links to make it discoverable.

#### 4. Input Component Rules

Choose controls according to the number of choices, the frequency of change, the
importance of discoverability, and whether the change can be applied immediately.

| Scenario | Preferred component | Rule |
| --- | --- | --- |
| Binary state that applies immediately | Toggle switch | Communicate the current state clearly. Do not assume the default should be off; choose a default based on safety, privacy, accessibility, platform conventions, and the common use case. |
| Binary preference that is part of a larger form | Checkbox | Use when the option is not an immediate action or when several options are submitted together. |
| 2-5 mutually exclusive options | Radio buttons or segmented control | Show all options when comparison is useful. Use a segmented control only when labels are short and the choices are frequently compared or changed. |
| 6+ mutually exclusive options | Select or searchable select | Use a select to reduce visual density. Provide a sensible default, keyboard navigation, and search when the option list is long. |
| Complex or infrequent configuration | Expandable card or dedicated subpage | Group secondary settings under a clear parent. Do not hide important settings that users need to compare together. |
| Irreversible or high-impact action | Danger button with confirmation | Separate destructive actions from routine settings. Explain the consequence and require confirmation before proceeding. |

Every control must have a visible label, a defined default, and a clear
description of what changes when it is used.

#### 5. Behavior, Persistence, and State Management

- **Immediate application:** Settings that can be safely applied independently
  should take effect immediately. Avoid global Save and Cancel buttons for these
  settings.
- **Grouped changes:** Use an explicit Apply action when multiple fields must be
  validated or applied together. Do not partially apply an invalid configuration.
- **Pending state:** Show a loading or pending state when applying a change is not
  immediate. Prevent duplicate submissions while the operation is in progress.
- **Failure handling:** If applying a setting fails, show an inline error, restore
  the previous effective value when possible, and explain how the user can retry.
  Never silently discard a requested change.
- **Persistence:** Document whether each setting persists across restarts,
  applies only to the current session, or is stored per profile or workspace.
- **Undo and reset:** Provide an undo action for consequential changes when
  practical. Provide a per-setting reset or a clearly scoped reset-to-defaults
  action when users are likely to need it.
- **Contextual disabling:** When a parent setting is off, dependent settings
  should remain visible but disabled rather than disappearing. Explain why they
  are unavailable and restore their usability immediately when the parent is
  enabled. Preserve their values unless there is a clear reason to reset them.
- **Smart defaults:** Defaults should minimize setup effort for the common use case
  while respecting privacy, safety, accessibility, performance, and platform
  expectations. Document defaults that have meaningful behavioral or resource
  implications.

#### 6. Accessibility and Interaction

- All settings must be usable with the keyboard.
- Focus indicators must remain visible and follow a logical navigation order.
- Every control must have an accessible name and an associated label.
- Icon-only controls must provide an accessible name; tooltips must not be the
  only source of essential information.
- Do not communicate state, errors, or availability through color alone.
- Disabled controls must remain understandable to keyboard and assistive
  technology users, and their disabled state must be visually clear.
- Confirmation dialogs must move focus into the dialog, provide a clear default
  action, and return focus to the initiating control when closed.
- Text, controls, and focus indicators must meet the application's accessibility
  and contrast requirements.

#### 7. Copywriting and Microcopy

- **Clear labels:** Write setting names as direct actions or nouns, not questions.
  Labels must accurately describe the resulting state or action.
- *Bad:* "Do you want to use the Noir Lounge Gold theme?"
- *Good:* "Active Theme"
- **Honest framing:** Prefer positive, direct wording, but do not obscure privacy,
  accessibility, security, performance, or resource implications.
- *Bad:* "Disable telemetry"
- *Better when accurate:* "Share anonymous usage data"
- **Impact-driven subtext:** Keep subtext focused on the practical impact,
  tradeoff, or consequence of the setting. For example, the subtext for
  "Hardware Acceleration" could read: "Improves rendering performance but
  consumes more battery."
- **Consistency:** Use the same terms for the same concepts throughout the
  application. Avoid implementation terms unless users need them to make an
  informed decision.

#### 8. Universal Setting Requirements

Every setting must have:

- One clear label.
- A defined default.
- A defined persistence behavior.
- A defined application and failure behavior.
- Explanatory text when the effect is not obvious.
- A logical location based on user intent.
- A reset path when changing it can create confusion or significant impact.
