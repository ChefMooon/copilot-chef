import { Hono } from "hono";
import { z } from "zod";
import { ApiPaths } from "@shared/api/types";
import { MenuExportRequestSchema } from "@shared/schemas/menu-export-schemas";
import {
  buildMenuDocument,
  formatMenuDocument,
} from "@shared/menu-export";

import { mealService } from "../services.js";

export const menuExportRoutes = new Hono();

const CONTENT_TYPES = {
  html: "text/html; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
} as const;

const EXTENSIONS = {
  html: "html",
  markdown: "md",
  csv: "csv",
} as const;

function slugifyFilePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "menu";
}

menuExportRoutes.get(ApiPaths.menuExport.replace("/api", ""), async (c) => {
  try {
    const input = MenuExportRequestSchema.parse({
      from: c.req.query("from"),
      to: c.req.query("to"),
      layout: c.req.query("layout") ?? undefined,
      format: c.req.query("format") ?? undefined,
      includeEmptyDays: c.req.query("includeEmptyDays") ?? undefined,
      title: c.req.query("title") ?? undefined,
    });

    const meals = await mealService.listMealsInRange(input.from, input.to);
    const document = buildMenuDocument({
      meals,
      from: input.from,
      to: input.to,
      layout: input.layout,
      includeEmptyDays: input.includeEmptyDays,
      title: input.title,
    });
    const body = formatMenuDocument(document, input.format);
    const fileName = `${slugifyFilePart(document.title)}-${document.from}-to-${document.to}.${EXTENSIONS[input.format]}`;

    return c.body(body, 200, {
      "Content-Type": CONTENT_TYPES[input.format],
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message ?? "Invalid menu export request"
      : error instanceof Error
        ? error.message
        : "Unable to export menu";

    return c.json(
      {
        error: message,
        code: "MENU_EXPORT_FAILED",
      },
      400
    );
  }
});
