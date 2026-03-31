import { Hono } from "hono";
import { personaService } from "../services.js";

export const personasRoutes = new Hono();

personasRoutes.get("/personas", async (c) => {
  const data = await personaService.list();
  return c.json({ data });
});

personasRoutes.post("/personas", async (c) => {
  try {
    const body = await c.req.json();
    const data = await personaService.create(body);
    return c.json({ data }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to create persona" },
      400
    );
  }
});

personasRoutes.patch("/personas/:id", async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const data = await personaService.update(id, body);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to update persona" },
      400
    );
  }
});

personasRoutes.delete("/personas/:id", async (c) => {
  try {
    const { id } = c.req.param();
    const data = await personaService.delete(id);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to delete persona" },
      400
    );
  }
});
