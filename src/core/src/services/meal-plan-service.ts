import { prisma } from "../lib/prisma";
import { bootstrapDatabase } from "../lib/bootstrap";

function serializeMealPlan(mealPlan: {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  meals: Array<{
    id: string;
    name: string;
    date: Date;
    mealType: string;
    notes: string | null;
    ingredientsJson: string;
  }>;
}) {
  return {
    id: mealPlan.id,
    name: mealPlan.name,
    startDate: mealPlan.startDate.toISOString(),
    endDate: mealPlan.endDate.toISOString(),
    isCurrent: mealPlan.isCurrent,
    totalMeals: mealPlan.meals.length,
    meals: mealPlan.meals
      .slice()
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .map((meal) => ({
        id: meal.id,
        name: meal.name,
        date: meal.date.toISOString(),
        mealType: meal.mealType,
        notes: meal.notes,
        ingredients: JSON.parse(meal.ingredientsJson) as string[],
      })),
  };
}

export class MealPlanService {
  async listMealPlans() {
    await bootstrapDatabase();

    const mealPlans = await prisma.mealPlan.findMany({
      include: {
        meals: true,
      },
      orderBy: {
        startDate: "desc",
      },
    });

    return mealPlans.map(serializeMealPlan);
  }

  async getMealPlan(id: string) {
    await bootstrapDatabase();

    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id },
      include: {
        meals: true,
      },
    });

    return mealPlan ? serializeMealPlan(mealPlan) : null;
  }

  async getCurrentMealPlan() {
    await bootstrapDatabase();

    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        isCurrent: true,
      },
      include: {
        meals: true,
      },
      orderBy: {
        startDate: "desc",
      },
    });

    return mealPlan ? serializeMealPlan(mealPlan) : null;
  }

  async createMealPlan(input: {
    name: string;
    startDate: string;
    endDate: string;
    meals?: Array<{
      name: string;
      date: string;
      mealType:
        | "BREAKFAST"
        | "MORNING_SNACK"
        | "LUNCH"
        | "AFTERNOON_SNACK"
        | "DINNER"
        | "SNACK";
      notes?: string;
      ingredients?: string[];
    }>;
  }) {
    await bootstrapDatabase();

    const mealPlan = await prisma.mealPlan.create({
      data: {
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        meals: {
          create: (input.meals ?? []).map((meal) => ({
            name: meal.name,
            date: new Date(meal.date),
            mealType: meal.mealType,
            notes: meal.notes,
            ingredientsJson: JSON.stringify(meal.ingredients ?? []),
          })),
        },
      },
      include: {
        meals: true,
      },
    });

    return serializeMealPlan(mealPlan);
  }
}
