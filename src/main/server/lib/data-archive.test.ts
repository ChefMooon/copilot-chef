import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  DataArchiveError,
  createDataArchive,
  extractDataArchive,
  sha256Hex,
} from "./data-archive";

const manifest = Buffer.from(
  '{"format":"local-recipe-book","formatVersion":1}'
);
const recipes = Buffer.from(
  '{"domain":"recipes","version":1,"recipes":[],"links":[]}'
);

describe("data archive utility", () => {
  it("round-trips canonical entries and validates checksums", () => {
    const archive = createDataArchive([
      { path: "manifest.json", data: manifest },
      { path: "data/recipes.json", data: recipes },
      {
        path: "assets/meal-photos/meal-meal-1.jpg",
        data: Buffer.from("photo"),
      },
    ]);

    const extracted = extractDataArchive(archive, {
      checksums: {
        "data/recipes.json": sha256Hex(recipes),
      },
    });

    expect(extracted.get("manifest.json")?.toString()).toBe(
      manifest.toString()
    );
    expect(extracted.get("data/recipes.json")?.toString()).toBe(
      recipes.toString()
    );
  });

  it("rejects traversal paths before extraction", () => {
    const maliciousArchive = Buffer.from(
      zipSync({ "../outside.json": Buffer.from("no") })
    );

    expect(() => extractDataArchive(maliciousArchive)).toThrowError(
      expect.objectContaining({ code: "PATH_TRAVERSAL" })
    );
  });

  it("rejects unsupported asset types", () => {
    const maliciousArchive = Buffer.from(
      zipSync({
        "manifest.json": manifest,
        "assets/meal-photos/meal-meal-1.svg": Buffer.from("not an image"),
      })
    );

    expect(() => extractDataArchive(maliciousArchive)).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_ASSET_TYPE" })
    );
  });

  it("enforces uncompressed size limits before decompression", () => {
    const archive = createDataArchive([
      { path: "manifest.json", data: manifest },
      { path: "data/recipes.json", data: recipes },
    ]);

    expect(() =>
      extractDataArchive(archive, { limits: { maxUncompressedBytes: 10 } })
    ).toThrowError(DataArchiveError);
  });

  it("rejects checksum mismatches", () => {
    const archive = createDataArchive([
      { path: "manifest.json", data: manifest },
      { path: "data/recipes.json", data: recipes },
    ]);

    expect(() =>
      extractDataArchive(archive, {
        checksums: { "data/recipes.json": "0".repeat(64) },
      })
    ).toThrowError(expect.objectContaining({ code: "CHECKSUM_MISMATCH" }));
  });
});
