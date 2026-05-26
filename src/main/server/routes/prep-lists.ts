import { Hono } from "hono";
import { z } from "zod";

import { prepListService } from "../services.js";

export const prepListsRoutes = new Hono();

const prepItemKindSchema = z.enum(["ingredient", "task"]);
const prepSourceModeSchema = z.enum([
  "manual",
  "single-meal",
  "meal-slot",
  "day",
  "week",
  "month",
  "date-range",
  "historical",
]);
const prepGenerateSourceModeSchema = z.enum([
  "single-meal",
  "meal-slot",
  "day",
  "week",
  "month",
  "date-range",
  "historical",
]);
const prepSortModeSchema = z.enum(["manual", "name", "dish", "type", "kind", "checked"]);
const prepGroupBySchema = z.enum(["dish", "type", "prepGroup", "kind", "none"]);

const prepItemSchema = z.object({
  kind: prepItemKindSchema.optional(),
  name: z.string().trim().min(1, "Item name is required"),
  qty: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  ingredientType: z.string().nullable().optional(),
  prepGroup: z.string().nullable().optional(),
  dish: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  checked: z.boolean().optional(),
  sourceMealIds: z.array(z.string()).optional(),
  sourceRecipeIds: z.array(z.string()).optional(),
  sourceLabels: z.array(z.string()).optional(),
});

const createPrepListSchema = z.object({
  name: z.string().trim().min(1, "List name is required"),
  notes: z.string().nullable().optional(),
  date: z.string().datetime().nullable().optional(),
  fromDate: z.string().datetime().nullable().optional(),
  toDate: z.string().datetime().nullable().optional(),
  sourceMode: prepSourceModeSchema.optional(),
  sourceLabel: z.string().nullable().optional(),
  sourceMealIds: z.array(z.string()).optional(),
  sourceRecipeIds: z.array(z.string()).optional(),
  favourite: z.boolean().optional(),
  sortMode: prepSortModeSchema.optional(),
  groupBy: prepGroupBySchema.optional(),
  includeIngredients: z.boolean().optional(),
  includeTasks: z.boolean().optional(),
  includeQuantities: z.boolean().optional(),
  includeIngredientTypes: z.boolean().optional(),
  includeSourceLabels: z.boolean().optional(),
  excludePantryStaples: z.boolean().optional(),
  items: z.array(prepItemSchema).optional(),
});

const updatePrepListSchema = createPrepListSchema.partial().omit({
  items: true,
  sourceMealIds: true,
  sourceRecipeIds: true,
});

const generatePrepListSchema = z.object({
  name: z.string().trim().optional(),
  notes: z.string().nullable().optional(),
  sourceMode: prepGenerateSourceModeSchema,
  mealIds: z.array(z.string()).optional(),
  mealType: z.string().optional(),
  fromDate: z.string().datetime().nullable().optional(),
  toDate: z.string().datetime().nullable().optional(),
  date: z.string().datetime().nullable().optional(),
  favourite: z.boolean().optional(),
  sortMode: prepSortModeSchema.optional(),
  groupBy: prepGroupBySchema.optional(),
  includeIngredients: z.boolean().optional(),
  includeTasks: z.boolean().optional(),
  includeQuantities: z.boolean().optional(),
  includeIngredientTypes: z.boolean().optional(),
  includeSourceLabels: z.boolean().optional(),
  excludePantryStaples: z.boolean().optional(),
});

function zodError(error: z.ZodError, label: string) {
  return {
    error: `Invalid ${label} payload`,
    issues: error.flatten(),
  };
}

prepListsRoutes.get("/prep-lists", async (c) => {
  const currentOnly = c.req.query("current") === "1";
  const data = currentOnly
    ? await prepListService.getCurrentPrepList()
    : await prepListService.listPrepLists();
  return c.json({ data });
});

prepListsRoutes.post("/prep-lists", async (c) => {
  try {
    const body = await c.req.json();
    const data = await prepListService.createPrepList(
      createPrepListSchema.parse(body)
    );
    return c.json({ data }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(zodError(error, "prep list"), 400);
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to create prep list" },
      400
    );
  }
});

prepListsRoutes.post("/prep-lists/generate", async (c) => {
  try {
    const body = await c.req.json();
    const data = await prepListService.generatePrepList(
      generatePrepListSchema.parse(body)
    );
    return c.json({ data }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(zodError(error, "prep list generation"), 400);
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to generate prep list" },
      400
    );
  }
});

prepListsRoutes.get("/prep-lists/:id", async (c) => {
  const data = await prepListService.getPrepList(c.req.param("id"));
  if (!data) {
    return c.json({ error: "Prep list not found" }, 404);
  }
  return c.json({ data });
});

prepListsRoutes.patch("/prep-lists/:id", async (c) => {
  try {
    const body = await c.req.json();
    const data = await prepListService.updatePrepList(
      c.req.param("id"),
      updatePrepListSchema.parse(body)
    );
    return c.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(zodError(error, "prep list update"), 400);
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to update prep list" },
      400
    );
  }
});

prepListsRoutes.post("/prep-lists/:id/regenerate", async (c) => {
  try {
    const data = await prepListService.regeneratePrepList(c.req.param("id"));
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to regenerate prep list" },
      400
    );
  }
});

prepListsRoutes.delete("/prep-lists/:id", async (c) => {
  try {
    const data = await prepListService.deletePrepList(c.req.param("id"));
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to delete prep list" },
      400
    );
  }
});

prepListsRoutes.post("/prep-lists/:id/items", async (c) => {
  try {
    const body = await c.req.json();
    const data = await prepListService.createPrepItem(
      c.req.param("id"),
      prepItemSchema.parse(body)
    );
    return c.json({ data }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(zodError(error, "prep item"), 400);
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to create prep item" },
      400
    );
  }
});

prepListsRoutes.patch("/prep-lists/:id/items/:itemId", async (c) => {
  try {
    const body = await c.req.json();
    const data = await prepListService.updatePrepItem(
      c.req.param("id"),
      c.req.param("itemId"),
      prepItemSchema.partial().parse(body)
    );
    return c.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(zodError(error, "prep item update"), 400);
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to update prep item" },
      400
    );
  }
});

prepListsRoutes.delete("/prep-lists/:id/items/:itemId", async (c) => {
  try {
    const data = await prepListService.deletePrepItem(
      c.req.param("id"),
      c.req.param("itemId")
    );
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to delete prep item" },
      400
    );
  }
});

prepListsRoutes.post("/prep-lists/:id/reorder", async (c) => {
  try {
    const body = (await c.req.json()) as { itemIds?: unknown };
    if (!Array.isArray(body.itemIds)) {
      throw new Error("itemIds must be an array");
    }

    const itemIds = body.itemIds.filter(
      (itemId): itemId is string => typeof itemId === "string"
    );
    const data = await prepListService.reorderPrepItems(c.req.param("id"), itemIds);
    return c.json({ data });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to reorder prep items" },
      400
    );
  }
});