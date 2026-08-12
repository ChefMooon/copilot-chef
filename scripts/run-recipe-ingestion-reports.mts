import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

import * as recipeService from "../src/main/server/services/recipe-service";
import type { RecipeIngestionReport } from "../src/main/server/services/recipe-service";

type RecipeServiceModule = {
  runRecipeIngestionDiagnostic?: typeof import("../src/main/server/services/recipe-service").runRecipeIngestionDiagnostic;
  default?: {
    runRecipeIngestionDiagnostic?: typeof import("../src/main/server/services/recipe-service").runRecipeIngestionDiagnostic;
  };
};

const recipeServiceModule = recipeService as unknown as RecipeServiceModule;
const recipeIngestionDiagnostic =
  recipeServiceModule.runRecipeIngestionDiagnostic ??
  recipeServiceModule.default?.runRecipeIngestionDiagnostic;

if (!recipeIngestionDiagnostic) {
  throw new Error("Recipe ingestion diagnostic export is unavailable.");
}

const runRecipeIngestionDiagnostic: NonNullable<typeof recipeIngestionDiagnostic> =
  recipeIngestionDiagnostic;

export const defaultUrlListPath = resolve(
  "src/main/server/services/recipe-ingestion-urls.txt"
);
export const defaultOutputDirectory = resolve("tmp/recipe-ingestion-reports");

type DiagnosticFailure = {
  source: { url: string };
  error: { message: string };
};

export function parseRecipeIngestionUrls(contents: string): string[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function validateRecipeIngestionUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  }
  return url.toString();
}

function reportFileName(url: string, usedNames: Set<string>): string {
  let base: string;
  try {
    const parsed = new URL(url);
    const pathName = basename(parsed.pathname, extname(parsed.pathname));
    base = `${parsed.hostname}-${pathName || "recipe"}`;
  } catch {
    base = `${url}-recipe`;
  }

  base = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "recipe";

  let name = `${base}.json`;
  let suffix = 2;
  while (usedNames.has(name)) {
    name = `${base}-${suffix}.json`;
    suffix += 1;
  }
  usedNames.add(name);
  return name;
}

export async function runRecipeIngestionReports({
  urlListPath = defaultUrlListPath,
  outputDirectory = defaultOutputDirectory,
}: {
  urlListPath?: string;
  outputDirectory?: string;
} = {}) {
  const contents = await readFile(urlListPath, "utf-8");
  const urls = parseRecipeIngestionUrls(contents);
  const reports: Array<{ url: string; path: string; title?: string; error?: string }> = [];
  const usedNames = new Set<string>();

  await mkdir(outputDirectory, { recursive: true });

  for (const value of urls) {
    const filePath = resolve(outputDirectory, reportFileName(value, usedNames));

    try {
      const normalizedUrl = validateRecipeIngestionUrl(value);
      const report: RecipeIngestionReport =
        await runRecipeIngestionDiagnostic(normalizedUrl);
      await writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
      reports.push({ url: normalizedUrl, path: filePath, title: report.source.title });
      console.log(`Wrote ${filePath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failure: DiagnosticFailure = {
        source: { url: value },
        error: { message },
      };
      await writeFile(filePath, JSON.stringify(failure, null, 2), "utf-8");
      reports.push({ url: value, path: filePath, error: message });
      console.error(`Failed ${value}: ${message}`);
    }
  }

  return {
    outputDirectory,
    attempted: urls.length,
    succeeded: reports.filter((report) => !report.error).length,
    failed: reports.filter((report) => Boolean(report.error)).length,
    reports,
  };
}

async function main() {
  const result = await runRecipeIngestionReports({
    urlListPath: process.argv[2] ? resolve(process.argv[2]) : defaultUrlListPath,
    outputDirectory: process.argv[3]
      ? resolve(process.argv[3])
      : defaultOutputDirectory,
  });

  console.log(
    `Recipe ingestion reports complete: ${result.succeeded} succeeded, ${result.failed} failed.`
  );
  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
