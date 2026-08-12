import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseRecipeIngestionUrls,
  runRecipeIngestionReports,
  validateRecipeIngestionUrl,
} from "./run-recipe-ingestion-reports.mjs";

describe("recipe ingestion report runner", () => {
  it("parses one URL per line and ignores comments and blanks", () => {
    expect(
      parseRecipeIngestionUrls(
        "# example\n\n https://example.com/one \nhttps://example.com/two\n"
      )
    ).toEqual(["https://example.com/one", "https://example.com/two"]);
  });

  it("accepts HTTP URLs and rejects unsupported protocols", () => {
    expect(validateRecipeIngestionUrl("https://example.com/recipe")).toBe(
      "https://example.com/recipe"
    );
    expect(() => validateRecipeIngestionUrl("file:///recipe")).toThrow(
      "Unsupported URL protocol"
    );
  });

  it("writes a failure report and continues after an invalid URL", async () => {
    const directory = await mkdtemp(join(tmpdir(), "recipe-report-runner-"));
    const urlListPath = join(directory, "urls.txt");
    const outputDirectory = join(directory, "reports");

    try {
      await writeFile(urlListPath, "not-a-url\n", "utf-8");
      const result = await runRecipeIngestionReports({
        urlListPath,
        outputDirectory,
      });

      expect(result).toMatchObject({ attempted: 1, succeeded: 0, failed: 1 });
      const report = JSON.parse(
        await readFile(join(outputDirectory, "not-a-url-recipe.json"), "utf-8")
      );
      expect(report.error.message).toContain("Invalid URL");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
