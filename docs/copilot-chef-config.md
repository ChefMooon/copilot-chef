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
| `COPILOT_CHEF_DATABASE_URL` | SQLite database file path override |
| `COPILOT_CHEF_SERVER_PORT` | Embedded server port override |

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
| `lan_web_enabled` | mirrors `lan_enabled` | Enables the browser web process independently |
| `lan_web_port` | `4173` | Port used by the browser UI process |
| `lan_api_port` | inherits `server_port` | API port used when LAN mode is active |
| `lan_advertised_host` | auto-detected LAN IP | Optional host override for the advertised LAN endpoint |
| `lan_allowed_origins` | `[]` | Extra user-approved CORS origins |
| `machine_api_key` | generated on demand | Persistent machine token for browser/LAN clients |
| `machine_api_key_updated_at` | — | ISO timestamp of the last token generation or rotation |

### User Preferences

Preferences are stored in the `UserPreference` Prisma model and served through `/api/preferences`.

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
| `autoGenerateGrocery` | Automatically create a grocery list from scheduled meals |
| `consolidateIngredients` | Merge duplicate ingredients across meals |
| `defaultPlanLength` | Default plan duration |
| `groceryGrouping` | Grocery list grouping mode |
| `defaultRecipeView` | Default recipe detail view |
| `defaultUnitMode` | Default ingredient unit mode |
| `reasoningEffort` | Reserved preference field retained for compatibility |

## Detailed Reference

### Environment Variables

#### `COPILOT_CHEF_DATABASE_URL`

- Compatibility fallback: `file:./data/copilot-chef.db` when the shared loader is used outside the Electron startup path.
- Electron default: `{userData}/data/copilot-chef.db`, resolved by `src/main/server/start.ts` before database bootstrap.
- Affects: SQLite database path used by Prisma. Explicit environment overrides are respected.

#### `COPILOT_CHEF_SERVER_PORT`

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
- `autoGenerateGrocery`: default `true`
- `consolidateIngredients`: default `true`
- `defaultPlanLength`: options `"3"`, `"7"`, `"14"`
- `groceryGrouping`: options `category`, `meal`, `alpha`
- `defaultRecipeView`: options `basic`, `detailed`, `cooking`
- `defaultUnitMode`: options `cup`, `grams`
- `reasoningEffort`: currently retained but not used by the local-first workflows
