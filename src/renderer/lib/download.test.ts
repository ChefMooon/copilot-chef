// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadBlob, downloadJson } from "./download";

describe("download helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads a blob and cleans up the temporary URL and anchor", () => {
    const blob = new Blob(["content"], { type: "text/plain" });
    const objectUrl = "blob:test";
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue(objectUrl);
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadBlob(blob, "recipe.txt");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
    expect(document.querySelector('a[download="recipe.txt"]')).toBeNull();
  });

  it("revokes the URL and removes the anchor when clicking throws", () => {
    const objectUrl = "blob:failed";
    vi.spyOn(URL, "createObjectURL").mockReturnValue(objectUrl);
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("click failed");
    });

    expect(() => downloadBlob(new Blob(["content"]), "recipe.txt")).toThrow("click failed");
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
    expect(document.querySelector('a[download="recipe.txt"]')).toBeNull();
  });

  it("serializes JSON as UTF-8 JSON before downloading", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:json");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadJson({ title: "Crème brûlée", servings: 2 }, "recipe.json");

    const downloadedBlob = createObjectURL.mock.calls[0]?.[0];
    expect(downloadedBlob).toBeInstanceOf(Blob);
    expect(downloadedBlob?.type).toBe("application/json;charset=utf-8");
    await expect(downloadedBlob?.text()).resolves.toContain("Crème brûlée");
  });
});
