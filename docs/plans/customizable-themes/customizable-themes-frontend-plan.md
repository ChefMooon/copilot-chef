# Customizable Themes Frontend Plan

> Status: Future implementation plan. This document records implementation intent only. It does not authorize or include application code changes.

## 1. Decision

Extend the existing renderer theme system to support user-selectable custom theme profiles while preserving the current `light`, `dark`, and `system` preferences.

The frontend should consume the existing typed custom-theme contract from `src/shared/config/theme.ts`. It should not invent a second profile shape, bypass settings normalization, or write theme values directly through Electron globals. Theme application remains a renderer concern; persistence continues through the existing platform adapter and settings boundary.

The first frontend release should support one active custom profile stored in `ui_custom_theme_profile`. Profile editing should be deliberate and constrained: users edit semantic colors, preview the result, and either apply or discard changes. A profile editor should not expose arbitrary CSS, selectors, scripts, or unbounded token names.

## 2. Existing Backend and Shared Contract

The backend/shared foundation is already implemented and is out of scope for this frontend pass.

| Capability                   | Existing owner                                                    | Current behavior                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Profile schema and parser    | `src/shared/config/theme.ts`                                      | `CustomThemeProfileSchema` validates a versioned `CustomThemeProfileV1` profile                                                         |
| Semantic token shape         | `src/shared/config/theme.ts`                                      | Includes page/surface tokens, foreground tokens, border, primary/accent/status colors, focus, overlay, chart series, and heatmap levels |
| Profile version              | `THEME_PROFILE_VERSION`                                           | Current version is `1`                                                                                                                  |
| Settings key                 | `src/shared/config/settings.ts`                                   | `ui_custom_theme_profile` accepts a valid profile or normalizes invalid input to `null`                                                 |
| Theme preference             | `src/shared/config/settings.ts`                                   | `ui_theme` accepts `light`, `dark`, or `system` and defaults to `system`                                                                |
| Settings persistence         | `src/main/settings/store.ts`                                      | Electron settings are persisted in the local user-data `settings.json` file                                                             |
| Renderer settings access     | `src/renderer/lib/platform/types.ts`                              | `getSetting`, `setSetting`, and `getAllSettings` are available through `getPlatform()`                                                  |
| Existing theme application   | `src/renderer/lib/preferences.tsx` and `src/renderer/globals.css` | Effective light/dark theme is applied with `document.documentElement.dataset.theme` and semantic CSS variables                          |
| Existing validation coverage | `src/shared/config/__tests__/loader.test.ts`                      | Valid profiles are accepted; malformed colors, versions, and stored values are rejected                                                 |

The current profile contract is:

```ts
{
  version: 1,
  id: string, // lowercase slug, maximum 64 characters
  name: string, // trimmed, 1-80 characters
  tokens: {
    background: string,
    surface: string,
    surfaceMuted: string,
    surfaceElevated: string,
    foreground: string,
    foregroundMuted: string,
    border: string,
    primary: string,
    primaryForeground: string,
    accent: string,
    accentForeground: string,
    success: string,
    warning: string,
    danger: string,
    focus: string,
    overlay: string,
    chartGrid: string,
    chartSeries: string[], // 1-12 entries
    heatmap: {
      empty: string,
      low: string,
      medium: string,
      high: string,
      future: string,
    },
  },
}
```

Colors are currently validated as six-digit hex values with an optional alpha suffix. The frontend must preserve that restriction and must treat the parser as the source of truth for profile validation.

## 3. Goals

- Let users select whether the application uses `light`, `dark`, `system`, or the saved custom profile, subject to the final preference contract decision below.
- Provide a focused custom-theme editor in Settings with semantic color controls and a readable live preview.
- Apply custom tokens consistently at the renderer root so Home, Meal Plan, Grocery List, Prep Lists, Recipes, Stats, Settings, dialogs, charts, and heatmaps use the same profile.
- Preserve the current dark-mode surface hierarchy, title-bar treatment, focus visibility, and WCAG contrast requirements.
- Keep browser/LAN and Electron behavior aligned through `getPlatform()`.
- Make invalid, incomplete, or unavailable profiles fail closed to a usable built-in theme.
- Add automated coverage for token application, preference persistence, reset behavior, and accessibility constraints.

## 4. Non-Goals

- No new database tables or Prisma migrations.
- No new API endpoints or IPC channels unless the existing generic settings adapter is proven insufficient.
- No arbitrary CSS editor, CSS injection, JavaScript customization, gradients, images, fonts, layout settings, or per-component selectors in the first release.
- No multi-profile library, profile import/export, cloud sync, account sync, or cross-device synchronization in the first release.
- No redesign of the existing light or dark palettes.
- No replacement of semantic CSS variables with component-specific custom properties unless a concrete unmapped token requires it.
- No changes to the settings storage format without an explicit versioned shared-contract decision.

## 5. Current Renderer Gap

The renderer currently resolves only `ui_theme` and applies a built-in light or dark dataset. `PreferenceProvider` does not load `ui_custom_theme_profile`, and `globals.css` contains built-in token declarations but no profile-to-CSS-variable translation layer.

The frontend work therefore needs to introduce a small theme-resolution boundary that:

1. Reads `ui_theme` and `ui_custom_theme_profile` through `getPlatform()`.
2. Validates or normalizes the profile through the shared parser.
3. Resolves system preference when requested.
4. Chooses a built-in or custom token source.
5. Applies semantic CSS variables to the document root.
6. Removes custom overrides when the user returns to a built-in theme.
7. Re-applies the profile when the operating-system theme changes, if the selected preference depends on system mode.

## 6. Proposed Frontend Design

### 6.1 Theme preference model

Add a renderer-facing effective preference model rather than spreading conditionals across pages. The model should distinguish:

- `light`
- `dark`
- `system`
- `custom` or an equivalent representation that identifies the saved custom profile

The exact persisted representation is an open decision. Prefer extending the existing `ui_theme` contract in a backward-compatible way only if the shared settings schema, environment configuration, and existing Settings controls can all support it cleanly. Otherwise, keep `ui_theme` as the built-in mode selector and use a separate explicit activation setting only after documenting why the split is necessary.

Existing releases must continue to interpret `light`, `dark`, and `system` exactly as they do today. A missing or invalid custom profile must never prevent the app from rendering.

### 6.2 Theme resolution module

Create a renderer utility near `src/renderer/lib/preferences.tsx`, such as `src/renderer/lib/theme/`, responsible for pure and side-effectful operations:

- Convert a validated `CustomThemeProfileV1` into CSS custom-property assignments.
- Map shared semantic names to the existing CSS token names.
- Apply and clear custom properties on `document.documentElement`.
- Resolve built-in versus custom theme precedence.
- Return a safe fallback when a profile is absent or invalid.

Keep the pure token mapping separately testable from DOM mutation. Do not make individual page components aware of the profile schema.

The mapping must establish a complete semantic token set. A custom profile that omits a required token is invalid; it must not partially override the built-in theme and leave unpredictable mixed colors.

### 6.3 CSS token bridge

Use the existing semantic variables in `src/renderer/globals.css` as the component-facing API. Custom profiles should override the semantic variables, not the raw legacy palette variables or Tailwind classes directly.

The bridge should define an explicit mapping for at least:

| Profile token                   | Renderer role                                 |
| ------------------------------- | --------------------------------------------- |
| `background`                    | Page/application background                   |
| `surface`                       | Standard card and panel surface               |
| `surfaceMuted`                  | Muted bands, tracks, and secondary regions    |
| `surfaceElevated`               | Focused panels, popovers, and elevated inputs |
| `foreground`                    | Primary text and icons                        |
| `foregroundMuted`               | Metadata, helper text, and secondary labels   |
| `border`                        | Structural boundaries and input borders       |
| `primary` / `primaryForeground` | Primary actions and selected states           |
| `accent` / `accentForeground`   | Accent actions and labels                     |
| `success`, `warning`, `danger`  | Status and validation states                  |
| `focus`                         | Focus-visible outlines and rings              |
| `overlay`                       | Modal and popover overlays                    |
| `chartGrid`, `chartSeries`      | Recharts and other chart colors               |
| `heatmap.*`                     | Activity heatmap levels                       |

The existing dedicated header tokens are not present in the shared profile contract. Decide whether they should be derived from the semantic tokens or added to a future profile version before implementation. Do not silently derive a low-contrast title bar from arbitrary profile colors.

### 6.4 Settings editor

Extend the existing theme section in `src/renderer/pages/settings.tsx` with:

- Built-in theme selection that retains the current `light`, `dark`, and `system` choices.
- A custom-theme activation control, if the preference model supports it.
- Profile name editing with the schema’s length and slug constraints handled before persistence.
- Grouped color inputs by purpose: surfaces, text, actions/status, data visualization, and focus/overlay.
- A live preview using the same semantic variables as the application, isolated so incomplete drafts do not corrupt the entire page.
- Apply/save, cancel/discard, reset to built-in defaults, and invalid-profile recovery states.
- Unsaved-change handling when navigating away or switching theme modes.

The editor should use accessible labels, native color inputs where appropriate, text/hex fallback where needed, keyboard navigation, visible focus, and a preview that demonstrates normal text, muted text, borders, controls, chart colors, heatmap levels, and destructive/status states.

Do not expose raw CSS variable names as user-facing copy. Use plain semantic labels such as “Page background,” “Card surface,” “Primary text,” and “Focus outline.”

### 6.5 Live preview and application timing

Apply draft tokens only within a preview scope until the user commits them. The committed profile should be applied at the renderer root and persisted through `getPlatform().setSetting("ui_custom_theme_profile", profile)`.

On startup:

1. Apply the built-in fallback immediately.
2. Load the stored theme preference and custom profile.
3. Validate the profile.
4. Apply the resolved theme before normal page interaction where practical.
5. Set `data-theme` consistently for built-in light/dark behavior and expose a separate custom-profile state only if the final preference model requires it.

When the profile is cleared, remove every custom override before applying the selected built-in theme. Avoid stale custom variables surviving a reset.

### 6.6 Accessibility guardrails

The editor and runtime must enforce or clearly report:

- Normal text contrast of at least `4.5:1`.
- Large text contrast of at least `3:1`.
- Structural boundaries, active states, focus indicators, and other meaningful non-text UI contrast of at least `3:1`.
- Distinguishable chart and heatmap levels, with non-color cues where the data meaning requires them.
- Visible keyboard focus in both built-in and custom themes.
- A readable recovery path if a stored profile fails validation or produces an unsafe combination.

The frontend should calculate contrast from the draft profile and mark failing pairs before Apply. Runtime validation should still retain a fallback because stored settings may come from older versions or external edits.

## 7. Implementation Phases

### Phase 0: Lock the preference contract

- Decide whether custom activation extends `ui_theme` or uses a separate setting.
- Decide whether header-specific tokens belong in version 1 through derivation or require `THEME_PROFILE_VERSION = 2`.
- Define built-in profile serialization, reset semantics, and browser versus Electron persistence expectations.
- Update shared schemas and settings documentation only if the decisions require contract changes.

### Phase 1: Add the renderer theme boundary

- Create pure profile-to-CSS-token mapping and contrast helpers.
- Extend `PreferenceProvider` or extract a dedicated theme provider.
- Load both theme preference and custom profile through `getPlatform()`.
- Apply and clear root-level custom properties without changing page components yet.
- Add tests for resolution, fallback, DOM application, clearing, and system-theme changes.

### Phase 2: Migrate and audit semantic tokens

- Audit `globals.css`, Tailwind mappings, and CSS modules for tokens not represented by the custom profile.
- Map any remaining hard-coded light/dark values that would defeat customization.
- Verify Home first, then shared shell, dialogs, forms, charts, heatmaps, and the remaining routes.
- Preserve the current dark-mode title-bar and surface hierarchy.
- Add visual regression checkpoints for light, dark, system, and custom modes.

### Phase 3: Build the Settings editor

- Add the profile editor and preview to Settings.
- Implement draft state separate from persisted state.
- Add validation messages, contrast results, apply/cancel/reset, and unsaved-change handling.
- Keep the editor usable at desktop and narrow widths.
- Ensure browser mode remains functional when desktop-only capabilities are unavailable.

### Phase 4: Harden persistence and recovery

- Test malformed stored JSON, old profile versions, missing profiles, partial profiles, and failed writes.
- Confirm failed saves restore the previous UI state and show an actionable error.
- Confirm reset removes overrides and returns to the selected built-in mode.
- Add migration behavior only if the preference contract changed in Phase 0.

### Phase 5: Release validation

- Run focused theme tests, renderer tests, lint, full tests, and web build.
- Perform Electron and browser/LAN screenshot QA on Home, Settings, Meal Plan, Grocery List, Prep Lists, Recipes, Stats, dialogs, and title-bar controls.
- Test desktop and narrow layouts, keyboard navigation, system theme changes, reloads, and restart persistence.
- Update the style guide and configuration documentation with the final user-facing contract.

## 8. Likely Change Surface

| Area                                                     | Expected future changes                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/renderer/lib/preferences.tsx`                       | Load/resolve custom profile and coordinate effective theme state, or delegate to a new theme provider |
| `src/renderer/lib/theme/`                                | New pure resolver, CSS variable mapper, contrast utilities, and DOM application helpers               |
| `src/renderer/globals.css`                               | Complete semantic token bridge and any explicitly approved derived header tokens                      |
| `src/renderer/pages/settings.tsx`                        | Custom profile controls, draft lifecycle, save/reset/error behavior                                   |
| `src/renderer/components/settings/` or new UI components | Reusable color field groups, preview, contrast report, and profile editor components                  |
| `src/renderer/lib/platform/`                             | Only if typed settings helpers are needed; continue using the platform boundary                       |
| `src/shared/config/theme.ts`                             | Only for a deliberate contract/version change                                                         |
| `src/shared/config/settings.ts`                          | Only for the final custom activation preference decision                                              |
| `src/renderer/**/*.test.ts(x)`                           | Resolution, persistence, accessibility, and component interaction tests                               |
| `docs/copilot-chef-style-guide.md`                       | Final token mapping, editor behavior, and accessibility rules                                         |
| `docs/copilot-chef-config.md`                            | User-facing settings key and persistence behavior if the contract changes                             |

## 9. Open Decisions

1. **Activation model:** Should `ui_theme` accept `custom`, or should a separate setting identify the active profile while `ui_theme` remains the built-in mode preference?
2. **Profile scope:** Is one saved profile sufficient for the first release, or is a named profile collection required?
3. **Header tokens:** Should title-bar colors be derived from profile tokens, or should the profile schema gain explicit header semantic tokens in version 2?
4. **Built-in profile editing:** Should users edit a copy of the current built-in theme, or always start from a neutral custom template?
5. **Persistence in browser mode:** Should browser/LAN mode persist the profile locally per browser/device, or should it be sent to the connected app settings store like Electron mode?
6. **Contrast enforcement:** Should Apply be blocked for failures, or should the editor allow saving with a warning and always fall back only for invalid schema values?
7. **Import/export:** Should JSON profile import/export be part of the first editor release or remain a later capability?

## 10. Acceptance Criteria

- Existing `light`, `dark`, and `system` behavior is unchanged for users without a custom profile.
- A valid `CustomThemeProfileV1` can be loaded, previewed, applied, persisted, reloaded, and cleared through the renderer platform boundary.
- Invalid or unsupported profiles never leave the application with a partially applied or unreadable theme.
- All production renderer surfaces use semantic variables that can be overridden by the profile, including the Home dashboard, title bar, dialogs, charts, heatmaps, forms, and status states.
- The Settings editor supports keyboard use, accessible names, visible focus, narrow layouts, and clear save/reset/error states.
- Contrast checks cover normal text, large text, structural boundaries, active states, focus indicators, chart colors, and heatmap levels.
- Browser/LAN and Electron modes have documented and tested persistence behavior.
- Focused tests, the full suite, lint, production web build, and manual screenshot QA pass before release.

## 11. Related Sources

- [Architecture improvement plan](local-recipe-book-architecture-improvement-plan.md)
- [Frontend style guide](../copilot-chef-style-guide.md)
- [Configuration and settings reference](../copilot-chef-config.md)
- [Electron IPC channel reference](../ipc-channels.md)
- [Shared theme contract](../../src/shared/config/theme.ts)
- [Shared settings contract](../../src/shared/config/settings.ts)
- [Renderer preference provider](../../src/renderer/lib/preferences.tsx)
