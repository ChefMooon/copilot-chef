import { z } from "zod";
import { CUISINE_VALUES } from "../api/constants";
import {
  RECIPE_CANONICAL_UNITS,
  normalizeRecipeUnit,
  type RecipeCanonicalUnit,
} from "../recipe-units";

const recipeOriginSchema = z.enum(["manual", "imported"]);
const recipeCuisineSchema = z.enum(CUISINE_VALUES);

function trimToNull(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const nullableTrimmedStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return trimToNull(value);
}, z.string().nullable());

const requiredTrimmedStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}, z.string().min(1));

const recipeIngredientUnitSchema = z.preprocess((value) => {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const canonical = normalizeRecipeUnit(value);
  if (canonical) {
    return canonical;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.toLowerCase();
}, z.enum(RECIPE_CANONICAL_UNITS).nullable());

const quantitySchema = z.number().finite().nonnegative();

const ratioTolerance = 0.0005;

const recipeIngredientBaseSchema = z.object({
  name: requiredTrimmedStringSchema,
  quantity: quantitySchema.nullable().optional(),
  quantityNumerator: z.number().int().nonnegative().nullable().optional(),
  quantityDenominator: z.number().int().positive().nullable().optional(),
  unit: recipeIngredientUnitSchema.optional(),
  group: nullableTrimmedStringSchema.optional(),
  notes: nullableTrimmedStringSchema.optional(),
  order: z.number().int().nonnegative().optional(),
  parseConfidence: z.enum(["high", "low"]).nullable().optional(),
  parseRaw: nullableTrimmedStringSchema.optional(),
});

function validateIngredientRational(
  ingredient: {
    quantity?: number | null;
    quantityNumerator?: number | null;
    quantityDenominator?: number | null;
  },
  ctx: z.RefinementCtx
) {
  const hasNumerator = ingredient.quantityNumerator != null;
  const hasDenominator = ingredient.quantityDenominator != null;

  if (hasNumerator !== hasDenominator) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "quantityNumerator and quantityDenominator must be provided together",
      path: [hasNumerator ? "quantityDenominator" : "quantityNumerator"],
    });
    return;
  }

  if (hasNumerator && hasDenominator && ingredient.quantity != null) {
    const ratio = ingredient.quantityNumerator! / ingredient.quantityDenominator!;
    if (Math.abs(ratio - ingredient.quantity) > ratioTolerance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "quantity does not match quantityNumerator/quantityDenominator",
        path: ["quantity"],
      });
    }
  }
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }

  return a || 1;
}

function decimalToFraction(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  const sign = rounded < 0 ? -1 : 1;
  const absValue = Math.abs(rounded);
  const denominator = 1000;
  const numerator = Math.round(absValue * denominator);
  const divisor = greatestCommonDivisor(numerator, denominator);

  return {
    quantityNumerator: sign * (numerator / divisor),
    quantityDenominator: denominator / divisor,
  };
}

function normalizeIngredientQuantity<T extends {
  quantity?: number | null;
  quantityNumerator?: number | null;
  quantityDenominator?: number | null;
}>(ingredient: T): T {
  const hasNumerator = ingredient.quantityNumerator != null;
  const hasDenominator = ingredient.quantityDenominator != null;
  if (hasNumerator && hasDenominator) {
    return ingredient;
  }

  if (ingredient.quantity == null) {
    return {
      ...ingredient,
      quantityNumerator: null,
      quantityDenominator: null,
    };
  }

  return {
    ...ingredient,
    ...decimalToFraction(ingredient.quantity),
  };
}

const recipeIngredientInputSchema = recipeIngredientBaseSchema.superRefine(
  validateIngredientRational
).transform((ingredient) => normalizeIngredientQuantity(ingredient));

const recipeIngredientExportSchema = recipeIngredientBaseSchema
  .extend({ order: z.number().int().nonnegative() })
  .superRefine(validateIngredientRational)
  .transform((ingredient) => normalizeIngredientQuantity(ingredient));

const normalizedIngredientSchema = z.object({
  name: requiredTrimmedStringSchema,
  quantity: quantitySchema.nullable(),
  quantityNumerator: z.number().int().nonnegative().nullable().optional(),
  quantityDenominator: z.number().int().positive().nullable().optional(),
  unit: recipeIngredientUnitSchema,
  notes: nullableTrimmedStringSchema,
  confidence: z.enum(["high", "low"]),
});

const recipeTagInputSchema = requiredTrimmedStringSchema;

const recipeLinkInputSchema = z.object({
  subRecipeId: requiredTrimmedStringSchema,
});

const instructionsArraySchema = z.array(requiredTrimmedStringSchema);

function normalizeInstructions(steps: string[]) {
  return steps.map((step) => step.trim()).filter(Boolean);
}

const sourceUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().url().nullable());

export const CreateRecipeInputSchema = z.object({
  title: requiredTrimmedStringSchema,
  description: nullableTrimmedStringSchema.optional(),
  servings: z.number().int().positive().optional(),
  prepTime: z.number().int().nonnegative().nullable().optional(),
  cookTime: z.number().int().nonnegative().nullable().optional(),
  difficulty: nullableTrimmedStringSchema.optional(),
  cuisine: recipeCuisineSchema.nullable().optional(),
  instructions: instructionsArraySchema.min(1).transform(normalizeInstructions),
  sourceUrl: sourceUrlSchema.optional(),
  sourceLabel: nullableTrimmedStringSchema.optional(),
  origin: recipeOriginSchema.optional(),
  favourite: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  cookNotes: nullableTrimmedStringSchema.optional(),
  ingredients: z.array(recipeIngredientInputSchema).default([]),
  ingredientLines: z.array(requiredTrimmedStringSchema).optional(),
  tags: z.array(recipeTagInputSchema).default([]),
  linkedSubRecipes: z.array(recipeLinkInputSchema).default([]),
  sourceRecipeId: requiredTrimmedStringSchema.optional(),
});

export const UpdateRecipeInputSchema = CreateRecipeInputSchema.partial();

const recipeExportItemSchema = z.object({
  id: z.string().optional(),
  title: requiredTrimmedStringSchema,
  description: nullableTrimmedStringSchema,
  servings: z.number().int().positive(),
  prepTime: z.number().int().nonnegative().nullable(),
  cookTime: z.number().int().nonnegative().nullable(),
  difficulty: nullableTrimmedStringSchema,
  cuisine: recipeCuisineSchema.nullable().optional(),
  instructions: instructionsArraySchema.transform(normalizeInstructions),
  sourceUrl: sourceUrlSchema,
  sourceLabel: nullableTrimmedStringSchema,
  origin: recipeOriginSchema,
  favourite: z.boolean(),
  rating: z.number().int().min(1).max(5).nullable(),
  cookNotes: nullableTrimmedStringSchema,
  lastMadeAt: z.string().nullable(),
  tags: z.array(recipeTagInputSchema),
  ingredients: z.array(recipeIngredientExportSchema),
});

export const RecipeExportJsonSchema = z
  .object({
    version: z.enum(["1", "2"]),
    exportedAt: z.string(),
    recipes: z.array(recipeExportItemSchema),
  })
  .transform((payload) => ({
    ...payload,
    version: "2" as const,
  }));

const recipeConflictReasonSchema = z.enum([
  "duplicate_title",
  "duplicate_source_url",
]);

export const RecipeConflictSchema = z.object({
  error: z.string(),
  code: z.enum([
    "RECIPE_DUPLICATE_TITLE",
    "RECIPE_DUPLICATE_SOURCE_URL",
  ]),
  reason: recipeConflictReasonSchema,
  existing: recipeExportItemSchema,
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

export const RecipeSaveSchema = z.object({
  title: requiredTrimmedStringSchema,
  description: nullableTrimmedStringSchema.optional(),
  servings: z.number().int().positive().optional(),
  prepTime: z.number().int().nonnegative().nullable().optional(),
  cookTime: z.number().int().nonnegative().nullable().optional(),
  difficulty: nullableTrimmedStringSchema.optional(),
  cuisine: recipeCuisineSchema.nullable().optional(),
  ingredients: z.array(recipeIngredientInputSchema).default([]),
  instructions: instructionsArraySchema.transform(normalizeInstructions).default([]),
  tags: z.array(recipeTagInputSchema).default([]),
  favourite: z.boolean().optional(),
});

export type RecipeIngredientUnit = RecipeCanonicalUnit;

export type CreateRecipeInput = z.input<typeof CreateRecipeInputSchema>;
export type UpdateRecipeInput = z.input<typeof UpdateRecipeInputSchema>;
export type RecipeExportJson = z.infer<typeof RecipeExportJsonSchema>;
export type IngestResult = z.infer<typeof IngestResultSchema>;
export type RecipeSave = z.infer<typeof RecipeSaveSchema>;
export type RecipeConflict = z.infer<typeof RecipeConflictSchema>;
