import { beforeEach, describe, expect, it, vi } from "vitest";

const { startServerMock, stopServerMock, startStaticWebServerMock, stopStaticWebServerMock } = vi.hoisted(() => ({
  startServerMock: vi.fn(),
  stopServerMock: vi.fn(),
  startStaticWebServerMock: vi.fn(),
  stopStaticWebServerMock: vi.fn(),
}));

vi.mock("./server/start", () => ({
  startServer: startServerMock,
  stopServer: stopServerMock,
}));

vi.mock("./server/static-web", () => ({
  startStaticWebServer: startStaticWebServerMock,
  stopStaticWebServer: stopStaticWebServerMock,
}));

import { LocalRecipeBookRuntime } from "./runtime";

describe("LocalRecipeBookRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startServerMock.mockResolvedValue({
      url: "http://127.0.0.1:3001",
      token: "token",
      port: 3001,
      bindHost: "127.0.0.1",
      advertisedHost: "127.0.0.1",
      lanEnabled: false,
      runtimeSettings: {
        lanEnabled: false,
        apiBindHost: "127.0.0.1",
        apiAdvertisedHost: "127.0.0.1",
        apiPort: 3001,
        apiUrl: "http://127.0.0.1:3001",
        webEnabled: false,
        webBindHost: "127.0.0.1",
        webAdvertisedHost: "127.0.0.1",
        webPort: 4173,
        webUrl: "http://127.0.0.1:4173",
        allowedOrigins: ["http://localhost:5173", "app://localhost", "null"],
        candidates: [],
      },
    });
    stopServerMock.mockResolvedValue(undefined);
    startStaticWebServerMock.mockResolvedValue({
      running: true,
      url: "http://127.0.0.1:4173",
      port: 4173,
      bindHost: "127.0.0.1",
      advertisedHost: "127.0.0.1",
    });
    stopStaticWebServerMock.mockResolvedValue(undefined);
  });

  it("serializes start requests and reports running status", async () => {
    const runtime = new LocalRecipeBookRuntime();

    const first = runtime.start();
    const second = runtime.start();

    await expect(first).resolves.toMatchObject({ status: "running" });
    await expect(second).resolves.toMatchObject({ status: "running" });
    expect(startServerMock).toHaveBeenCalledTimes(1);
    expect(runtime.getStatus()).toBe("running");
  });

  it("stops idempotently and prevents duplicate cleanup calls", async () => {
    const runtime = new LocalRecipeBookRuntime();
    await runtime.start();

    await runtime.stop();
    await runtime.stop();

    expect(stopServerMock).toHaveBeenCalledTimes(1);
    expect(stopStaticWebServerMock).toHaveBeenCalledTimes(1);
    expect(runtime.getStatus()).toBe("stopped");
  });

  it("cleans up a started API server when static web startup fails", async () => {
    const runtime = new LocalRecipeBookRuntime();
    startStaticWebServerMock.mockRejectedValueOnce(new Error("web startup failed"));

    await expect(runtime.start()).rejects.toThrow("web startup failed");

    expect(startServerMock).toHaveBeenCalledTimes(1);
    expect(stopServerMock).toHaveBeenCalledTimes(1);
    expect(stopStaticWebServerMock).toHaveBeenCalledTimes(1);
    expect(runtime.getStatus()).toBe("failed");
  });

  it("passes the resolved runtime settings to static web startup", async () => {
    const runtime = new LocalRecipeBookRuntime();
    await runtime.start();

    expect(startStaticWebServerMock).toHaveBeenCalledWith({
      runtimeSettings: {
        lanEnabled: false,
        apiBindHost: "127.0.0.1",
        apiAdvertisedHost: "127.0.0.1",
        apiPort: 3001,
        apiUrl: "http://127.0.0.1:3001",
        webEnabled: false,
        webBindHost: "127.0.0.1",
        webAdvertisedHost: "127.0.0.1",
        webPort: 4173,
        webUrl: "http://127.0.0.1:4173",
        allowedOrigins: ["http://localhost:5173", "app://localhost", "null"],
        candidates: [],
      },
    });
  });

  it("reuses the same shutdown gate across repeated quit requests", async () => {
    const runtime = new LocalRecipeBookRuntime();
    await runtime.start();

    const first = runtime.requestQuit();
    const second = runtime.requestQuit();

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    expect(stopServerMock).toHaveBeenCalledTimes(1);
    expect(stopStaticWebServerMock).toHaveBeenCalledTimes(1);
  });
});
