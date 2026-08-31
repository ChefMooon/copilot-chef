# Local Recipe Book Configuration Reference

## Quick Reference

### Meal Plan Modal And Toast Behavior

| Behavior | Description |
| --- | --- |
| Delete confirmation focus | Delete confirmation modal focuses Delete Meal on open so Enter confirms by default |
| Delete undo toast | Delete actions from meal plan show Undo toast for 30 seconds |
| Restored toast duration | The success toast after restoring a meal is 5 seconds |

### Environment Variables

| Name | Description |
| --- | --- |
| `LOCAL_RECIPE_BOOK_DATABASE_URL` | SQLite database file path override |
| `LOCAL_RECIPE_BOOK_SERVER_PORT` | Embedded server port override |

### App Settings

These settings are stored in `{userData}/settings.json` through `src/main/settings/store.ts`.

| Key | Default | Purpose |
|---|---|---|
| `server_mode` | `"local"` | Selects embedded local server or remote server mode |
| `server_port` | `3001` | Local embedded API port |
| `remote_server_url` | — | Remote API URL used when `server_mode` is `remote` |
| `remote_api_key` | — | Remote bearer token used when `server_mode` is `remote` |
| `app_close_to_tray` | `true` | Hides to tray on close instead of quitting |
| `lan_enabled` | `false` | Enables LAN API binding |
| `app_launch_at_login` | `false` | Desktop-only native launch-at-login preference. Windows and macOS use Electron login-item integration; packaged Linux builds use an XDG autostart entry. Browser mode and development builds do not apply it. |
| `app_launch_minimized` | `false` | Desktop-only startup visibility preference. When enabled, the app starts hidden in the tray. Browser mode does not apply this setting. |
| `app_remember_window_state` | `false` | Desktop-only preference to restore the main window's last valid position, size, and maximized state. Browser mode does not apply it. |
| `updates_check_on_startup` | `true` | Checks for available app updates when the desktop app starts |
| `ui_theme` | `"system"` | Selects the application theme: `light`, `dark`, or `system` |
| `lan_web_enabled` | mirrors `lan_enabled` | Enables the browser web process independently |
| `lan_web_port` | `4173` | Port used by the browser UI process |
| `lan_api_port` | inherits `server_port` | API port used when LAN mode is active |
| `lan_advertised_host` | auto-detected LAN IP | Optional host override for the advertised LAN endpoint |
| `lan_allowed_origins` | `[]` | Extra user-approved CORS origins |
| `machine_api_key` | generated on demand | Persistent machine token for browser/LAN clients |
| `machine_api_key_updated_at` | — | ISO timestamp of the last token generation or rotation |

### User Preferences

Preferences are stored in the `UserPreference` Prisma model and served through `/api/preferences`. The Settings page is organized into General, Appearance, Dietary Profile, Meal Plans, Network, and Data Management. Preference reset is available in the separated Data Management area and does not remove recipes, meals, meal plans, archives, or device settings.

| Name | Description |
| --- | --- |
| `householdSize` | Number of people being cooked for |
| `cookingLength` | How much time is typically available to cook |
| `dietaryTags` | Dietary restrictions or lifestyle tags |
| `favoriteCuisines` | Cuisine styles the household enjoys |
| `avoidCuisines` | Cuisine styles to exclude |
| `avoidIngredients` | Ingredients to avoid |
| `pantryStaples` | Ingredients usually on hand |
| `planningNotes` | Free-form planning notes |
| `nutritionTags` | Nutrition goals or focus areas |
| `skillLevel` | Household cooking skill level |
| `budgetRange` | Grocery budget tier |
| `autoGenerateGrocery` | Legacy grocery preference; hidden from the Settings UI, retained for persistence and archive compatibility |
| `consolidateIngredients` | Legacy grocery preference; hidden from the Settings UI, retained for persistence and archive compatibility |
| `defaultPlanLength` | Legacy planning preference; hidden from the Settings UI, retained for persistence and archive compatibility |
| `groceryGrouping` | Legacy grocery preference; hidden from the Settings UI, retained for persistence and archive compatibility |
| `defaultRecipeView` | Default recipe detail view |
| `defaultUnitMode` | Default ingredient unit mode |
| `reasoningEffort` | Reserved preference field retained for compatibility |

## Detailed Reference

### Environment Variables

#### `LOCAL_RECIPE_BOOK_DATABASE_URL`

- Shared-loader default: `file:./data/local-recipe-book.db` when the shared loader is used outside the Electron startup path.
- Electron default: `{userData}/data/local-recipe-book.db`, resolved by `src/main/server/start.ts` before database bootstrap.
- Affects: SQLite database path used by Prisma. Explicit environment overrides are respected.

#### `LOCAL_RECIPE_BOOK_SERVER_PORT`

- Default: `3001`
- Affects: Embedded Hono server port when running outside the Electron settings flow.

### User Preferences

All user preferences are managed by `src/main/server/services/preference-service.ts` and rendered in `src/renderer/pages/settings.tsx`.

- `householdSize`: default `2`
- `cookingLength`: default `"weeknight"`; options `quick`, `weeknight`, `relaxed`, `weekend`
- `dietaryTags`: comma-separated dietary tags
- `favoriteCuisines`: comma-separated preferred cuisines
- `avoidCuisines`: comma-separated excluded cuisines
- `avoidIngredients`: JSON array of strings
- `pantryStaples`: JSON array of strings
- `planningNotes`: free-form notes
- `nutritionTags`: comma-separated nutrition goals
- `skillLevel`: options `beginner`, `home-cook`, `confident`, `advanced`
- `budgetRange`: options `budget`, `moderate`, `premium`
- `autoGenerateGrocery`: default `true`; hidden from the Settings UI and retained for compatibility
- `consolidateIngredients`: default `true`; hidden from the Settings UI and retained for compatibility
- `defaultPlanLength`: options `"3"`, `"7"`, `"14"`; hidden from the Settings UI and retained for compatibility
- `groceryGrouping`: options `category`, `meal`, `alpha`; hidden from the Settings UI and retained for compatibility
- `defaultRecipeView`: options `basic`, `detailed`, `cooking`
- `defaultUnitMode`: options `cup`, `grams`
- `reasoningEffort`: currently retained but not used by the local-first workflows

The legacy preferences JSON export API remains available for compatibility clients, but its renderer action is no longer part of the Settings workflow. Use the versioned Data Management archive workflow for user-facing backup and restore.

### Meal-Type Cutoffs

Each meal-type definition stores a `cutoffTime` in local 24-hour `HH:mm` format. It is a wall-clock boundary for the scheduled date, not a timestamp stored on an individual meal. The live home-dashboard weekly slot count includes today's slot through the cutoff minute and excludes it after that minute; future slots remain counted, prior dates and unscheduled meals do not count, and multiple dishes sharing a date and meal type count once.

Built-in defaults are Breakfast `10:00`, Morning Snack `11:30`, Lunch `14:00`, Afternoon Snack `17:00`, Dinner `21:00`, and Snack `23:59`. New custom definitions default to `23:59`. Missing or unknown legacy values also use `23:59`, while invalid non-empty values are rejected. Cutoffs remain part of date-ranged meal-type profile configuration so profile resolution stays self-contained.

This iteration intentionally adds cutoff editing to meal-type profiles only. It does not add a dashboard layout builder, widget ordering, arbitrary dashboard visibility configuration, or a separate dashboard settings page. Future presentation preferences can use the existing platform settings path; meal timing remains owned by meal-type profiles.
