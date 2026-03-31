import { Hono } from "hono";
import { historyService } from "../services.js";
import { getCallerId } from "../middleware/auth.js";

export const sessionProbeRoutes = new Hono();

sessionProbeRoutes.get("/session-probe", async (c) => {
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();

  try {
    const ownerId = getCallerId(c);
    const { searchParams } = new URL(c.req.url);
    const chatSessionId = searchParams.get("chatSessionId");

    if (!chatSessionId) {
      return c.json(
        { error: "chatSessionId query parameter is required", requestId },
        400
      );
    }

    const session = await historyService.getSession(ownerId, chatSessionId);
    if (!session) {
      return c.json({ status: "not_found", chatSessionId, requestId });
    }

    if (!session.copilotSessionId) {
      return c.json({ status: "disconnected", chatSessionId, requestId });
    }

    return c.json({
      status: "resumable",
      sessionId: session.copilotSessionId,
      chatSessionId,
      requestId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Probe failed";
    return c.json({ error: message, requestId }, 400);
  }
});
