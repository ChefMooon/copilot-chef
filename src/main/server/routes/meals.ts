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

  const meals = await mealService.listUpcomingMeals(
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

mealsRoutes.get("/meals/unscheduled", async (c) => {
  const data = await mealService.listUnscheduledMeals();
  return c.json({ data });
});

mealsRoutes.get("/meals/:id/photo", async (c) => {
  try {
    const id = c.req.param("id");
    const photo = await mealService.getMealPhoto(id);

    if (!photo) {
      return c.json({ error: "Meal photo not found" }, 404);
    }

    c.header("Content-Type", photo.contentType);
    c.header("Cache-Control", "private, max-age=60");
    c.header("Last-Modified", photo.updatedAt.toUTCString());

    return c.body(photo.data);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to fetch meal photo" },
      400
    );
  }
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
      sortOrder: typeof body?.sortOrder === "number" ? body.sortOrder : undefined,
      mealTypeDefinitionId:
        typeof body?.mealTypeDefinitionId === "string" ||
        body?.mealTypeDefinitionId === null
          ? body.mealTypeDefinitionId
          : undefined,
      mealSubTypeDefinitionId:
        typeof body?.mealSubTypeDefinitionId === "string" ||
        body?.mealSubTypeDefinitionId === null
          ? body.mealSubTypeDefinitionId
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
      photoDataUrl:
        typeof body?.photoDataUrl === "string"
          ? body.photoDataUrl
          : body?.photoDataUrl === null
            ? null
            : undefined,
      photoFileName:
        typeof body?.photoFileName === "string"
          ? body.photoFileName
          : body?.photoFileName === null
            ? null
            : undefined,
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

mealsRoutes.patch("/meals/unscheduled/reorder", async (c) => {
  try {
    const body = await c.req.json();

    if (!Array.isArray(body?.orderedIds)) {
      return c.json({ error: "orderedIds are required" }, 400);
    }

    const data = await mealService.reorderUnscheduledMeals(body.orderedIds);

    return c.json({ data: { updated: data.length, meals: data } });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to reorder meal bank" },
      400
    );
  }
});

mealsRoutes.patch("/meals/reorder", async (c) => {
  try {
    const body = await c.req.json();

    if (
      typeof body?.date !== "string" ||
      typeof body?.mealType !== "string" ||
      !Array.isArray(body?.orderedIds)
    ) {
      return c.json(
        { error: "date, mealType, and orderedIds are required" },
        400
      );
    }

    const data = await mealService.reorderSlotMeals(
      body.date,
      body.mealType,
      body.orderedIds
    );

    return c.json({ data: { updated: data.length, meals: data } });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to reorder meals" },
      400
    );
  }
});

mealsRoutes.patch("/meals/slot-batch", async (c) => {
  try {
    const body = await c.req.json();

    const action = body?.action;
    const source = body?.source;
    const target = body?.target;

    if (
      (action !== "move" && action !== "swap") ||
      typeof source?.date !== "string" ||
      typeof source?.mealType !== "string" ||
      typeof target?.date !== "string" ||
      typeof target?.mealType !== "string"
    ) {
      return c.json(
        {
          error:
            "action, source.date, source.mealType, target.date, and target.mealType are required",
        },
        400
      );
    }

    const data = await mealService.applySlotBatchAction({
      action,
      sourceDate: source.date,
      sourceMealType: source.mealType,
      sourceMealTypeDefinitionId:
        typeof source?.mealTypeDefinitionId === "string" ||
        source?.mealTypeDefinitionId === null
          ? source.mealTypeDefinitionId
          : undefined,
      targetDate: target.date,
      targetMealType: target.mealType,
      targetMealTypeDefinitionId:
        typeof target?.mealTypeDefinitionId === "string" ||
        target?.mealTypeDefinitionId === null
          ? target.mealTypeDefinitionId
          : undefined,
    });

    return c.json({
      data: {
        action: data.action,
        sourceCount: data.sourceMeals.length,
        targetCount: data.targetMeals.length,
        movedCount: data.movedCount,
      },
    });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to process slot batch action",
      },
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
      sortOrder: typeof body?.sortOrder === "number" ? body.sortOrder : undefined,
      mealTypeDefinitionId:
        typeof body?.mealTypeDefinitionId === "string" ||
        body?.mealTypeDefinitionId === null
          ? body.mealTypeDefinitionId
          : undefined,
      mealSubTypeDefinitionId:
        typeof body?.mealSubTypeDefinitionId === "string" ||
        body?.mealSubTypeDefinitionId === null
          ? body.mealSubTypeDefinitionId
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
      photoDataUrl:
        typeof body?.photoDataUrl === "string"
          ? body.photoDataUrl
          : body?.photoDataUrl === null
            ? null
            : undefined,
      photoFileName:
        typeof body?.photoFileName === "string"
          ? body.photoFileName
          : body?.photoFileName === null
            ? null
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
