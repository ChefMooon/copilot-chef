import { Hono } from "hono";
import { mealService } from "../services.js";

export const mealsRoutes = new Hono();

mealsRoutes.get("/meals", async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");

  if (!from || !to) {
    return c.json(
      { error: "Both from and to query parameters are required" },
      400
    );
  }

  const data = await mealService.listMealsInRange(from, to);
  return c.json({ data });
});

mealsRoutes.post("/meals", async (c) => {
  try {
    const body = await c.req.json();

    const ingredientsFromJson =
      typeof body?.ingredientsJson === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(body.ingredientsJson);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : undefined;

    const normalizedBody = {
      ...body,
      name: body?.name ?? body?.title,
      mealType: body?.mealType ?? body?.type,
      ingredients: body?.ingredients ?? ingredientsFromJson ?? [],
    };

    const data = await mealService.createMeal(normalizedBody);
    return c.json({ data }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to create meal" },
      400
    );
  }
});

mealsRoutes.patch("/meals/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = await mealService.updateMeal(id, body);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to update meal" },
      400
    );
  }
});

mealsRoutes.delete("/meals/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await mealService.deleteMeal(id);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to delete meal" },
      400
    );
  }
});
