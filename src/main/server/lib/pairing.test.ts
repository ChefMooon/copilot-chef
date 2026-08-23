import { beforeEach, describe, expect, it } from "vitest";

import {
  clearPairingCodes,
  createPairingCode,
  pairingCodePolicy,
  redeemPairingCode,
} from "./pairing";

describe("pairing codes", () => {
  beforeEach(() => clearPairingCodes());

  it("creates a code that can be redeemed only once", () => {
    const created = createPairingCode("machine-token", 1_000);

    expect(created.code).toHaveLength(pairingCodePolicy.length);
    expect(created.code).toMatch(/^\d{4}$/);
    expect(redeemPairingCode(created.code, 1_001)).toBe("machine-token");
    expect(redeemPairingCode(created.code, 1_002)).toBeNull();
  });

  it("normalizes input and rejects expired codes", () => {
    const created = createPairingCode("machine-token", 1_000);

    expect(redeemPairingCode(` ${created.code.toLowerCase()} `, 1_001)).toBe(
      "machine-token"
    );

    const expired = createPairingCode("other-token", 1_000);
    expect(
      redeemPairingCode(expired.code, 1_000 + pairingCodePolicy.ttlMs)
    ).toBeNull();
  });

  it("clears pending codes", () => {
    const created = createPairingCode("machine-token", 1_000);
    clearPairingCodes();

    expect(redeemPairingCode(created.code, 1_001)).toBeNull();
  });
});