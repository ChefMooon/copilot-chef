import { describe, expect, it } from "vitest";

import { MenuExportRequestSchema } from "./menu-export-schemas";

describe("MenuExportRequestSchema", () => {
  it("accepts a valid menu export request", () => {
    const result = MenuExportRequestSchema.parse({
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-07T23:59:59.000Z",
      layout: "classic-grid",
      format: "html",
      includeEmptyDays: false,
      title: "Family Menu",
    });

    expect(result.layout).toBe("classic-grid");
    expect(result.format).toBe("html");
    expect(result.includeEmptyDays).toBe(false);
  });

  it("parses includeEmptyDays from query-style strings", () => {
    const result = MenuExportRequestSchema.parse({
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-07T23:59:59.000Z",
      includeEmptyDays: "false",
    });

    expect(result.includeEmptyDays).toBe(false);
  });

  it("rejects ranges longer than 31 days", () => {
    const result = MenuExportRequestSchema.safeParse({
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-05-15T23:59:59.000Z",
      layout: "compact-list",
      format: "csv",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const result = MenuExportRequestSchema.safeParse({
      from: "2026-04-07T00:00:00.000Z",
      to: "2026-04-01T23:59:59.000Z",
      layout: "card",
      format: "markdown",
    });

    expect(result.success).toBe(false);
  });
});
