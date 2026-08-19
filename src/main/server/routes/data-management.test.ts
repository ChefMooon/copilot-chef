import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDataArchive } from "../lib/data-archive";
import { DATA_ARCHIVE_LAYOUT } from "@shared/schemas/data-management-schemas";

const dataManagementServiceMock = vi.hoisted(() => ({
  exportArchive: vi.fn(),
  validateArchive: vi.fn(),
  previewImport: vi.fn(),
  applyImport: vi.fn(),
}));

vi.mock("../services.js", () => ({
  dataManagementService: dataManagementServiceMock,
}));

import { dataManagementRoutes } from "./data-management";

function createTestApp() {
  const app = new Hono();
  app.route("/api", dataManagementRoutes);
  return app;
}

describe("dataManagementRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataManagementServiceMock.exportArchive.mockResolvedValue({
      archive: createDataArchive([
        {
          path: DATA_ARCHIVE_LAYOUT.manifest,
          data: Buffer.from("{}"),
        },
      ]),
      fileName: "local-recipe-book-recipes-2026-08-19.lrb",
      manifest: {},
      missingPhotos: [],
    });
    dataManagementServiceMock.validateArchive.mockResolvedValue({
      valid: true,
      errors: [],
      manifest: {},
      counts: { entries: 2, uncompressedBytes: 20, assets: 0 },
    });
    dataManagementServiceMock.previewImport.mockResolvedValue({
      valid: true,
      manifest: {},
      conflicts: [],
      summary: { local: {}, imported: {} },
      idMap: {
        meals: {},
        recipes: {},
        groceryLists: {},
        groceryItems: {},
        prepLists: {},
        prepItems: {},
        mealTypeProfiles: {},
        mealTypeDefinitions: {},
        mealSubTypeDefinitions: {},
        preferences: {},
        assets: {},
      },
      bulkDecisions: ["keep-local", "import", "skip"],
    });
    dataManagementServiceMock.applyImport.mockResolvedValue({
      summary: {
        mode: "merge",
        imported: 1,
        skipped: 0,
        replaced: 0,
        unresolved: 0,
        conflicts: 0,
        assets: { imported: 0, skipped: 0, failed: 0 },
        preferencesRestored: false,
      },
    });
  });

  it("validates scope before invoking the service", async () => {
    const response = await createTestApp().request(
      "/api/data-management/export?scope=invalid"
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "DATA_ARCHIVE_INVALID_SCOPE" })
    );
    expect(dataManagementServiceMock.exportArchive).not.toHaveBeenCalled();
  });

  it("returns a downloadable no-store archive with a stable filename", async () => {
    const response = await createTestApp().request(
      "/api/data-management/export?scope=recipes"
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/zip");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="local-recipe-book-recipes-2026-08-19.lrb"'
    );
    expect(dataManagementServiceMock.exportArchive).toHaveBeenCalledWith(
      "recipes"
    );
  });

  it("validates bounded base64 archives through the server-owned service", async () => {
    const response = await createTestApp().request(
      "/api/data-management/import/validate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: Buffer.from("archive").toString("base64") }),
      }
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data.valid).toBe(true);
    expect(dataManagementServiceMock.validateArchive).toHaveBeenCalledWith(
      expect.any(Buffer)
    );
  });

  it("rejects malformed transport before invoking the service", async () => {
    const response = await createTestApp().request(
      "/api/data-management/import/preview",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: "not base64?" }),
      }
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "DATA_ARCHIVE_VALIDATION_FAILED" })
    );
    expect(dataManagementServiceMock.previewImport).not.toHaveBeenCalled();
  });

  it("passes explicit merge decisions and preference opt-in to apply", async () => {
    const response = await createTestApp().request(
      "/api/data-management/import/apply",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archive: Buffer.from("archive").toString("base64"),
          mode: "merge",
          restorePreferences: true,
          decisions: [
            { conflictId: "recipe:recipe-1", decision: "replace" },
          ],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(dataManagementServiceMock.applyImport).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        mode: "merge",
        restorePreferences: true,
        decisions: [{ conflictId: "recipe:recipe-1", decision: "replace" }],
      })
    );
  });
});
