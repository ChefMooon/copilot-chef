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
    dayOfWeek: number;
    mealType: string;
    notes: string | null;
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
      .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
      .map((meal) => ({
        id: meal.id,
        name: meal.name,
        dayOfWeek: meal.dayOfWeek,
        mealType: meal.mealType,
        notes: meal.notes
      }))
  };
}

export class MealPlanService {
  async listMealPlans() {
    await bootstrapDatabase();

    const mealPlans = await prisma.mealPlan.findMany({
      include: {
        meals: true
      },
      orderBy: {
        startDate: "desc"
      }
    });

    return mealPlans.map(serializeMealPlan);
  }

  async getMealPlan(id: string) {
    await bootstrapDatabase();

    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id },
      include: {
        meals: true
      }
    });

    return mealPlan ? serializeMealPlan(mealPlan) : null;
  }

  async getCurrentMealPlan() {
    await bootstrapDatabase();

    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        isCurrent: true
      },
      include: {
        meals: true
      },
      orderBy: {
        startDate: "desc"
      }
    });

    return mealPlan ? serializeMealPlan(mealPlan) : null;
  }

  async createMealPlan(input: {
    name: string;
    startDate: string;
    endDate: string;
    meals?: Array<{
      name: string;
      dayOfWeek: number;
      mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
      notes?: string;
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
            dayOfWeek: meal.dayOfWeek,
            mealType: meal.mealType,
            notes: meal.notes
          }))
        }
      },
      include: {
        meals: true
      }
    });

    return serializeMealPlan(mealPlan);
  }
}
