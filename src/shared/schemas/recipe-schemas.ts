import { z } from "zod";

const recipeOriginSchema = z.enum(["manual", "imported", "ai_generated"]);

const recipeIngredientInputSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  group: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  order: z.number().int().nonnegative().optional(),
});

const normalizedIngredientSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  notes: z.string().nullable(),
  confidence: z.enum(["high", "low"]),
});

const recipeTagInputSchema = z.string().min(1);

const recipeLinkInputSchema = z.object({
  subRecipeId: z.string().min(1),
});

export const CreateRecipeInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  servings: z.number().int().positive().optional(),
  prepTime: z.number().int().nonnegative().nullable().optional(),
  cookTime: z.number().int().nonnegative().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  instructions: z.array(z.string().min(1)).min(1),
  sourceUrl: z.string().url().nullable().optional(),
  sourceLabel: z.string().nullable().optional(),
  origin: recipeOriginSchema.optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  cookNotes: z.string().nullable().optional(),
  ingredients: z.array(recipeIngredientInputSchema).default([]),
  ingredientLines: z.array(z.string()).optional(),
  tags: z.array(recipeTagInputSchema).default([]),
  linkedSubRecipes: z.array(recipeLinkInputSchema).default([]),
});

export const UpdateRecipeInputSchema = CreateRecipeInputSchema.partial();

const recipeExportItemSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().nullable(),
  servings: z.number().int().positive(),
  prepTime: z.number().int().nonnegative().nullable(),
  cookTime: z.number().int().nonnegative().nullable(),
  difficulty: z.string().nullable(),
  instructions: z.array(z.string()),
  sourceUrl: z.string().nullable(),
  sourceLabel: z.string().nullable(),
  origin: recipeOriginSchema,
  rating: z.number().int().min(1).max(5).nullable(),
  cookNotes: z.string().nullable(),
  lastMadeAt: z.string().nullable(),
  tags: z.array(z.string()),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      group: z.string().nullable().optional(),
      notes: z.string().nullable(),
      order: z.number().int().nonnegative(),
    })
  ),
});

export const RecipeExportJsonSchema = z.object({
  version: z.literal("1"),
  exportedAt: z.string(),
  recipes: z.array(recipeExportItemSchema),
});

const recipeDuplicateResultSchema = z.object({
  duplicate: z.literal(true),
  existing: recipeExportItemSchema,
});

const recipeDraftResultSchema = z.object({
  duplicate: z.literal(false),
  recipe: CreateRecipeInputSchema.extend({
    sourceUrl: z.string().nullable().optional(),
    sourceLabel: z.string().nullable().optional(),
  }),
  flaggedIngredients: z.array(normalizedIngredientSchema),
});

export const IngestResultSchema = z.union([
  recipeDuplicateResultSchema,
  recipeDraftResultSchema,
]);

export const AIRecipeSaveSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  servings: z.number().int().positive().optional(),
  prepTime: z.number().int().nonnegative().nullable().optional(),
  cookTime: z.number().int().nonnegative().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().nullable().optional(),
        unit: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .default([]),
  instructions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type CreateRecipeInput = z.input<typeof CreateRecipeInputSchema>;
export type UpdateRecipeInput = z.input<typeof UpdateRecipeInputSchema>;
export type RecipeExportJson = z.infer<typeof RecipeExportJsonSchema>;
export type IngestResult = z.infer<typeof IngestResultSchema>;
export type AIRecipeSave = z.infer<typeof AIRecipeSaveSchema>;
