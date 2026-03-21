import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const listSessionsMock = vi.fn();
const createSessionMock = vi.fn();
const getSessionMock = vi.fn();
const deleteSessionMock = vi.fn();

vi.mock("@copilot-chef/core", () => ({
  ChatHistoryService: class {
    listSessions = listSessionsMock;
    createSession = createSessionMock;
    getSession = getSessionMock;
    deleteSession = deleteSessionMock;
  },
}));

const getRouteModule = () => import("./route");
const getRouteByIdModule = () => import("./[id]/route");

describe("chat sessions API auth and ownership", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();

    listSessionsMock.mockReset();
    createSessionMock.mockReset();
    getSessionMock.mockReset();
    deleteSessionMock.mockReset();

    delete process.env.PA_MACHINE_AUTH_ENABLED;
    delete process.env.PA_MACHINE_AUTH_TOKEN;
    delete process.env.PA_MACHINE_AUTH_TOKENS;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated list requests when machine auth is enabled", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_ENABLED", "1");
    vi.stubEnv("PA_MACHINE_AUTH_TOKEN", "secret-token");

    const route = await getRouteModule();
    const response = await route.GET(new Request("http://localhost/api/chat-sessions"));

    expect(response.status).toBe(401);
    expect(listSessionsMock).not.toHaveBeenCalled();
  });

  it("scopes list sessions by caller identity from token", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "secret-token=max-pa:max-assistant");
    listSessionsMock.mockResolvedValue([{ id: "session-1" }]);

    const route = await getRouteModule();
    const response = await route.GET(
      new Request("http://localhost/api/chat-sessions", {
        headers: {
          Authorization: "Bearer secret-token",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(listSessionsMock).toHaveBeenCalledWith("max-pa");
  });

  it("returns 404 when owner cannot access requested session", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "secret-token=max-pa:max-assistant");
    getSessionMock.mockResolvedValue(null);

    const routeById = await getRouteByIdModule();
    const response = await routeById.GET(
      new NextRequest("http://localhost/api/chat-sessions/session-1", {
        headers: {
          Authorization: "Bearer secret-token",
        },
      }),
      { params: Promise.resolve({ id: "session-1" }) }
    );

    expect(response.status).toBe(404);
    expect(getSessionMock).toHaveBeenCalledWith("max-pa", "session-1");
  });

  it("returns 404 on delete when owner does not own the session", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "secret-token=max-pa:max-assistant");
    deleteSessionMock.mockResolvedValue(null);

    const routeById = await getRouteByIdModule();
    const response = await routeById.DELETE(
      new NextRequest("http://localhost/api/chat-sessions/session-1", {
        headers: {
          Authorization: "Bearer secret-token",
        },
      }),
      { params: Promise.resolve({ id: "session-1" }) }
    );

    expect(response.status).toBe(404);
    expect(deleteSessionMock).toHaveBeenCalledWith("max-pa", "session-1");
  });
});
