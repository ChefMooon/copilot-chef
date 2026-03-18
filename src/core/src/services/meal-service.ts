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
  name: string;
  date: Date | null;
  mealType: MealTypeValue;
  notes: string | null;
  ingredientsJson: string;
}) {
  return {
    id: meal.id,
    name: meal.name,
    date: meal.date?.toISOString() ?? null,
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
    name: string;
    date?: string | null;
    mealType: MealTypeValue;
    notes?: string | null;
    ingredients?: string[];
  }) {
    await bootstrapDatabase();

    const meal = await prisma.meal.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        name: input.name,
        ...(input.date === undefined
          ? {}
          : { date: input.date === null ? null : new Date(input.date) }),
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
      name?: string;
      date?: string | null;
      mealType?: MealTypeValue;
      notes?: string | null;
      ingredients?: string[];
    }
  ) {
    await bootstrapDatabase();

    const meal = await prisma.meal.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.date !== undefined
          ? { date: input.date === null ? null : new Date(input.date) }
          : {}),
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
}
