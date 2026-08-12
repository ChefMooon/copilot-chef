# Recipe Ingestion Test Guide

## Purpose

Use the live report runner to try the actual URL ingestion path against a small list of recipe pages. The runner does not save recipes to the database. It fetches each URL through Defuddle and the HTML fallback parser, then writes diagnostic JSON that can be reviewed or handed to an agent.

## Add URLs

Add one URL per line to [`src/main/server/services/recipe-ingestion-urls.txt`](../src/main/server/services/recipe-ingestion-urls.txt):

```text
# Comments and blank lines are ignored.
https://example.com/recipe-one
https://example.com/recipe-two
```

Use complete `http://` or `https://` URLs. Keep the list small while investigating a parser issue. The file is tracked as a template, but real URLs may be local test data and should be removed or kept private when appropriate.

## Run the reports

From the project root:

```text
npm run recipe:reports
```

Reports are written to `tmp/recipe-ingestion-reports/`, which is ignored by git. The command attempts every URL and writes one JSON file per URL. A failed URL receives a report containing the original URL and an error message; the command exits with a nonzero status after all URLs have been attempted if any URL failed.

To use a different URL list or output directory:

```text
npm run recipe:reports -- path/to/urls.txt path/to/output-directory
```

The report command runs outside Electron and does not create, update, or duplicate recipes in the application database.

## Review a report

Open the report whose filename corresponds to the URL and check:

- `source`: normalized URL, hostname, title, description, and fetched content lengths
- `ingredientExtraction.source`: whether HTML, markdown, or the fallback path supplied ingredients
- `ingredientExtraction.rawCandidates`: the ingredient lines the parser actually received
- `ingredientExtraction.normalized`: parsed names, quantities, units, notes, and confidence
- `ingredientExtraction.flaggedLowConfidence`: entries that need review
- `instructions`: extracted instructions and whether the default fallback was used
- `cookNotes`: notes found in the HTML recipe notes section
- `validation.warnings`: missing or fallback source information
- `finalRecipe`: the draft shape that the application would use for the imported recipe

A report is diagnostic evidence, not an expected-output test. Websites can change, block automated requests, or return different content between runs. For a parser fix, keep the report path and the relevant raw evidence in the investigation, then add a deterministic regression test at the parser or analysis boundary.

## Hand off a problem to an agent

Include the URL, report path, expected-versus-actual behavior, and the focused test command. For example:

```text
Investigate recipe ingestion for:
URL: https://example.com/recipe
Report: tmp/recipe-ingestion-reports/example-com-recipe.json
Command: npm run recipe:reports

Expected: all listed ingredients are extracted with their quantities and units.
Actual: the report has 12 visible ingredients but only 8 raw candidates; the
remaining four are missing from ingredientExtraction.rawCandidates.

Please inspect the production ingestion and parser code, identify the root cause,
add a deterministic regression test, make the smallest fix, and run:
npm run test -- --run src/main/server/services/recipe-service.ingest-parser.test.ts scripts/run-recipe-ingestion-reports.test.ts
```

Give the agent the report and the URL-list entry together. The report shows what the ingestion logic decided, while the live URL identifies the page that exposed the problem.

## Deterministic tests

The normal test suite does not fetch live websites. Focused parser and runner checks can be run with:

```text
npm run test -- --run src/main/server/services/recipe-service.ingest-parser.test.ts scripts/run-recipe-ingestion-reports.test.ts
```

The parser tests cover reusable HTML ingredient and cook-note extraction. The report-runner tests cover URL-list parsing, protocol validation, malformed URL failure reports, and per-run result handling. Add a new deterministic test when a report reveals a parser regression.

Run the complete suite before merging ingestion changes:

```text
npm run test
npm run lint
```

## Ingestion flow and code paths

The production flow is owned by `RecipeService.ingestFromUrl()`:

1. Defuddle fetches and converts the page to markdown.
2. The source HTML is fetched for recipe-card ingredient and cook-note extraction.
3. HTML ingredients are preferred, with markdown sections as fallback.
4. Ingredients are normalized into names, quantities, units, notes, and confidence.
5. Instructions and cook notes are extracted.
6. The shared report analysis builds the diagnostic evidence and final recipe projection.
7. The application performs its normal duplicate check and returns the draft without the report runner persisting anything.

Relevant code paths:

- `runRecipeIngestionDiagnostic()`
- `RecipeService.ingestFromUrl()`
- `buildDefuddleCommand()`
- `fetchRecipeHtml()`
- `parseIngredientLinesFromHtml()`
- `parseCookNotesFromHtml()`
- `sectionLines()`
- `normalizeIngredients()`
- `buildRecipeIngestionReport()`
- `scripts/run-recipe-ingestion-reports.mts`
