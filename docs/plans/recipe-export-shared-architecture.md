# Recipe Export Shared Architecture Plan

## Purpose

Define the reusable export infrastructure to create before adding human-readable recipe export formats. This plan is based on the existing menu export, legacy recipe JSON export, data-management archive export, and browser download flows.

## Recommendation

Share export transport and file-delivery mechanics, but keep menu and recipe document models, serializers, and formatters domain-specific.

Menu export is a presentation pipeline:

```text
MealPayload[] -> MenuDocument -> HTML / Markdown / CSV
```

Legacy recipe export is a versioned compatibility contract:

```text
Recipe rows -> RecipeExportJson -> JSON import/export
```

These models have different purposes and should not be merged into a universal export document.

## Reusable Pieces

### Renderer download utility

Create `src/renderer/lib/download.ts` with browser-only helpers:

```ts
export function downloadBlob(blob: Blob, fileName: string): void;
export function downloadJson(data: unknown, fileName: string): void;
```

Move the object URL and temporary anchor behavior currently duplicated by:

- `triggerDownload` in `src/renderer/components/meal-plan/MenuPrintExportModal.tsx`
- `downloadJson` in `src/renderer/pages/recipes.tsx`

The utility should own object URL creation, anchor insertion, click, cleanup, and JSON serialization. It should not know about menus, recipes, API routes, or export formats.

### Renderer binary response handling

Reuse the existing `fetchBinary` infrastructure in `src/renderer/lib/api.ts` for endpoints that return downloadable responses. It already handles blobs, content types, content lengths, `Content-Disposition` filename parsing, UTF-8 filenames, structured API errors, and `Cache-Control: no-store` behavior.

Refactor `exportMenu` and other binary exports to use that path instead of repeating response parsing. Do not force typed JSON APIs such as the existing recipe export endpoint through binary handling.

A small wrapper may be added when useful:

```ts
export async function fetchExport(
  path: string,
  fallbackFileName: string
): Promise<BinaryResponse>;
```

Keep this wrapper transport-oriented. Filename construction remains domain-specific.

### Filename primitives

Share only generic filename sanitization, for example:

```ts
export function slugifyFilePart(value: string, fallback: string): string;
export function ensureExtension(fileName: string, extension: string): string;
```

Keep complete filenames domain-specific:

- Menus use title and date range.
- Recipes use export scope, recipe count, and current date or an equivalent recipe-specific convention.
- Data archives use archive-specific naming and service rules.

### Server downloadable response helper

If response-header duplication remains after renderer cleanup, add:

```text
src/main/server/lib/download-response.ts
```

with a helper such as:

```ts
createDownloadResponse(context, {
  body,
  contentType,
  fileName,
  status,
});
```

The helper should consistently set `Content-Type`, `Content-Disposition`, and `Cache-Control: no-store`. It must not select formats, build filenames, or serialize domain data.

Candidate routes for migration include:

- `src/main/server/routes/menu-export.ts`
- `src/main/server/routes/data-management.ts`
- `src/main/server/routes/preferences.ts`

## Keep Domain-Specific

### Menu export

Keep these in `src/shared/menu-export.ts` and its schemas:

- Date-range normalization and inclusive-day expansion.
- Empty-day behavior.
- Meal ordering and meal-type labels.
- Menu layouts.
- Menu HTML, Markdown, and CSV structure.
- Menu print CSS and Electron PDF HTML.

`MenuPrintExportModal` should continue to own menu preview state, date range, layout, print behavior, fullscreen preview, and menu-specific UI copy.

### Recipe export

Keep these in recipe-specific modules:

- `RecipeExportJsonSchema` and v1-to-v2 compatibility normalization.
- `serializeRecipe`.
- Recipe ingredient quantity handling.
- Recipe import conflict behavior.
- Recipe IDs, source URLs, ratings, notes, timestamps, and linked-sub-recipe semantics.
- Selection by recipe IDs.
- Recipe-specific filenames and user-facing copy.

When human-readable recipe formats are implemented, add a separate module such as:

```text
src/shared/recipe-export.ts
```

with a presentation model and formatters such as:

```ts
type RecipeExportDocument = {
  title: string;
  description: string | null;
  servings: number | null;
  ingredients: Array<unknown>;
  instructions: string[];
  metadata: Record<string, unknown>;
};

formatRecipeAsHtml(document: RecipeExportDocument): string;
formatRecipeAsMarkdown(document: RecipeExportDocument): string;
formatRecipeAsCsv(document: RecipeExportDocument): string;
```

The exact fields should be finalized from the recipe export UX. Do not make `MenuDocument` or the legacy `RecipeExportJson` act as a universal presentation model.

### Data-management archive

Keep the archive system separate. It handles multiple domains, versioning, dependency closure, ID remapping, photos, checksums, validation, merge/replace semantics, and recovery. It may reuse recipe service data internally, but it is not the same product as a user-facing recipe document export.

## API Boundary

Preserve the existing typed recipe JSON contract:

```text
GET /api/recipes/export -> RecipeExportJson
```

The current renderer and import flow depend on this shape. Do not silently convert it into a binary attachment endpoint.

For future human-readable recipe formats, choose one of these explicitly:

1. Add a format query parameter and return an attachment response while preserving the default JSON behavior.
2. Add a separate format-specific route for presentation exports.

The least disruptive starting point is to preserve the default JSON response and add a clearly scoped presentation export path only when the UI requires it.

Each domain route should own:

1. Domain-specific input validation.
2. Domain service or document construction.
3. Domain-specific formatter selection.
4. Shared downloadable-response construction where the response is an attachment.

## UI Boundary

Keep export workflows domain-specific:

- `MenuPrintExportModal` owns menu preview, date range, layout, print, and PDF behavior.
- `RecipeExportModal` owns recipe export scope and modal presentation.
- `RecipesPage` owns recipe export/import orchestration.

These components can share renderer helpers for downloads, API errors, and filename primitives. Do not create a universal export modal; the menu and recipe workflows have materially different controls and preview needs.

## Implementation Sequence

1. Add `src/renderer/lib/download.ts` with `downloadBlob` and `downloadJson`.
2. Add focused tests for blob downloads, JSON serialization, object URL cleanup, and fallback filenames.
3. Refactor menu and recipe renderer flows to use the shared download utility without changing behavior.
4. Refactor `exportMenu` and other binary exports to use the existing `fetchBinary` path.
5. Add or defer `download-response.ts` until route-level header duplication is confirmed worthwhile.
6. Add route tests for `GET /api/recipes/export`, covering all recipes, selected IDs, response shape, version, and service failure behavior.
7. Add renderer API tests for the typed recipe export response.
8. Define the recipe presentation document model based on the desired UI formats.
9. Add recipe-specific HTML, Markdown, or CSV formatters and tests for escaping, empty fields, ingredient quantities, instructions, and metadata.
10. Add recipe export UI controls using the shared download utility and the recipe-specific formatter/API boundary.

## Acceptance Criteria

Before implementing human-readable recipe export:

- Menu and recipe domain models remain separate.
- Browser download behavior exists in one renderer utility.
- Binary response parsing is reused rather than copied.
- Generic filename sanitization is reusable, while domain naming remains explicit.
- The legacy recipe JSON export and import contract remains unchanged.
- Recipe presentation formatters have their own model and focused tests.
- Menu export behavior remains covered by its existing tests.
- Browser and Electron paths continue to respect the platform boundary: ordinary downloads use HTTP/browser APIs; native IPC remains for native-only PDF and file-dialog operations.

## Related Sources

- [Menu export implementation](../../src/shared/menu-export.ts)
- [Menu export schemas](../../src/shared/schemas/menu-export-schemas.ts)
- [Menu export modal](../../src/renderer/components/meal-plan/MenuPrintExportModal.tsx)
- [Recipe export service](../../src/main/server/services/recipe-service.ts)
- [Recipe routes](../../src/main/server/routes/recipes.ts)
- [Recipe export modal](../../src/renderer/components/recipes/RecipeExportModal.tsx)
- [Renderer API helpers](../../src/renderer/lib/api.ts)
- [Data management documentation](../data-management.md)
- [Documentation structure](../STRUCTURE.md)
