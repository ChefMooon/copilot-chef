import { bootstrapDatabase } from "../lib/bootstrap";
import { classifyCuisine } from "../lib/cuisine-classifier";
import { addDays, formatDayKey, startOfDay, startOfWeek } from "../lib/date";
import { prisma } from "../lib/prisma";
import { getCuisineLabel } from "@shared/api/constants";
import type {
  MealIngredient,
  MealPayload,
  MealTypeDefinitionPayload,
} from "@shared/types";

type LinkedRecipeRow = {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  cuisine: string | null;
  instructions: string;
  cookNotes: string | null;
  ingredients: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
    group: string | null;
    notes: string | null;
    order: number;
  }>;
};

type MealIngredientInput = MealIngredient | string;

type SlotGroupRow = {
  date: Date;
  mealType: string;
  dishCount: number;
};

function toMealIngredient(
  ingredient: MealIngredientInput,
  order: number
): MealIngredient {
  if (typeof ingredient === "string") {
    return {
      name: ingredient.trim(),
      quantity: null,
      unit: null,
      group: null,
      notes: null,
      order,
    };
  }

  return {
    name: ingredient.name.trim(),
    quantity: ingredient.quantity ?? null,
    unit: ingredient.unit ?? null,
    group: ingredient.group ?? null,
    notes: ingredient.notes ?? null,
    order: ingredient.order ?? order,
  };
}

function parseMealIngredients(value: string): MealIngredient[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry, index) => toMealIngredient(entry as MealIngredientInput, index))
      .filter((entry) => entry.name.length > 0)
      .sort((left, right) => left.order - right.order);
  } catch {
    return [];
  }
}

function stringifyMealIngredients(ingredients: MealIngredientInput[] | undefined) {
  return JSON.stringify(
    (ingredients ?? [])
      .map((entry, index) => toMealIngredient(entry, index))
      .filter((entry) => entry.name.length > 0)
  );
}

function parseInstructions(value: string | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function formatRecipeQuantity(quantity: number | null) {
  if (quantity === null) {
    return null;
  }

  return Number.isInteger(quantity) ? `${quantity}` : `${quantity}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

function getMonthStarts(weeks: Array<Array<{ date: string }>>) {
  const seen = new Set<string>();
  const monthStarts: Record<string, number> = {};

  weeks.forEach((week, index) => {
    const month = new Date(week[0].date).toLocaleString("default", {
      month: "short",
    });

    if (!seen.has(month)) {
      seen.add(month);
      monthStarts[month] = index;
    }
  });

  return monthStarts;
}

function normalizeMealType(value: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();

  if (!normalized) {
    throw new Error("Meal type is required.");
  }

  return normalized;
}

function serializeMealTypeDefinition(definition: {
  id: string;
  profileId: string;
  name: string;
  slug: string;
  color: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
} | null | undefined): MealTypeDefinitionPayload | null {
  if (!definition) {
    return null;
  }

  return {
    id: definition.id,
    profileId: definition.profileId,
    name: definition.name,
    slug: definition.slug,
    color: definition.color,
    enabled: definition.enabled,
    sortOrder: definition.sortOrder,
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
  };
}

function countStreak(counts: Map<string, number>, today: Date) {
  let streak = 0;
  let cursor = startOfDay(today);

  while (counts.get(formatDayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function toWeekKey(date: Date) {
  const year = date.getFullYear();
  const weekNum = getISOWeek(date);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

function serializeMeal(meal: {
  id: string;
  name: string;
  date: Date | null;
  mealType: string;
  sortOrder?: number;
  mealTypeDefinitionId?: string | null;
  mealTypeDefinition?: {
    id: string;
    profileId: string;
    name: string;
    slug: string;
    color: string;
    enabled: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  notes: string | null;
  ingredientsJson: string;
  description?: string | null;
  cuisine?: string | null;
  instructionsJson?: string;
  servings?: number;
  prepTime?: number | null;
  cookTime?: number | null;
  servingsOverride?: number | null;
  recipeId?: string | null;
  recipe?: LinkedRecipeRow | null;
}): MealPayload {
  const serializedDate = meal.date
    ? new Date(
        Date.UTC(
          meal.date.getUTCFullYear(),
          meal.date.getUTCMonth(),
          meal.date.getUTCDate(),
          12,
          0,
          0,
          0
        )
      ).toISOString()
    : null;

  const linkedRecipe = meal.recipe
    ? {
        id: meal.recipe.id,
        title: meal.recipe.title,
        description: meal.recipe.description,
        servings: meal.recipe.servings,
        prepTime: meal.recipe.prepTime,
        cookTime: meal.recipe.cookTime,
        cuisine: meal.recipe.cuisine,
        instructions: (() => {
          try {
            const parsed = JSON.parse(meal.recipe.instructions);
            return Array.isArray(parsed) ? (parsed as string[]) : [];
          } catch {
            return [];
          }
        })(),
        cookNotes: meal.recipe.cookNotes,
        ingredients: meal.recipe.ingredients
          .sort((a, b) => a.order - b.order)
          .map((ingredient) => ({
            name: ingredient.name,
            quantity: formatRecipeQuantity(ingredient.quantity),
            unit: ingredient.unit,
            group: ingredient.group,
            notes: ingredient.notes,
            order: ingredient.order,
          })),
      }
    : null;

  return {
    id: meal.id,
    name: meal.name,
    date: serializedDate,
    mealType: meal.mealType,
    sortOrder: meal.sortOrder ?? 0,
    mealTypeDefinitionId: meal.mealTypeDefinitionId ?? null,
    mealTypeDefinition: serializeMealTypeDefinition(meal.mealTypeDefinition),
    notes: meal.notes,
    ingredients: parseMealIngredients(meal.ingredientsJson),
    description: meal.description ?? null,
    cuisine: meal.cuisine ?? null,
    instructions: parseInstructions(meal.instructionsJson),
    servings: meal.servings ?? 2,
    prepTime: meal.prepTime ?? null,
    cookTime: meal.cookTime ?? null,
    servingsOverride: meal.servingsOverride ?? null,
    recipeId: meal.recipeId ?? null,
    linkedRecipe,
  };
}

function normalizeMealDateInput(input: string | null | undefined) {
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid meal date: ${input}`);
  }

  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      12,
      0,
      0,
      0
    )
  );
}

export class MealService {
  private mealInclude = {
    mealTypeDefinition: true,
    recipe: {
      include: {
        ingredients: { orderBy: { order: "asc" as const } },
      },
    },
  };

  private async groupBySlot(where?: Parameters<typeof prisma.meal.groupBy>[0]["where"]) {
    const groups = await prisma.meal.groupBy({
      by: ["date", "mealType"],
      where: {
        date: { not: null },
        ...(where ?? {}),
      },
      _count: { id: true },
      orderBy: [{ date: "asc" }, { mealType: "asc" }],
    });

    return groups
      .filter((group): group is typeof group & { date: Date } => group.date !== null)
      .map(
        (group) =>
          ({
            date: group.date,
            mealType: group.mealType,
            dishCount: group._count.id,
          }) satisfies SlotGroupRow
      );
  }

  private async resolveMealTypeInput(input: {
    mealType?: string;
    mealTypeDefinitionId?: string | null;
  }) {
    if (input.mealTypeDefinitionId === undefined) {
      return input.mealType === undefined
        ? {}
        : {
            mealType: normalizeMealType(input.mealType),
          };
    }

    if (input.mealTypeDefinitionId === null) {
      if (!input.mealType) {
        return {
          mealTypeDefinitionId: null,
        };
      }

      return {
        mealType: normalizeMealType(input.mealType),
        mealTypeDefinitionId: null,
      };
    }

    const definition = await prisma.mealTypeDefinition.findUnique({
      where: { id: input.mealTypeDefinitionId },
    });

    if (!definition) {
      throw new Error(`Meal type definition with id "${input.mealTypeDefinitionId}" not found.`);
    }

    return {
      mealType: definition.slug,
      mealTypeDefinitionId: definition.id,
    };
  }

  private async resolveCuisineInput(input: {
    cuisine?: string | null;
    recipeId?: string | null;
  }) {
    if (input.cuisine !== undefined) {
      return input.cuisine;
    }

    if (input.recipeId === undefined) {
      return undefined;
    }

    if (input.recipeId === null) {
      return null;
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: input.recipeId },
      select: { cuisine: true },
    });

    return recipe?.cuisine ?? null;
  }

  private async getNextSortOrder(
    tx: Omit<
      typeof prisma,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
    >,
    date: Date | null,
    mealType: string
  ) {
    if (!date) {
      return 10;
    }

    const current = await tx.meal.aggregate({
      where: { date, mealType },
      _max: { sortOrder: true },
    });

    return (current._max.sortOrder ?? 0) + 10;
  }

  async reorderSlotMeals(slotDate: string, slotMealType: string, orderedIds: string[]) {
    await bootstrapDatabase();

    if (orderedIds.length === 0) {
      throw new Error("At least one meal is required to reorder a slot.");
    }

    const normalizedDate = normalizeMealDateInput(slotDate);
    if (!normalizedDate) {
      throw new Error("Reordering requires a scheduled meal date.");
    }

    const normalizedMealType = normalizeMealType(slotMealType);

    return prisma.$transaction(async (tx) => {
      const slotMeals = await tx.meal.findMany({
        where: {
          date: normalizedDate,
          mealType: normalizedMealType,
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: this.mealInclude,
      });

      if (slotMeals.length !== orderedIds.length) {
        throw new Error("Reorder payload must include every meal in the slot exactly once.");
      }

      const slotIds = new Set(slotMeals.map((meal) => meal.id));
      const orderedIdSet = new Set(orderedIds);

      if (orderedIdSet.size !== orderedIds.length) {
        throw new Error("Reorder payload contains duplicate meal ids.");
      }

      for (const id of orderedIds) {
        if (!slotIds.has(id)) {
          throw new Error("Reorder payload contains a meal outside the target slot.");
        }
      }

      for (let index = 0; index < orderedIds.length; index += 1) {
        await tx.meal.update({
          where: { id: orderedIds[index] },
          data: { sortOrder: (index + 1) * 10 },
        });
      }

      const updatedMeals = await tx.meal.findMany({
        where: {
          date: normalizedDate,
          mealType: normalizedMealType,
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: this.mealInclude,
      });

      return updatedMeals.map(serializeMeal);
    });
  }

  async applySlotBatchAction(input: {
    action: "move" | "swap";
    sourceDate: string;
    sourceMealType: string;
    sourceMealTypeDefinitionId?: string | null;
    targetDate: string;
    targetMealType: string;
    targetMealTypeDefinitionId?: string | null;
  }) {
    await bootstrapDatabase();

    const sourceDate = normalizeMealDateInput(input.sourceDate);
    const targetDate = normalizeMealDateInput(input.targetDate);

    if (!sourceDate || !targetDate) {
      throw new Error("Slot batch actions require valid source and target dates.");
    }

    const sourceMealType = normalizeMealType(input.sourceMealType);
    const targetMealType = normalizeMealType(input.targetMealType);

    const sameSlot =
      sourceMealType === targetMealType &&
      sourceDate.getTime() === targetDate.getTime();

    if (sameSlot) {
      return {
        action: input.action,
        sourceMeals: [] as MealPayload[],
        targetMeals: [] as MealPayload[],
        movedCount: 0,
      };
    }

    return prisma.$transaction(async (tx) => {
      const sourceMeals = await tx.meal.findMany({
        where: {
          date: sourceDate,
          mealType: sourceMealType,
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: this.mealInclude,
      });

      if (sourceMeals.length === 0) {
        throw new Error("Source slot has no meals to move.");
      }

      const targetMeals = await tx.meal.findMany({
        where: {
          date: targetDate,
          mealType: targetMealType,
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: this.mealInclude,
      });

      if (input.action === "move") {
        for (let index = 0; index < sourceMeals.length; index += 1) {
          await tx.meal.update({
            where: { id: sourceMeals[index].id },
            data: {
              date: targetDate,
              mealType: targetMealType,
              mealTypeDefinitionId: input.targetMealTypeDefinitionId ?? null,
              sortOrder: (targetMeals.length + index + 1) * 10,
            },
          });
        }
      }

      if (input.action === "swap") {
        for (let index = 0; index < sourceMeals.length; index += 1) {
          await tx.meal.update({
            where: { id: sourceMeals[index].id },
            data: {
              date: targetDate,
              mealType: targetMealType,
              mealTypeDefinitionId: input.targetMealTypeDefinitionId ?? null,
              sortOrder: (index + 1) * 10,
            },
          });
        }

        for (let index = 0; index < targetMeals.length; index += 1) {
          await tx.meal.update({
            where: { id: targetMeals[index].id },
            data: {
              date: sourceDate,
              mealType: sourceMealType,
              mealTypeDefinitionId: input.sourceMealTypeDefinitionId ?? null,
              sortOrder: (index + 1) * 10,
            },
          });
        }
      }

      const nextSourceMeals = await tx.meal.findMany({
        where: {
          date: sourceDate,
          mealType: sourceMealType,
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: this.mealInclude,
      });

      const nextTargetMeals = await tx.meal.findMany({
        where: {
          date: targetDate,
          mealType: targetMealType,
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: this.mealInclude,
      });

      return {
        action: input.action,
        sourceMeals: nextSourceMeals.map(serializeMeal),
        targetMeals: nextTargetMeals.map(serializeMeal),
        movedCount: sourceMeals.length,
      };
    });
  }

  async getMeal(id: string) {
    await bootstrapDatabase();

    const meal = await prisma.meal.findUnique({
      where: { id },
      include: this.mealInclude,
    });
    return meal ? serializeMeal(meal) : null;
  }

  async listMealsInRange(from: string, to: string) {
    await bootstrapDatabase();

    const start = new Date(from);
    const end = new Date(to);

    const meals = await prisma.meal.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [{ date: "asc" }, { mealType: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      include: this.mealInclude,
    });

    return meals.map(serializeMeal);
  }

  async createMeal(input: {
    id?: string;
    name: string;
    date?: string | null;
    mealType: string;
    sortOrder?: number;
    mealTypeDefinitionId?: string | null;
    notes?: string | null;
    ingredients?: MealIngredientInput[];
    description?: string | null;
    cuisine?: string | null;
    instructions?: string[];
    servings?: number;
    prepTime?: number | null;
    cookTime?: number | null;
    servingsOverride?: number | null;
    recipeId?: string | null;
  }) {
    await bootstrapDatabase();

    const normalizedDate = normalizeMealDateInput(input.date);
    const mealTypeFields = await this.resolveMealTypeInput({
      mealType: input.mealType,
      mealTypeDefinitionId: input.mealTypeDefinitionId,
    });
    const cuisine = await this.resolveCuisineInput({
      cuisine: input.cuisine,
      recipeId: input.recipeId,
    });

    const mealType = mealTypeFields.mealType ?? normalizeMealType(input.mealType);

    const meal = await prisma.$transaction(async (tx) => {
      const sortOrder =
        input.sortOrder ??
        (await this.getNextSortOrder(tx, normalizedDate === undefined ? null : normalizedDate, mealType));

      return tx.meal.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          ...(normalizedDate === undefined ? {} : { date: normalizedDate }),
          ...mealTypeFields,
          sortOrder,
          notes: input.notes ?? null,
          ingredientsJson: stringifyMealIngredients(input.ingredients),
          description: input.description ?? null,
          cuisine: cuisine ?? null,
          instructionsJson: JSON.stringify(input.instructions ?? []),
          servings: input.servings ?? 2,
          prepTime: input.prepTime ?? null,
          cookTime: input.cookTime ?? null,
          servingsOverride: input.servingsOverride ?? null,
          ...(input.recipeId !== undefined ? { recipeId: input.recipeId } : {}),
        },
        include: this.mealInclude,
      });
    });

    return serializeMeal(meal);
  }

  async updateMeal(
    id: string,
    input: {
      name?: string;
      date?: string | null;
      mealType?: string;
      sortOrder?: number;
      mealTypeDefinitionId?: string | null;
      notes?: string | null;
      ingredients?: MealIngredientInput[];
      description?: string | null;
      cuisine?: string | null;
      instructions?: string[];
      servings?: number;
      prepTime?: number | null;
      cookTime?: number | null;
      servingsOverride?: number | null;
      recipeId?: string | null;
    }
  ) {
    await bootstrapDatabase();

    const normalizedDate = normalizeMealDateInput(input.date);
    const mealTypeFields = await this.resolveMealTypeInput({
      mealType: input.mealType,
      mealTypeDefinitionId: input.mealTypeDefinitionId,
    });
    const cuisine = await this.resolveCuisineInput({
      cuisine: input.cuisine,
      recipeId: input.recipeId,
    });

    const meal = await prisma.meal.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(normalizedDate !== undefined ? { date: normalizedDate } : {}),
        ...mealTypeFields,
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.ingredients !== undefined
          ? { ingredientsJson: stringifyMealIngredients(input.ingredients) }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(cuisine !== undefined ? { cuisine } : {}),
        ...(input.instructions !== undefined
          ? { instructionsJson: JSON.stringify(input.instructions) }
          : {}),
        ...(input.servings !== undefined ? { servings: input.servings } : {}),
        ...(input.prepTime !== undefined ? { prepTime: input.prepTime } : {}),
        ...(input.cookTime !== undefined ? { cookTime: input.cookTime } : {}),
        ...(input.servingsOverride !== undefined
          ? { servingsOverride: input.servingsOverride }
          : {}),
        ...(input.recipeId !== undefined ? { recipeId: input.recipeId } : {}),
      },
      include: this.mealInclude,
    });

    return serializeMeal(meal);
  }

  async deleteMeal(id: string) {
    await bootstrapDatabase();

    await prisma.meal.delete({ where: { id } });
    return { id };
  }

  async getTopIngredients(limit = 15) {
    await bootstrapDatabase();

    const meals = await prisma.meal.findMany({
      select: { ingredientsJson: true },
    });

    const counts = new Map<string, number>();
    for (const meal of meals) {
      const ingredients = parseMealIngredients(meal.ingredientsJson);
      for (const ingredient of ingredients) {
        const normalized = ingredient.name.toLowerCase().trim();
        if (normalized) {
          counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
        }
      }
    }

    return Array.from(counts.entries())
      .map(([ingredient, count]) => ({ ingredient, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getMealCountInRange(from: string, to: string) {
    await bootstrapDatabase();

    const start = new Date(from);
    const end = new Date(to);

    const slotGroups = await this.groupBySlot({
      date: {
        gte: start,
        lte: end,
      },
    });

    return slotGroups.length;
  }

  async listAllMeals() {
    await bootstrapDatabase();

    const meals = await prisma.meal.findMany({
      orderBy: [{ date: "asc" }, { mealType: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      include: this.mealInclude,
    });

    return meals.map(serializeMeal);
  }

  async getHeatmap(weeks = 13) {
    await bootstrapDatabase();

    const today = startOfDay(new Date());
    const start = startOfWeek(addDays(today, -(weeks * 7) + 1));

    const slotGroups = await this.groupBySlot({
      date: {
        gte: start,
        lte: today,
      },
    });

    const counts = new Map<string, number>();
    slotGroups.forEach((slot) => {
      const key = formatDayKey(slot.date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const data = Array.from({ length: weeks }, (_, weekIndex) => {
      return Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDays(start, weekIndex * 7 + dayIndex);
        const key = formatDayKey(date);
        const isFuture = date > today;

        return {
          date: key,
          meals: isFuture ? -1 : (counts.get(key) ?? 0),
          isFuture,
        };
      });
    });

    const totalSlots = Array.from(counts.values()).reduce(
      (sum, value) => sum + value,
      0
    );
    const totalDishes = slotGroups.reduce((sum, slot) => sum + slot.dishCount, 0);
    const activeDays = Array.from(counts.values()).filter(
      (value) => value > 0
    ).length;

    return {
      weeks: data,
      monthStarts: getMonthStarts(data),
      totalSlots,
      totalDishes,
      activeDays,
      streak: countStreak(counts, today),
    };
  }

  async getMealTypeBreakdown() {
    await bootstrapDatabase();

    const slotGroups = await this.groupBySlot();
    const counts = new Map<string, number>();

    slotGroups.forEach((group) => {
      counts.set(group.mealType, (counts.get(group.mealType) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([mealType, slotCount]) => ({
        mealType: mealType.toLowerCase().replace(/_/g, " "),
        slotCount,
      }));
  }

  async getCuisineBreakdown() {
    await bootstrapDatabase();

    const meals = await prisma.meal.findMany({
      select: {
        name: true,
        cuisine: true,
        recipe: {
          select: {
            cuisine: true,
          },
        },
      },
    });

    const counts = new Map<string, number>();
    for (const meal of meals) {
      const cuisine =
        getCuisineLabel(meal.cuisine) ??
        getCuisineLabel(meal.recipe?.cuisine) ??
        classifyCuisine(meal.name);
      counts.set(cuisine, (counts.get(cuisine) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([cuisine, count]) => ({ cuisine, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getWeeklyTrend(weeks = 12) {
    await bootstrapDatabase();

    const today = startOfDay(new Date());
    const start = addDays(today, -(weeks * 7));

    const slotGroups = await this.groupBySlot({
      date: { gte: start, lte: today },
    });

    const weekCounts = new Map<string, number>();
    for (const slot of slotGroups) {
      const key = toWeekKey(new Date(slot.date));
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
    }

    const result: { weekLabel: string; meals: number }[] = [];
    for (let i = 0; i < weeks; i++) {
      const weekStart = startOfWeek(addDays(today, -(weeks - 1 - i) * 7));
      const key = toWeekKey(weekStart);
      const label = weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      result.push({ weekLabel: label, meals: weekCounts.get(key) ?? 0 });
    }

    return result;
  }

  async getDayOfWeekBreakdown() {
    await bootstrapDatabase();

    const slotGroups = await this.groupBySlot();

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Array(7).fill(0) as number[];

    for (const slot of slotGroups) {
      const dayIndex = new Date(slot.date).getDay();
      counts[dayIndex]++;
    }

    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((index) => ({ day: DAY_NAMES[index], count: counts[index] }));
  }

  async getPlanningWindowStats(days = 30) {
    await bootstrapDatabase();

    const today = startOfDay(new Date());
    const start = addDays(today, -days);

    const slotGroups = await this.groupBySlot({
      date: { gte: start, lte: today },
    });

    const totalSlots = slotGroups.length;
    const totalDishes = slotGroups.reduce((sum, slot) => sum + slot.dishCount, 0);
    const activeDays = new Set(
      slotGroups.map((slot) => formatDayKey(slot.date))
    ).size;
    const multiCourseSlots = slotGroups.filter((slot) => slot.dishCount > 1).length;

    return {
      totalSlots,
      totalDishes,
      activeDays,
      avgSlotsPerActiveDay:
        activeDays > 0 ? Number((totalSlots / activeDays).toFixed(1)) : 0,
      avgDishesPerSlot:
        totalSlots > 0 ? Number((totalDishes / totalSlots).toFixed(1)) : 0,
      multiCourseRate:
        totalSlots > 0 ? Number((multiCourseSlots / totalSlots).toFixed(2)) : 0,
    };
  }

  async getTopMeals(limit = 10) {
    await bootstrapDatabase();

    const groups = await prisma.meal.groupBy({
      by: ["name"],
      _count: { _all: true },
    });

    return groups
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, limit)
      .map((group) => ({
        mealName: group.name,
        count: group._count._all,
      }));
  }
}
