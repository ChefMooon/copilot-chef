import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createApp } from "./app";

const baseConfig = {
  server: { port: 3001, host: "127.0.0.1", logLevel: "info" },
  database: { url: "file:./data/copilot-chef.db" },
  auth: { tokens: [] },
  updates: { feedUrl: "", checkOnStartup: true },
  cors: { origins: ["http://localhost:5173"] },
} as const;

describe("server error contract", () => {
  beforeEach(() => {
    delete process.env.PA_MACHINE_AUTH_ENABLED;
    delete process.env.PA_MACHINE_AUTH_TOKENS;
  });

  afterEach(() => {
    delete process.env.PA_MACHINE_AUTH_ENABLED;
    delete process.env.PA_MACHINE_AUTH_TOKENS;
  });

  it("returns a consistent envelope for validation failures", async () => {
    const app = createApp(baseConfig);
    const testRoutes = new Hono();
    testRoutes.post("/test", async (c) => {
      const body = await c.req.json();
      z.object({ name: z.string().min(1) }).parse(body);
      return c.json({ ok: true });
    });
    app.route("/api", testRoutes);

    const response = await app.request("/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "req-123",
      },
      body: JSON.stringify({ name: "" }),
    });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.any(String),
        code: "VALIDATION_ERROR",
        requestId: "req-123",
        details: expect.any(Array),
      })
    );
  });

  it("returns a consistent envelope for unauthorized requests", async () => {
    process.env.PA_MACHINE_AUTH_ENABLED = "true";

    const app = createApp({
      ...baseConfig,
      auth: { tokens: ["secret"] },
    });

    const response = await app.request("/api/health", {
      method: "GET",
      headers: { "x-request-id": "req-auth" },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        status: "ok",
      })
    );

    const secureResponse = await app.request("/api/meals", {
      method: "GET",
      headers: {
        "x-request-id": "req-auth",
      },
    });

    expect(secureResponse.status).toBe(401);
    const securePayload = await secureResponse.json();

    expect(securePayload).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.any(String),
        code: "UNAUTHORIZED",
        requestId: "req-auth",
      })
    );
  });

  it("returns a not-found envelope for unknown routes", async () => {
    const app = createApp(baseConfig);
    const response = await app.request("/api/does-not-exist", {
      headers: { "x-request-id": "req-404" },
    });

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.any(String),
        code: "NOT_FOUND",
        requestId: "req-404",
      })
    );
  });
});
