import { Hono } from "hono";
import type {
  CreateMealSubTypeDefinitionInput,
  UpdateMealSubTypeDefinitionInput,
} from "@shared/types";

import { mealSubTypeService } from "../services";

export const mealSubTypesRoutes = new Hono();

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

mealSubTypesRoutes.get("/meal-sub-types", async (c) => {
  const data = await mealSubTypeService.listDefinitions();
  return c.json({ data });
});

mealSubTypesRoutes.post("/meal-sub-types", async (c) => {
  try {
    const body = (await c.req.json()) as CreateMealSubTypeDefinitionInput;
    const data = await mealSubTypeService.createDefinition({
      name: asString(body?.name) ?? "",
      color: asString(body?.color) ?? "",
      enabled: asBoolean(body?.enabled),
    });

    return c.json({ data }, 201);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create meal sub-type",
      },
      400
    );
  }
});

mealSubTypesRoutes.patch("/meal-sub-types/:id", async (c) => {
  try {
    const body = (await c.req.json()) as UpdateMealSubTypeDefinitionInput;
    const data = await mealSubTypeService.updateDefinition(c.req.param("id"), {
      ...(body?.name !== undefined ? { name: asString(body.name) ?? "" } : {}),
      ...(body?.color !== undefined ? { color: asString(body.color) ?? "" } : {}),
      ...(body?.enabled !== undefined
        ? { enabled: asBoolean(body.enabled) ?? false }
        : {}),
    });

    return c.json({ data });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update meal sub-type",
      },
      400
    );
  }
});

mealSubTypesRoutes.delete("/meal-sub-types/:id", async (c) => {
  try {
    const data = await mealSubTypeService.deleteDefinition(c.req.param("id"));
    return c.json({ data });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to delete meal sub-type",
      },
      400
    );
  }
});

mealSubTypesRoutes.put("/meal-sub-types/order", async (c) => {
  try {
    const body = (await c.req.json()) as { orderedIds?: unknown };
    const orderedIds = Array.isArray(body?.orderedIds)
      ? body.orderedIds.filter((value): value is string => typeof value === "string")
      : [];

    const data = await mealSubTypeService.reorderDefinitions(orderedIds);
    return c.json({ data });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to reorder meal sub-types",
      },
      400
    );
  }
});
