import { Hono } from "hono";
import { mealService } from "../services.js";

export const mealsRoutes = new Hono();

function clampDays(days: number) {
  if (!Number.isFinite(days)) {
    return 7;
  }

  return Math.min(30, Math.max(1, Math.floor(days)));
}

function normalizeIngredients(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input;
}

mealsRoutes.get("/meals/heatmap", async (c) => {
  const weeks = Number(c.req.query("weeks") ?? "13");
  const data = await mealService.getHeatmap(Number.isFinite(weeks) ? weeks : 13);
  return c.json({ data });
});

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

mealsRoutes.get("/meals/upcoming", async (c) => {
  const requestedDays = Number(c.req.query("days") ?? "7");
  const days = clampDays(requestedDays);

  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setDate(to.getDate() + days - 1);
  to.setHours(23, 59, 59, 999);

  const meals = await mealService.listMealsInRange(
    from.toISOString(),
    to.toISOString()
  );

  return c.json({
    data: {
      days,
      from: from.toISOString(),
      to: to.toISOString(),
      meals,
    },
  });
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
      mealTypeDefinitionId:
        typeof body?.mealTypeDefinitionId === "string" ||
        body?.mealTypeDefinitionId === null
          ? body.mealTypeDefinitionId
          : undefined,
      ingredients: normalizeIngredients(body?.ingredients ?? ingredientsFromJson ?? []),
      cuisine:
        typeof body?.cuisine === "string"
          ? body.cuisine.trim() || null
          : body?.cuisine === null
            ? null
            : undefined,
      instructions:
        Array.isArray(body?.instructions) || body?.instructions === undefined
          ? body?.instructions
          : [],
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
    const data = await mealService.updateMeal(id, {
      ...body,
      mealTypeDefinitionId:
        typeof body?.mealTypeDefinitionId === "string" ||
        body?.mealTypeDefinitionId === null
          ? body.mealTypeDefinitionId
          : undefined,
      ingredients:
        body?.ingredients !== undefined ? normalizeIngredients(body.ingredients) : undefined,
      cuisine:
        typeof body?.cuisine === "string"
          ? body.cuisine.trim() || null
          : body?.cuisine === null
            ? null
            : undefined,
      instructions:
        Array.isArray(body?.instructions) || body?.instructions === undefined
          ? body?.instructions
          : undefined,
    });
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
