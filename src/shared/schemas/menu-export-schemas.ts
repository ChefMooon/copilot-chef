import { z } from "zod";

export const MenuLayoutSchema = z.enum([
  "classic-grid",
  "compact-list",
  "card",
  "restaurant",
]);

export const MenuExportFormatSchema = z.enum(["html", "markdown", "csv"]);

const DateStringSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Expected a valid date string",
  });

export const MenuExportRequestSchema = z
  .object({
    from: DateStringSchema,
    to: DateStringSchema,
    layout: MenuLayoutSchema.default("classic-grid"),
    format: MenuExportFormatSchema.default("html"),
    includeEmptyDays: z
      .union([
        z.boolean(),
        z
          .enum(["true", "false"])
          .transform((value) => value === "true"),
      ])
      .default(true),
    title: z.string().trim().min(1).max(80).optional(),
  })
  .superRefine((value, context) => {
    const from = new Date(value.from);
    const to = new Date(value.to);

    if (from.getTime() > to.getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "End date must be on or after start date",
      });
      return;
    }

    const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (days > 31) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "Menu exports are limited to 31 days",
      });
    }
  });

export type MenuLayout = z.infer<typeof MenuLayoutSchema>;
export type MenuExportFormat = z.infer<typeof MenuExportFormatSchema>;
export type MenuExportRequest = z.infer<typeof MenuExportRequestSchema>;
