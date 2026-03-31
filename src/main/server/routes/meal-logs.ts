import { Hono } from "hono";
import { mealLogService } from "../services.js";

export const mealLogsRoutes = new Hono();

mealLogsRoutes.get("/meal-logs", async (c) => {
  const { searchParams } = new URL(c.req.url);
  const weeks = Number(searchParams.get("weeks") ?? "13");
  const recent = Number(searchParams.get("recent") ?? "0");

  const data =
    recent > 0
      ? await mealLogService.listRecent(recent)
      : await mealLogService.getHeatmap(weeks);

  return c.json({ data });
});

mealLogsRoutes.post("/meal-logs", async (c) => {
  try {
    const body = await c.req.json();
    const data = await mealLogService.recordMealLog(body);
    return c.json({ data }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to record meal log" },
      400
    );
  }
});
