import { Hono } from "hono";
import { historyService } from "../services.js";
import { getCallerId } from "../middleware/auth.js";

export const chatSessionsRoutes = new Hono();

chatSessionsRoutes.get("/chat-sessions", async (c) => {
  try {
    const ownerId = getCallerId(c);
    const data = await historyService.listSessions(ownerId);
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list sessions";
    return c.json({ error: message }, 400);
  }
});

chatSessionsRoutes.post("/chat-sessions", async (c) => {
  try {
    const ownerId = getCallerId(c);
    const body = await c.req.json().catch(() => ({}));
    const data = await historyService.createSession(ownerId, body.title);
    return c.json({ data }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to create session" },
      400
    );
  }
});

chatSessionsRoutes.get("/chat-sessions/:id", async (c) => {
  try {
    const ownerId = getCallerId(c);
    const { id } = c.req.param();
    const data = await historyService.getSession(ownerId, id);
    if (!data) return c.json({ error: "Session not found" }, 404);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to get session" },
      400
    );
  }
});

chatSessionsRoutes.delete("/chat-sessions/:id", async (c) => {
  try {
    const ownerId = getCallerId(c);
    const { id } = c.req.param();
    await historyService.deleteSession(ownerId, id);
    return c.json({ data: { ok: true } });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to delete session" },
      400
    );
  }
});
