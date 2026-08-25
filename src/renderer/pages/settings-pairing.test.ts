// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { getPairingCodeRemainingSeconds } from "./settings";

describe("PWA pairing code expiry", () => {
  it("rounds a valid expiry up to the next whole second", () => {
    expect(
      getPairingCodeRemainingSeconds(
        "2026-08-25T12:05:00.000Z",
        Date.parse("2026-08-25T12:04:58.100Z")
      )
    ).toBe(2);
  });

  it("clamps an expired code to zero", () => {
    expect(
      getPairingCodeRemainingSeconds(
        "2026-08-25T12:05:00.000Z",
        Date.parse("2026-08-25T12:05:00.000Z")
      )
    ).toBe(0);
  });

  it("returns null for malformed expiry data", () => {
    expect(getPairingCodeRemainingSeconds("not-a-date", Date.now())).toBeNull();
  });
});
