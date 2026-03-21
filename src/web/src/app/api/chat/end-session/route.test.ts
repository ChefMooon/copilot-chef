import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const endSessionMock = vi.fn();
const getSessionMock = vi.fn();
const clearCopilotSessionIdMock = vi.fn();

vi.mock("@/lib/chat-singletons", () => ({
  chef: {
    endSession: endSessionMock,
  },
  historyService: {
    getSession: getSessionMock,
    clearCopilotSessionId: clearCopilotSessionIdMock,
  },
}));

const getRouteModule = () => import("./route");

function buildRequest(body: Record<string, unknown>, token?: string) {
  return new NextRequest("http://localhost/api/chat/end-session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat/end-session", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();

    endSessionMock.mockReset();
    getSessionMock.mockReset();
    clearCopilotSessionIdMock.mockReset();

    delete process.env.PA_MACHINE_AUTH_ENABLED;
    delete process.env.PA_MACHINE_AUTH_TOKEN;
    delete process.env.PA_MACHINE_AUTH_TOKENS;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated request when machine auth is enabled", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_ENABLED", "1");
    vi.stubEnv("PA_MACHINE_AUTH_TOKEN", "secret-token");

    const route = await getRouteModule();
    const response = await route.POST(
      buildRequest({ sessionId: "copilot-1", chatSessionId: "chat-1" })
    );

    expect(response.status).toBe(401);
    expect(endSessionMock).not.toHaveBeenCalled();
  });

  it("returns 404 when owner does not own the mapped session", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "secret-token=max-pa:max-assistant");
    getSessionMock.mockResolvedValue(null);

    const route = await getRouteModule();
    const response = await route.POST(
      buildRequest(
        { sessionId: "copilot-1", chatSessionId: "chat-1" },
        "secret-token"
      )
    );

    expect(response.status).toBe(404);
    expect(endSessionMock).not.toHaveBeenCalled();
  });

  it("ends and clears session mapping when caller owns the session", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "secret-token=max-pa:max-assistant");
    getSessionMock.mockResolvedValue({
      id: "chat-1",
      copilotSessionId: "copilot-1",
    });
    endSessionMock.mockResolvedValue({
      sessionId: "copilot-1",
      endedAt: "2026-03-22T00:00:00.000Z",
    });

    const route = await getRouteModule();
    const response = await route.POST(
      buildRequest(
        { sessionId: "copilot-1", chatSessionId: "chat-1" },
        "secret-token"
      )
    );

    expect(response.status).toBe(200);
    expect(endSessionMock).toHaveBeenCalledWith("copilot-1");
    expect(clearCopilotSessionIdMock).toHaveBeenCalledWith("max-pa", "chat-1");
  });

  it("returns alreadyEnded when session mapping is already cleared", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "secret-token=max-pa:max-assistant");
    getSessionMock.mockResolvedValue({
      id: "chat-1",
      copilotSessionId: null,
    });

    const route = await getRouteModule();
    const response = await route.POST(
      buildRequest(
        { sessionId: "copilot-1", chatSessionId: "chat-1" },
        "secret-token"
      )
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { alreadyEnded?: boolean };
    expect(json.alreadyEnded).toBe(true);
    expect(endSessionMock).not.toHaveBeenCalled();
    expect(clearCopilotSessionIdMock).not.toHaveBeenCalled();
  });
});
