import { Hono } from "hono";
import type {
  CreateMealTypeDefinitionInput,
  CreateMealTypeProfileInput,
  UpdateMealTypeDefinitionInput,
  UpdateMealTypeProfileInput,
} from "@shared/types";

import { mealTypeService } from "../services";

export const mealTypesRoutes = new Hono();

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : value === null ? null : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

mealTypesRoutes.get("/meal-types/active", async (c) => {
  try {
    const date = c.req.query("date") ?? new Date().toISOString();
    const data = await mealTypeService.getActiveProfile(date);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to resolve meal types" },
      400
    );
  }
});

mealTypesRoutes.get("/meal-types/profiles", async (c) => {
  const data = await mealTypeService.listProfiles();
  return c.json({ data });
});

mealTypesRoutes.post("/meal-types/profiles", async (c) => {
  try {
    const body = (await c.req.json()) as CreateMealTypeProfileInput;
    const data = await mealTypeService.createProfile({
      name: asString(body?.name) ?? "",
      color: asString(body?.color) ?? "",
      description: asNullableString(body?.description),
      priority: asNumber(body?.priority),
      startDate: asNullableString(body?.startDate),
      endDate: asNullableString(body?.endDate),
    });
    return c.json({ data }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to create meal type profile" },
      400
    );
  }
});

mealTypesRoutes.get("/meal-types/profiles/:id", async (c) => {
  const data = await mealTypeService.getProfile(c.req.param("id"));
  if (!data) {
    return c.json({ error: "Meal type profile not found" }, 404);
  }
  return c.json({ data });
});

mealTypesRoutes.patch("/meal-types/profiles/:id", async (c) => {
  try {
    const body = (await c.req.json()) as UpdateMealTypeProfileInput;
    const data = await mealTypeService.updateProfile(c.req.param("id"), {
      ...(body?.name !== undefined ? { name: asString(body.name) ?? "" } : {}),
      ...(body?.color !== undefined ? { color: asString(body.color) ?? "" } : {}),
      ...(body?.description !== undefined
        ? { description: asNullableString(body.description) }
        : {}),
      ...(body?.priority !== undefined ? { priority: asNumber(body.priority) ?? 0 } : {}),
      ...(body?.startDate !== undefined
        ? { startDate: asNullableString(body.startDate) }
        : {}),
      ...(body?.endDate !== undefined ? { endDate: asNullableString(body.endDate) } : {}),
    });
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to update meal type profile" },
      400
    );
  }
});

mealTypesRoutes.delete("/meal-types/profiles/:id", async (c) => {
  try {
    const data = await mealTypeService.deleteProfile(c.req.param("id"));
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to delete meal type profile" },
      400
    );
  }
});

mealTypesRoutes.post("/meal-types/profiles/:id/duplicate", async (c) => {
  try {
    const data = await mealTypeService.duplicateProfile(c.req.param("id"));
    return c.json({ data }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to duplicate meal type profile" },
      400
    );
  }
});

mealTypesRoutes.post("/meal-types/profiles/:id/definitions", async (c) => {
  try {
    const body = (await c.req.json()) as CreateMealTypeDefinitionInput;
    const data = await mealTypeService.createDefinition(c.req.param("id"), {
      name: asString(body?.name) ?? "",
      color: asString(body?.color) ?? "",
      enabled: asBoolean(body?.enabled),
    });
    return c.json({ data }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to create meal type" },
      400
    );
  }
});

mealTypesRoutes.patch("/meal-types/profiles/:profileId/definitions/:definitionId", async (c) => {
  try {
    const body = (await c.req.json()) as UpdateMealTypeDefinitionInput;
    const data = await mealTypeService.updateDefinition(
      c.req.param("profileId"),
      c.req.param("definitionId"),
      {
        ...(body?.name !== undefined ? { name: asString(body.name) ?? "" } : {}),
        ...(body?.color !== undefined ? { color: asString(body.color) ?? "" } : {}),
        ...(body?.enabled !== undefined ? { enabled: asBoolean(body.enabled) ?? false } : {}),
      }
    );
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to update meal type" },
      400
    );
  }
});

mealTypesRoutes.delete("/meal-types/profiles/:profileId/definitions/:definitionId", async (c) => {
  try {
    const data = await mealTypeService.deleteDefinition(
      c.req.param("profileId"),
      c.req.param("definitionId")
    );
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to delete meal type" },
      400
    );
  }
});

mealTypesRoutes.put("/meal-types/profiles/:id/definitions/order", async (c) => {
  try {
    const body = (await c.req.json()) as { orderedIds?: unknown };
    const orderedIds = Array.isArray(body?.orderedIds)
      ? body.orderedIds.filter((value): value is string => typeof value === "string")
      : [];
    const data = await mealTypeService.reorderDefinitions(c.req.param("id"), orderedIds);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to reorder meal types" },
      400
    );
  }
});