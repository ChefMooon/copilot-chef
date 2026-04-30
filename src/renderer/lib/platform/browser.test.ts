// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearBrowserConnection,
  createBrowserPlatform,
  getBrowserConnection,
  importBrowserConnectionFromLocation,
  saveBrowserConnection,
} from "./browser";

describe("browser platform connection storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/#/connect");
    globalThis.fetch = undefined as typeof fetch;
  });

  it("stores and clears browser connection config", () => {
    saveBrowserConnection({
      apiUrl: "http://192.168.1.25:3001/",
      token: "machine-token",
    });

    expect(getBrowserConnection()).toEqual({
      apiUrl: "http://192.168.1.25:3001",
      token: "machine-token",
    });

    clearBrowserConnection();
    expect(getBrowserConnection()).toBeNull();
  });

  it("imports credentials from the hash fragment and clears visible token state", () => {
    window.history.replaceState(
      null,
      "",
      "/connect#api=http%3A%2F%2F192.168.1.25%3A3001&token=machine-token"
    );

    expect(importBrowserConnectionFromLocation()).toEqual({
      apiUrl: "http://192.168.1.25:3001",
      token: "machine-token",
    });
    expect(window.location.hash).toBe("");
    expect(getBrowserConnection()).toEqual({
      apiUrl: "http://192.168.1.25:3001",
      token: "machine-token",
    });
  });

  it("uses runtime config apiUrl with the saved token", async () => {
    saveBrowserConnection({
      apiUrl: "http://127.0.0.1:3001",
      token: "machine-token",
    });
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          apiUrl: "http://10.88.111.3:3001",
          webUrl: "http://10.88.111.3:4173",
          version: "0.1.0",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      ) as typeof fetch;

    const config = await createBrowserPlatform().getServerConfig();

    expect(config).toEqual({
      url: "http://10.88.111.3:3001",
      token: "machine-token",
      mode: "local",
    });
    expect(getBrowserConnection()).toEqual({
      apiUrl: "http://10.88.111.3:3001",
      token: "machine-token",
    });
  });

  it("falls back to the saved connection when runtime config is unavailable", async () => {
    saveBrowserConnection({
      apiUrl: "http://192.168.1.25:3001",
      token: "machine-token",
    });
    globalThis.fetch = async () => {
      throw new Error("offline");
    };

    const config = await createBrowserPlatform().getServerConfig();

    expect(config).toEqual({
      url: "http://192.168.1.25:3001",
      token: "machine-token",
      mode: "local",
    });
  });
});