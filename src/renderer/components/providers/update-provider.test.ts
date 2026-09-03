import { describe, expect, it } from "vitest";

import { clampUpdateProgress, normalizeReleaseNotes } from "./update-provider";

describe("update provider helpers", () => {
  it("normalizes release note shapes into readable text", () => {
    expect(normalizeReleaseNotes("  Bug fixes  ")).toBe("Bug fixes");
    expect(
      normalizeReleaseNotes([
        { version: "2.0.0", note: "New planner" },
        { note: "Accessibility improvements" },
      ])
    ).toBe("2.0.0\nNew planner\n\nAccessibility improvements");
    expect(normalizeReleaseNotes({ malformed: true })).toBe(
      "Release notes are not available for this update."
    );
  });

  it("clamps progress and uses indeterminate mode for invalid values", () => {
    expect(clampUpdateProgress(-2)).toBe(0);
    expect(clampUpdateProgress(42.4)).toBe(42.4);
    expect(clampUpdateProgress(120)).toBe(100);
    expect(clampUpdateProgress(undefined)).toBeNull();
  });
});
