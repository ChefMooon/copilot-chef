import { bootstrapDatabase } from "../lib/bootstrap";
import { classifyCuisine } from "../lib/cuisine-classifier";
import { addDays, formatDayKey, startOfDay, startOfWeek } from "../lib/date";
import { prisma } from "../lib/prisma";
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

function serializeMeal(meal: {
  id: string;
  name: string;
  date: Date | null;
  mealType: string;
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
    mealTypeDefinitionId: meal.mealTypeDefinitionId ?? null,
    mealTypeDefinition: serializeMealTypeDefinition(meal.mealTypeDefinition),
    notes: meal.notes,
    ingredients: parseMealIngredients(meal.ingredientsJson),
    description: meal.description ?? null,
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
      orderBy: [{ date: "asc" }, { mealType: "asc" }],
      include: this.mealInclude,
    });

    return meals.map(serializeMeal);
  }

  async createMeal(input: {
    id?: string;
    name: string;
    date?: string | null;
    mealType: string;
    mealTypeDefinitionId?: string | null;
    notes?: string | null;
    ingredients?: MealIngredientInput[];
    description?: string | null;
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

    const meal = await prisma.meal.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        name: input.name,
        ...(normalizedDate === undefined ? {} : { date: normalizedDate }),
        ...mealTypeFields,
        notes: input.notes ?? null,
        ingredientsJson: stringifyMealIngredients(input.ingredients),
        description: input.description ?? null,
        instructionsJson: JSON.stringify(input.instructions ?? []),
        servings: input.servings ?? 2,
        prepTime: input.prepTime ?? null,
        cookTime: input.cookTime ?? null,
        servingsOverride: input.servingsOverride ?? null,
        ...(input.recipeId !== undefined ? { recipeId: input.recipeId } : {}),
      },
      include: this.mealInclude,
    });

    return serializeMeal(meal);
  }

  async updateMeal(
    id: string,
    input: {
      name?: string;
      date?: string | null;
      mealType?: string;
      mealTypeDefinitionId?: string | null;
      notes?: string | null;
      ingredients?: MealIngredientInput[];
      description?: string | null;
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

    const meal = await prisma.meal.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(normalizedDate !== undefined ? { date: normalizedDate } : {}),
        ...mealTypeFields,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.ingredients !== undefined
          ? { ingredientsJson: stringifyMealIngredients(input.ingredients) }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
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

    return prisma.meal.count({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
    });
  }

  async listAllMeals() {
    await bootstrapDatabase();

    const meals = await prisma.meal.findMany({
      orderBy: [{ date: "asc" }, { mealType: "asc" }],
      include: this.mealInclude,
    });

    return meals.map(serializeMeal);
  }

  async getHeatmap(weeks = 13) {
    await bootstrapDatabase();

    const today = startOfDay(new Date());
    const start = startOfWeek(addDays(today, -(weeks * 7) + 1));

    const meals = await prisma.meal.findMany({
      where: {
        date: {
          gte: start,
          lte: today,
        },
      },
      select: {
        date: true,
      },
    });

    const counts = new Map<string, number>();
    meals.forEach((meal) => {
      if (!meal.date) {
        return;
      }

      const key = formatDayKey(meal.date);
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

    const totalMeals = Array.from(counts.values()).reduce(
      (sum, value) => sum + value,
      0
    );
    const activeDays = Array.from(counts.values()).filter(
      (value) => value > 0
    ).length;

    return {
      weeks: data,
      monthStarts: getMonthStarts(data),
      totalMeals,
      activeDays,
      streak: countStreak(counts, today),
    };
  }

  async getMealTypeBreakdown() {
    await bootstrapDatabase();

    const groups = await prisma.meal.groupBy({
      by: ["mealType"],
      _count: { _all: true },
    });

    return groups
      .sort((a, b) => b._count._all - a._count._all)
      .map((group) => ({
        mealType: group.mealType.toLowerCase().replace(/_/g, " "),
        count: group._count._all,
      }));
  }

  async getCuisineBreakdown() {
    await bootstrapDatabase();

    const meals = await prisma.meal.findMany({
      select: { name: true },
    });

    const counts = new Map<string, number>();
    for (const meal of meals) {
      const cuisine = classifyCuisine(meal.name);
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

    const meals = await prisma.meal.findMany({
      where: { date: { gte: start, lte: today } },
      select: { date: true },
    });

    const weekCounts = new Map<string, number>();
    for (const meal of meals) {
      if (!meal.date) {
        continue;
      }

      const d = new Date(meal.date);
      const year = d.getFullYear();
      const weekNum = getISOWeek(d);
      const key = `${year}-W${String(weekNum).padStart(2, "0")}`;
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
    }

    const result: { weekLabel: string; meals: number }[] = [];
    for (let i = 0; i < weeks; i++) {
      const weekStart = startOfWeek(addDays(today, -(weeks - 1 - i) * 7));
      const year = weekStart.getFullYear();
      const weekNum = getISOWeek(weekStart);
      const key = `${year}-W${String(weekNum).padStart(2, "0")}`;
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

    const meals = await prisma.meal.findMany({
      select: { date: true },
    });

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Array(7).fill(0) as number[];

    for (const meal of meals) {
      if (!meal.date) {
        continue;
      }

      const dayIndex = new Date(meal.date).getDay();
      counts[dayIndex]++;
    }

    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((index) => ({ day: DAY_NAMES[index], count: counts[index] }));
  }

  async getPlanningWindowStats(days = 30) {
    await bootstrapDatabase();

    const today = startOfDay(new Date());
    const start = addDays(today, -days);

    const meals = await prisma.meal.findMany({
      where: { date: { gte: start, lte: today } },
      select: { date: true },
    });

    const totalMeals = meals.length;
    const activeDays = new Set(
      meals
        .filter((meal) => meal.date)
        .map((meal) => formatDayKey(meal.date as Date))
    ).size;

    return {
      totalMeals,
      activeDays,
      avgMealsPerActiveDay:
        activeDays > 0 ? Number((totalMeals / activeDays).toFixed(1)) : 0,
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
