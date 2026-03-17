import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { prisma } from "../lib/prisma";
import { bootstrapDatabase } from "../lib/bootstrap";
import {
  convertIngredient,
  fromGrams,
  fromMl,
  getUnitCategory,
  toBaseUnit,
  type UnitMode,
} from "../lib/unit-converter";
import {
  normalizeIngredient,
  normalizeIngredients,
  type NormalizedIngredient,
} from "../lib/ingredient-normalizer";
import {
  CreateRecipeInputSchema,
  UpdateRecipeInputSchema,
  type CreateRecipeInput,
  type IngestResult,
  type RecipeExportJson,
  type UpdateRecipeInput,
} from "../schemas/recipe-schemas";

const execFileAsync = promisify(execFile);

type SerializedRecipeIngredient = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  order: number;
};

type SerializedRecipe = {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  difficulty: string | null;
  instructions: string[];
  sourceUrl: string | null;
  sourceLabel: string | null;
  origin: string;
  rating: number | null;
  cookNotes: string | null;
  lastMadeAt: string | null;
  createdAt: string;
  updatedAt: string;
  ingredients: SerializedRecipeIngredient[];
  tags: string[];
  linkedSubRecipes: Array<{ id: string; title: string }>;
};

export interface RecipeFilters {
  origin?: "manual" | "imported" | "ai_generated";
  tags?: string[];
  difficulty?: string;
  maxCookTime?: number;
  rating?: number;
}

export interface RolledUpIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  approximate: boolean;
  conversionConflict: boolean;
}

export type ImportResult = {
  imported: SerializedRecipe[];
  skipped: Array<{ title: string; reason: string }>;
};

function parseInstructions(instructions: string) {
  try {
    const parsed = JSON.parse(instructions) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function compactString(value: string | null | undefined) {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function serializeRecipe(recipe: {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  difficulty: string | null;
  instructions: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  origin: string;
  rating: number | null;
  cookNotes: string | null;
  lastMadeAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ingredients?: Array<{
    id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    notes: string | null;
    order: number;
  }>;
  tags?: Array<{ tag: string }>;
  linkedFrom?: Array<{ subRecipe: { id: string; title: string } }>;
}): SerializedRecipe {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    difficulty: recipe.difficulty,
    instructions: parseInstructions(recipe.instructions),
    sourceUrl: recipe.sourceUrl,
    sourceLabel: recipe.sourceLabel,
    origin: recipe.origin,
    rating: recipe.rating,
    cookNotes: recipe.cookNotes,
    lastMadeAt: recipe.lastMadeAt?.toISOString() ?? null,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
    ingredients: (recipe.ingredients ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        notes: ingredient.notes,
        order: ingredient.order,
      })),
    tags: (recipe.tags ?? []).map((entry) => entry.tag),
    linkedSubRecipes: (recipe.linkedFrom ?? []).map((entry) => ({
      id: entry.subRecipe.id,
      title: entry.subRecipe.title,
    })),
  };
}

function includeRecipeRelations() {
  return {
    ingredients: true,
    tags: true,
    linkedFrom: { include: { subRecipe: true } },
  } as const;
}

function normalizedRowsFromInput(input: CreateRecipeInput | UpdateRecipeInput) {
  if (input.ingredientLines && input.ingredientLines.length > 0) {
    return normalizeIngredients(input.ingredientLines).map((ingredient, index) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      notes: ingredient.notes,
      order: index,
    }));
  }

  return (input.ingredients ?? []).map((ingredient, index) => {
    const normalized = normalizeIngredient(
      [
        ingredient.quantity ?? "",
        ingredient.unit ?? "",
        ingredient.name,
        ingredient.notes ?? "",
      ]
        .join(" ")
        .trim()
    );

    return {
      name: normalized.name,
      quantity: ingredient.quantity ?? normalized.quantity,
      unit: ingredient.unit ?? normalized.unit,
      notes: ingredient.notes ?? normalized.notes,
      order: ingredient.order ?? index,
    };
  });
}

function sectionLines(markdown: string, sectionNames: string[]) {
  const lines = markdown.split(/\r?\n/);
  const headingRegex = /^#{1,6}\s+(.*)$/;
  const startIndex = lines.findIndex((line) => {
    const match = line.match(headingRegex);
    if (!match) {
      return false;
    }
    const heading = match[1].trim().toLowerCase();
    return sectionNames.some((name) => heading.includes(name));
  });

  if (startIndex < 0) {
    return [];
  }

  const output: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (headingRegex.test(line)) {
      break;
    }

    if (!line) {
      continue;
    }

    output.push(line.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, ""));
  }

  return output;
}

function lineToStringQuantity(value: number | null) {
  if (value == null) {
    return null;
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function toOrigin(value: string): "manual" | "imported" | "ai_generated" {
  if (value === "imported" || value === "ai_generated") {
    return value;
  }
  return "manual";
}

function toIngestExistingRecipe(recipe: SerializedRecipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    difficulty: recipe.difficulty,
    instructions: recipe.instructions,
    sourceUrl: recipe.sourceUrl,
    sourceLabel: recipe.sourceLabel,
    origin: toOrigin(recipe.origin),
    rating: recipe.rating,
    cookNotes: recipe.cookNotes,
    lastMadeAt: recipe.lastMadeAt,
    tags: recipe.tags,
    ingredients: recipe.ingredients,
  };
}

export class RecipeService {
  async createRecipe(data: CreateRecipeInput): Promise<SerializedRecipe> {
    await bootstrapDatabase();
    const input = CreateRecipeInputSchema.parse(data);

    const ingredients = normalizedRowsFromInput(input);
    const tags = uniqueCaseInsensitive(input.tags ?? []);

    const recipe = await prisma.$transaction(async (tx) => {
      const created = await tx.recipe.create({
        data: {
          title: input.title,
          description: compactString(input.description),
          servings: input.servings ?? 2,
          prepTime: input.prepTime ?? null,
          cookTime: input.cookTime ?? null,
          difficulty: compactString(input.difficulty),
          instructions: JSON.stringify(input.instructions),
          sourceUrl: compactString(input.sourceUrl),
          sourceLabel: compactString(input.sourceLabel),
          origin: input.origin ?? "manual",
          rating: input.rating ?? null,
          cookNotes: compactString(input.cookNotes),
          ingredients: {
            create: ingredients.map((ingredient) => ({
              name: ingredient.name,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
              notes: ingredient.notes,
              order: ingredient.order,
            })),
          },
          tags: {
            create: tags.map((tag) => ({ tag })),
          },
        },
      });

      const links = input.linkedSubRecipes ?? [];
      if (links.length > 0) {
        await tx.recipeLink.createMany({
          data: links.map((entry) => ({
            parentId: created.id,
            subRecipeId: entry.subRecipeId,
          })),
        });
      }

      return tx.recipe.findUniqueOrThrow({
        where: { id: created.id },
        include: includeRecipeRelations(),
      });
    });

    return serializeRecipe(recipe);
  }

  async updateRecipe(id: string, data: UpdateRecipeInput): Promise<SerializedRecipe> {
    await bootstrapDatabase();
    const input = UpdateRecipeInputSchema.parse(data);

    const updateData: Parameters<typeof prisma.recipe.update>[0]["data"] = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) {
      updateData.description = compactString(input.description);
    }
    if (input.servings !== undefined) updateData.servings = input.servings;
    if (input.prepTime !== undefined) updateData.prepTime = input.prepTime;
    if (input.cookTime !== undefined) updateData.cookTime = input.cookTime;
    if (input.difficulty !== undefined) {
      updateData.difficulty = compactString(input.difficulty);
    }
    if (input.instructions !== undefined) {
      updateData.instructions = JSON.stringify(input.instructions);
    }
    if (input.sourceUrl !== undefined) {
      updateData.sourceUrl = compactString(input.sourceUrl);
    }
    if (input.sourceLabel !== undefined) {
      updateData.sourceLabel = compactString(input.sourceLabel);
    }
    if (input.origin !== undefined) updateData.origin = input.origin;
    if (input.rating !== undefined) updateData.rating = input.rating;
    if (input.cookNotes !== undefined) {
      updateData.cookNotes = compactString(input.cookNotes);
    }

    const recipe = await prisma.$transaction(async (tx) => {
      await tx.recipe.update({ where: { id }, data: updateData });

      if (input.ingredients !== undefined || input.ingredientLines !== undefined) {
        const ingredients = normalizedRowsFromInput(input);
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        if (ingredients.length > 0) {
          await tx.recipeIngredient.createMany({
            data: ingredients.map((ingredient) => ({
              recipeId: id,
              name: ingredient.name,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
              notes: ingredient.notes,
              order: ingredient.order,
            })),
          });
        }
      }

      if (input.tags !== undefined) {
        const tags = uniqueCaseInsensitive(input.tags);
        await tx.recipeTag.deleteMany({ where: { recipeId: id } });
        if (tags.length > 0) {
          await tx.recipeTag.createMany({
            data: tags.map((tag) => ({ recipeId: id, tag })),
          });
        }
      }

      if (input.linkedSubRecipes !== undefined) {
        await tx.recipeLink.deleteMany({ where: { parentId: id } });
        if (input.linkedSubRecipes.length > 0) {
          await tx.recipeLink.createMany({
            data: input.linkedSubRecipes.map((entry) => ({
              parentId: id,
              subRecipeId: entry.subRecipeId,
            })),
          });
        }
      }

      return tx.recipe.findUniqueOrThrow({
        where: { id },
        include: {
          ...includeRecipeRelations(),
        },
      });
    });

    return serializeRecipe(recipe);
  }

  async deleteRecipe(id: string): Promise<void> {
    await bootstrapDatabase();

    const linkedParents = await prisma.recipeLink.findMany({
      where: { subRecipeId: id },
      include: { parent: { select: { title: true } } },
    });

    if (linkedParents.length > 0) {
      const parentTitles = linkedParents.map((entry) => entry.parent.title).join(", ");
      throw new Error(
        `Cannot delete recipe because it is used as a sub-recipe in: ${parentTitles}`
      );
    }

    await prisma.recipe.delete({ where: { id } });
  }

  async getRecipe(id: string): Promise<SerializedRecipe | null> {
    await bootstrapDatabase();

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ...includeRecipeRelations(),
      },
    });

    return recipe ? serializeRecipe(recipe) : null;
  }

  async listRecipes(filters?: RecipeFilters): Promise<SerializedRecipe[]> {
    await bootstrapDatabase();

    const where: Record<string, unknown> = {};
    if (filters?.origin) where.origin = filters.origin;
    if (filters?.difficulty) where.difficulty = filters.difficulty;
    if (filters?.maxCookTime !== undefined) {
      where.cookTime = { lte: filters.maxCookTime };
    }
    if (filters?.rating !== undefined) {
      where.rating = { gte: filters.rating };
    }
    if (filters?.tags && filters.tags.length > 0) {
      where.AND = filters.tags.map((tag) => ({
        tags: {
          some: {
            tag: { equals: tag },
          },
        },
      }));
    }

    const recipes = await prisma.recipe.findMany({
      where,
      include: {
        ...includeRecipeRelations(),
      },
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    });

    return recipes.map(serializeRecipe);
  }

  async searchRecipes(query: string): Promise<SerializedRecipe[]> {
    await bootstrapDatabase();
    const q = query.trim();
    if (!q) {
      return this.listRecipes();
    }

    const [titleMatches, metaMatches, ingredientMatches, tagMatches] =
      await Promise.all([
        prisma.recipe.findMany({
          where: { title: { contains: q } },
          include: includeRecipeRelations(),
        }),
        prisma.recipe.findMany({
          where: {
            OR: [
              { description: { contains: q } },
              { cookNotes: { contains: q } },
              { instructions: { contains: q } },
            ],
          },
          include: includeRecipeRelations(),
        }),
        prisma.recipe.findMany({
          where: {
            ingredients: {
              some: {
                name: { contains: q },
              },
            },
          },
          include: includeRecipeRelations(),
        }),
        prisma.recipe.findMany({
          where: {
            tags: {
              some: {
                tag: { contains: q },
              },
            },
          },
          include: includeRecipeRelations(),
        }),
      ]);

    const scoreMap = new Map<string, { score: number; recipe: SerializedRecipe }>();
    const addScored = (recipes: typeof titleMatches, score: number) => {
      for (const recipe of recipes) {
        const serialized = serializeRecipe(recipe);
        const existing = scoreMap.get(serialized.id);
        if (!existing || existing.score < score) {
          scoreMap.set(serialized.id, { score, recipe: serialized });
        }
      }
    };

    addScored(titleMatches, 4);
    addScored(ingredientMatches, 3);
    addScored(tagMatches, 2);
    addScored(metaMatches, 1);

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title))
      .map((entry) => entry.recipe);
  }

  async ingestFromUrl(url: string): Promise<IngestResult> {
    await bootstrapDatabase();

    const cleanedUrl = new URL(url).toString();
    const sourceLabel = new URL(cleanedUrl).hostname.replace(/^www\./, "");

    let markdown = "";
    let title = "";
    let description = "";

    try {
      const result = await execFileAsync(
        "npx",
        ["defuddle", "parse", cleanedUrl, "--json", "--markdown"],
        {
          timeout: 45000,
          maxBuffer: 1024 * 1024 * 8,
        }
      );
      const payload = JSON.parse(result.stdout) as {
        title?: string;
        description?: string;
        content?: string;
      };

      markdown = payload.content ?? "";
      title = payload.title ?? "Imported Recipe";
      description = payload.description ?? "";
    } catch {
      throw new Error("Unable to ingest recipe from URL");
    }

    const existingByUrl = await prisma.recipe.findFirst({
      where: { sourceUrl: cleanedUrl },
      include: {
        ...includeRecipeRelations(),
      },
    });

    if (existingByUrl) {
      return {
        duplicate: true,
        existing: toIngestExistingRecipe(serializeRecipe(existingByUrl)),
      };
    }

    const existingByTitle = await prisma.recipe.findFirst({
      where: { title: title.trim() },
      include: includeRecipeRelations(),
    });

    if (existingByTitle) {
      return {
        duplicate: true,
        existing: toIngestExistingRecipe(serializeRecipe(existingByTitle)),
      };
    }

    const ingredientLines = sectionLines(markdown, ["ingredient"]);
    const instructions = sectionLines(markdown, ["instruction", "direction", "method"]);
    const normalized = normalizeIngredients(ingredientLines);

    return {
      duplicate: false,
      recipe: {
        title: title.trim() || "Imported Recipe",
        description: compactString(description),
        servings: 2,
        prepTime: null,
        cookTime: null,
        difficulty: null,
        instructions: instructions.length > 0 ? instructions : ["Review and edit steps before saving."],
        sourceUrl: cleanedUrl,
        sourceLabel,
        origin: "imported",
        linkedSubRecipes: [],
        tags: [`source:${sourceLabel}`],
        ingredients: normalized.map((ingredient, index) => ({
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          notes: ingredient.notes,
          order: index,
        })),
      },
      flaggedIngredients: normalized.filter((ingredient) => ingredient.confidence === "low"),
    };
  }

  async duplicateRecipe(
    id: string,
    overrides?: Partial<CreateRecipeInput>
  ): Promise<SerializedRecipe> {
    const source = await this.getRecipe(id);
    if (!source) {
      throw new Error("Recipe not found");
    }

    return this.createRecipe({
      title: `${source.title} (My Version)`,
      description: source.description,
      servings: source.servings,
      prepTime: source.prepTime,
      cookTime: source.cookTime,
      difficulty: source.difficulty,
      instructions: source.instructions,
      origin: "manual",
      sourceUrl: null,
      sourceLabel: null,
      rating: source.rating,
      cookNotes: source.cookNotes,
      ingredients: source.ingredients,
      tags: source.tags,
      linkedSubRecipes: source.linkedSubRecipes.map((entry) => ({
        subRecipeId: entry.id,
      })),
      ...overrides,
    });
  }

  async getRolledUpIngredients(
    recipeId: string,
    unitMode: UnitMode = "cup"
  ): Promise<RolledUpIngredient[]> {
    await bootstrapDatabase();

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: true,
        linkedFrom: {
          include: {
            subRecipe: {
              include: {
                ingredients: true,
              },
            },
          },
        },
      },
    });

    if (!recipe) {
      throw new Error("Recipe not found");
    }

    const allIngredients = [
      ...recipe.ingredients,
      ...recipe.linkedFrom.flatMap((entry) => entry.subRecipe.ingredients),
    ];

    const categoryByName = new Map<string, Set<string>>();
    const grouped = new Map<
      string,
      {
        name: string;
        category: ReturnType<typeof getUnitCategory>;
        baseQuantity: number | null;
        baseUnit: string | null;
        notes: string[];
        approximate: boolean;
      }
    >();

    for (const ingredient of allIngredients) {
      const category = getUnitCategory(ingredient.unit);
      const base = toBaseUnit(ingredient.quantity, ingredient.unit, ingredient.name);
      const key = `${ingredient.name.trim().toLowerCase()}::${category}`;

      const categories = categoryByName.get(ingredient.name.trim().toLowerCase()) ?? new Set<string>();
      categories.add(category);
      categoryByName.set(ingredient.name.trim().toLowerCase(), categories);

      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          name: ingredient.name,
          category,
          baseQuantity: base.quantity,
          baseUnit: base.unit,
          notes: ingredient.notes ? [ingredient.notes] : [],
          approximate: base.approximate,
        });
        continue;
      }

      if (base.quantity != null && existing.baseQuantity != null) {
        existing.baseQuantity += base.quantity;
      } else if (base.quantity != null && existing.baseQuantity == null) {
        existing.baseQuantity = base.quantity;
      }

      if (ingredient.notes) {
        existing.notes.push(ingredient.notes);
      }
      existing.approximate = existing.approximate || base.approximate;
      grouped.set(key, existing);
    }

    const result: RolledUpIngredient[] = [];

    for (const entry of grouped.values()) {
      let quantity: number | null = entry.baseQuantity;
      let unit: string | null = entry.baseUnit;

      if (entry.baseQuantity != null && entry.baseUnit === "ml") {
        const converted =
          unitMode === "cup"
            ? fromMl(entry.baseQuantity)
            : convertIngredient(entry.baseQuantity, "ml", entry.name, "grams");
        quantity = converted.quantity;
        unit = converted.unit;
      } else if (entry.baseQuantity != null && entry.baseUnit === "g") {
        const converted = fromGrams(entry.baseQuantity, unitMode);
        quantity = converted.quantity;
        unit = converted.unit;
      }

      const categories = categoryByName.get(entry.name.trim().toLowerCase()) ?? new Set();
      const conversionConflict =
        categories.has("volume") && categories.has("weight");

      result.push({
        name: entry.name,
        quantity,
        unit,
        notes: uniqueCaseInsensitive(entry.notes).join("; ") || null,
        approximate: entry.approximate,
        conversionConflict,
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async addToGroceryList(recipeIds: string[], groceryListId: string): Promise<void> {
    await bootstrapDatabase();

    const pantryStaples = await prisma.userPreference.findUnique({
      where: { id: "default" },
      select: { pantryStaples: true },
    });

    const stapleSet = new Set<string>();
    if (pantryStaples?.pantryStaples) {
      try {
        const parsed = JSON.parse(pantryStaples.pantryStaples) as unknown;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === "string") {
              stapleSet.add(item.trim().toLowerCase());
            }
          }
        }
      } catch {
        // Ignore malformed pantry staples.
      }
    }

    const rolled = (
      await Promise.all(recipeIds.map((recipeId) => this.getRolledUpIngredients(recipeId)))
    ).flat();

    const deduped = new Map<string, RolledUpIngredient>();
    for (const ingredient of rolled) {
      const key = `${ingredient.name.trim().toLowerCase()}::${ingredient.unit ?? ""}`;
      if (stapleSet.has(ingredient.name.trim().toLowerCase())) {
        continue;
      }

      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, ingredient);
        continue;
      }

      if (existing.quantity != null && ingredient.quantity != null) {
        existing.quantity += ingredient.quantity;
      }
      existing.approximate = existing.approximate || ingredient.approximate;
      existing.conversionConflict =
        existing.conversionConflict || ingredient.conversionConflict;
      deduped.set(key, existing);
    }

    for (const ingredient of deduped.values()) {
      const existing = await prisma.groceryItem.findFirst({
        where: {
          groceryListId,
          name: ingredient.name,
          unit: ingredient.unit,
        },
      });

      if (!existing) {
        await prisma.groceryItem.create({
          data: {
            groceryListId,
            name: ingredient.name,
            qty: lineToStringQuantity(ingredient.quantity),
            unit: ingredient.unit,
            category: "Other",
            notes: ingredient.notes,
            checked: false,
          },
        });
        continue;
      }

      const existingQty = existing.qty ? Number.parseFloat(existing.qty) : 0;
      const incomingQty = ingredient.quantity ?? 0;
      const nextQty = Number.isFinite(existingQty)
        ? existingQty + incomingQty
        : incomingQty;

      await prisma.groceryItem.update({
        where: { id: existing.id },
        data: {
          qty: lineToStringQuantity(nextQty),
          notes: existing.notes ?? ingredient.notes,
        },
      });
    }
  }

  async generateGroceryList(recipeIds: string[], name: string) {
    await bootstrapDatabase();

    const groceryList = await prisma.groceryList.create({
      data: {
        name,
        date: new Date(),
        favourite: false,
      },
    });

    await this.addToGroceryList(recipeIds, groceryList.id);
    return groceryList;
  }

  async updateRating(id: string, rating: number, cookNotes?: string) {
    await bootstrapDatabase();
    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        rating,
        cookNotes: compactString(cookNotes),
        lastMadeAt: new Date(),
      },
      include: {
        ...includeRecipeRelations(),
      },
    });

    return serializeRecipe(recipe);
  }

  async importRecipes(json: RecipeExportJson): Promise<ImportResult> {
    await bootstrapDatabase();

    const imported: SerializedRecipe[] = [];
    const skipped: Array<{ title: string; reason: string }> = [];

    for (const recipe of json.recipes) {
      const duplicate = await prisma.recipe.findFirst({
        where: { title: recipe.title },
      });

      if (duplicate) {
        skipped.push({ title: recipe.title, reason: "duplicate_title" });
        continue;
      }

      const created = await this.createRecipe({
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        difficulty: recipe.difficulty,
        instructions: recipe.instructions,
        sourceUrl: recipe.sourceUrl,
        sourceLabel: recipe.sourceLabel,
        origin: recipe.origin,
        rating: recipe.rating,
        cookNotes: recipe.cookNotes,
        ingredients: recipe.ingredients,
        tags: recipe.tags,
        linkedSubRecipes: [],
      });

      imported.push(created);
    }

    return { imported, skipped };
  }

  async exportRecipes(ids?: string[]): Promise<RecipeExportJson> {
    await bootstrapDatabase();

    const recipes = await prisma.recipe.findMany({
      where: ids && ids.length > 0 ? { id: { in: ids } } : undefined,
      include: {
        ingredients: true,
        tags: true,
      },
      orderBy: { title: "asc" },
    });

    return {
      version: "1",
      exportedAt: new Date().toISOString(),
      recipes: recipes.map((recipe) => {
        const serialized = serializeRecipe(recipe);
        return {
          id: serialized.id,
          title: serialized.title,
          description: serialized.description,
          servings: serialized.servings,
          prepTime: serialized.prepTime,
          cookTime: serialized.cookTime,
          difficulty: serialized.difficulty,
          instructions: serialized.instructions,
          sourceUrl: serialized.sourceUrl,
          sourceLabel: serialized.sourceLabel,
          origin: serialized.origin as "manual" | "imported" | "ai_generated",
          rating: serialized.rating,
          cookNotes: serialized.cookNotes,
          lastMadeAt: serialized.lastMadeAt,
          tags: serialized.tags,
          ingredients: serialized.ingredients,
        };
      }),
    };
  }

  async formatForTelegram(id: string, viewStyle: string, unitMode: UnitMode) {
    const recipe = await this.getRecipe(id);
    if (!recipe) {
      throw new Error("Recipe not found");
    }

    const ingredients = recipe.ingredients
      .map((ingredient) => {
        const converted = convertIngredient(
          ingredient.quantity,
          ingredient.unit,
          ingredient.name,
          unitMode
        );
        const quantityPart =
          converted.quantity != null
            ? `${converted.approximate ? "~" : ""}${converted.quantity}`
            : "";
        const unitPart = converted.unit ?? "";
        const notes = ingredient.notes ? ` (${ingredient.notes})` : "";
        return `- ${[quantityPart, unitPart, ingredient.name].filter(Boolean).join(" ")}${notes}`;
      })
      .join("\n");

    const steps = recipe.instructions
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n");

    const body = `${recipe.title}\nServings: ${recipe.servings}\nView: ${viewStyle}\n\nIngredients\n${ingredients}\n\nSteps\n${steps}`;

    if (body.length <= 4096) {
      return body;
    }

    return `${body.slice(0, 4000)}\n\n[Truncated for Telegram length limit]`;
  }
}

export type { NormalizedIngredient };
