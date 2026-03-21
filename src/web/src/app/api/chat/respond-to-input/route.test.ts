import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const resolveInputRequestMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/lib/chat-singletons", () => ({
  chef: {
    resolveInputRequest: resolveInputRequestMock,
  },
  historyService: {
    getSession: getSessionMock,
  },
}));

const getRouteModule = () => import("./route");

function buildRequest(body: Record<string, unknown>, token?: string) {
  return new NextRequest("http://localhost/api/chat/respond-to-input", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat/respond-to-input", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    resolveInputRequestMock.mockReset();
    getSessionMock.mockReset();

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
      buildRequest({
        sessionId: "copilot-1",
        chatSessionId: "chat-1",
        answer: "yes",
        wasFreeform: true,
      })
    );

    expect(response.status).toBe(401);
    expect(resolveInputRequestMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the owned chat session is missing", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "secret-token=max-pa:max-assistant");
    getSessionMock.mockResolvedValue(null);

    const route = await getRouteModule();
    const response = await route.POST(
      buildRequest(
        {
          sessionId: "copilot-1",
          chatSessionId: "chat-1",
          answer: "yes",
          wasFreeform: true,
        },
        "secret-token"
      )
    );

    expect(response.status).toBe(404);
    expect(getSessionMock).toHaveBeenCalledWith("max-pa", "chat-1");
    expect(resolveInputRequestMock).not.toHaveBeenCalled();
  });

  it("returns 404 when chat session maps to a different copilot session", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "secret-token=max-pa:max-assistant");
    getSessionMock.mockResolvedValue({
      id: "chat-1",
      copilotSessionId: "copilot-other",
    });

    const route = await getRouteModule();
    const response = await route.POST(
      buildRequest(
        {
          sessionId: "copilot-1",
          chatSessionId: "chat-1",
          answer: "yes",
          wasFreeform: true,
        },
        "secret-token"
      )
    );

    expect(response.status).toBe(404);
    expect(resolveInputRequestMock).not.toHaveBeenCalled();
  });

  it("resolves input when caller owns the mapped chat session", async () => {
    vi.stubEnv("PA_MACHINE_AUTH_TOKENS", "secret-token=max-pa:max-assistant");
    getSessionMock.mockResolvedValue({
      id: "chat-1",
      copilotSessionId: "copilot-1",
    });

    const route = await getRouteModule();
    const response = await route.POST(
      buildRequest(
        {
          sessionId: "copilot-1",
          chatSessionId: "chat-1",
          answer: "yes",
          wasFreeform: true,
        },
        "secret-token"
      )
    );

    expect(response.status).toBe(200);
    expect(resolveInputRequestMock).toHaveBeenCalledWith("copilot-1", "yes", true);
  });
});
