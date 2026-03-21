import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MachineAuthError, requireCallerIdentity } from "./machine-auth";

describe("machine auth", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.PA_MACHINE_AUTH_ENABLED;
    delete process.env.PA_MACHINE_AUTH_TOKEN;
    delete process.env.PA_MACHINE_AUTH_TOKENS;
    delete process.env.PA_MACHINE_CALLER_ID;
    delete process.env.PA_MACHINE_SOURCE;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default web identity when auth is disabled", () => {
    const request = new Request("http://localhost/api/chat");
    expect(requireCallerIdentity(request)).toEqual({
      callerId: "web-default",
      source: "web",
    });
  });

  it("resolves caller identity from mapped bearer token", () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "token-1=max-pa:max-assistant");

    const request = new Request("http://localhost/api/chat", {
      headers: {
        Authorization: "Bearer token-1",
      },
    });

    expect(requireCallerIdentity(request)).toEqual({
      callerId: "max-pa",
      source: "max-assistant",
    });
  });

  it("rejects unauthenticated requests when machine auth is enabled", () => {
    vi.stubEnv("PA_MACHINE_AUTH_ENABLED", "1");
    vi.stubEnv("PA_MACHINE_AUTH_TOKEN", "token-1");

    const request = new Request("http://localhost/api/chat");

    expect(() => requireCallerIdentity(request)).toThrowError(
      new MachineAuthError(401, "Unauthorized machine request")
    );
  });

  it("fails fast for misconfigured machine auth", () => {
    vi.stubEnv("PA_MACHINE_AUTH_ENABLED", "1");

    const request = new Request("http://localhost/api/chat");

    expect(() => requireCallerIdentity(request)).toThrowError(
      new MachineAuthError(
        500,
        "Machine auth is enabled but no machine token is configured"
      )
    );
  });

  it("rejects token mappings with blank caller ids", () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "token-1=   :max-assistant");

    const request = new Request("http://localhost/api/chat", {
      headers: {
        Authorization: "Bearer token-1",
      },
    });

    expect(() => requireCallerIdentity(request)).toThrowError(
      new MachineAuthError(
        500,
        "PA_MACHINE_AUTH_TOKENS contains an invalid token mapping"
      )
    );
  });
});
