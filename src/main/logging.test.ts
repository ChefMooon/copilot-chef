import { describe, expect, it } from "vitest";

import { redactSensitiveText, sanitizeLogValue } from "./logging";

describe("logging sanitization", () => {
  it("redacts secret-like values from log strings", () => {
    expect(redactSensitiveText("Authorization: Bearer abc123")).toContain("[redacted]");
    expect(redactSensitiveText("machine_api_key=abc123")).toContain("[redacted]");
  });

  it("redacts sensitive values in structured log payloads without removing keys", () => {
    const result = sanitizeLogValue({
      token: "abc123",
      server: {
        apiKey: "secret-key",
      },
      safe: "ok",
    });

    expect(result).toEqual({
      token: "[redacted]",
      server: {
        apiKey: "[redacted]",
      },
      safe: "ok",
    });
  });
});
