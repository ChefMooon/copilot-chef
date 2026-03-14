import { bootstrapDatabase } from "../lib/bootstrap";
import { prisma } from "../lib/prisma";

type MealTypeValue =
  | "BREAKFAST"
  | "MORNING_SNACK"
  | "LUNCH"
  | "AFTERNOON_SNACK"
  | "DINNER"
  | "SNACK";

function serializeMeal(meal: {
  id: string;
  mealPlanId: string | null;
  name: string;
  date: Date;
  mealType: MealTypeValue;
  notes: string | null;
  ingredientsJson: string;
}) {
  return {
    id: meal.id,
    mealPlanId: meal.mealPlanId,
    name: meal.name,
    date: meal.date.toISOString(),
    mealType: meal.mealType,
    notes: meal.notes,
    ingredients: JSON.parse(meal.ingredientsJson) as string[],
  };
}

export class MealService {
  async getMeal(id: string) {
    await bootstrapDatabase();

    const meal = await prisma.meal.findUnique({ where: { id } });
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
    });

    return meals.map(serializeMeal);
  }

  async createMeal(input: {
    id?: string;
    mealPlanId?: string | null;
    name: string;
    date: string;
    mealType: MealTypeValue;
    notes?: string | null;
    ingredients?: string[];
  }) {
    await bootstrapDatabase();

    const meal = await prisma.meal.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        mealPlanId: input.mealPlanId ?? null,
        name: input.name,
        date: new Date(input.date),
        mealType: input.mealType,
        notes: input.notes ?? null,
        ingredientsJson: JSON.stringify(input.ingredients ?? []),
      },
    });

    return serializeMeal(meal);
  }

  async updateMeal(
    id: string,
    input: {
      mealPlanId?: string | null;
      name?: string;
      date?: string;
      mealType?: MealTypeValue;
      notes?: string | null;
      ingredients?: string[];
    }
  ) {
    await bootstrapDatabase();

    const meal = await prisma.meal.update({
      where: { id },
      data: {
        ...(input.mealPlanId !== undefined
          ? { mealPlanId: input.mealPlanId }
          : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
        ...(input.mealType !== undefined ? { mealType: input.mealType } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.ingredients !== undefined
          ? { ingredientsJson: JSON.stringify(input.ingredients) }
          : {}),
      },
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
      const ingredients = JSON.parse(meal.ingredientsJson) as string[];
      for (const ingredient of ingredients) {
        const normalized = ingredient.toLowerCase().trim();
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
}
