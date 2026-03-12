type MealTypeValue = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

import { prisma } from "./prisma";
import { addDays, startOfDay } from "./date";

const sampleMeals: Array<{
  name: string;
  dayOfWeek: number;
  mealType: MealTypeValue;
  notes: string;
}> = [
  {
    name: "Lemon Ricotta Pancakes",
    dayOfWeek: 1,
    mealType: "BREAKFAST",
    notes: "Bright start for the week with blueberry compote."
  },
  {
    name: "Green Goddess Grain Bowls",
    dayOfWeek: 1,
    mealType: "LUNCH",
    notes: "Roasted vegetables, quinoa, and herby dressing."
  },
  {
    name: "Roast Chicken with Spring Vegetables",
    dayOfWeek: 2,
    mealType: "DINNER",
    notes: "Use leftovers for Thursday lunch wraps."
  },
  {
    name: "Miso Butter Salmon",
    dayOfWeek: 3,
    mealType: "DINNER",
    notes: "Serve with jasmine rice and blistered green beans."
  },
  {
    name: "Butternut Squash Risotto",
    dayOfWeek: 4,
    mealType: "DINNER",
    notes: "Extra parmesan and sage breadcrumbs."
  },
  {
    name: "Sourdough Tartines",
    dayOfWeek: 5,
    mealType: "LUNCH",
    notes: "Whipped ricotta, herbs, and jammy tomatoes."
  },
  {
    name: "Coconut Curry Fish Stew",
    dayOfWeek: 6,
    mealType: "DINNER",
    notes: "One-pot dinner with lime and cilantro."
  },
  {
    name: "Citrus Salad Board",
    dayOfWeek: 0,
    mealType: "LUNCH",
    notes: "A lighter Sunday spread with toasted nuts."
  }
];

const sampleGroceries = [
  { name: "Whole chicken", category: "meat", checked: false },
  { name: "Butternut squash", category: "produce", checked: true },
  { name: "Arborio rice", category: "pantry", checked: false },
  { name: "Fresh thyme & rosemary", category: "produce", checked: false },
  { name: "Coconut milk", category: "pantry", checked: true },
  { name: "Sourdough starter", category: "bakery", checked: false },
  { name: "Parmesan block", category: "dairy", checked: true },
  { name: "Fish fillets", category: "seafood", checked: false }
];

const breakfastPool = [
  "Skillet granola bowls",
  "Soft scrambled eggs on toast",
  "Ricotta oats with citrus",
  "Savory mushroom crepes"
];

const lunchPool = [
  "Herbed chickpea salad",
  "Leftover roast wraps",
  "Tomato soup and toasties",
  "Warm lentil bowls"
];

const dinnerPool = [
  "Sheet-pan shawarma chicken",
  "Mushroom pasta bake",
  "Roasted cod with fennel",
  "Braised white beans",
  "Crisp gnocchi with greens"
];

function buildMealLogs(referenceDate: Date) {
  const logs: Array<{
    date: Date;
    mealType: MealTypeValue;
    mealName: string;
    cooked: boolean;
  }> = [];

  const today = startOfDay(referenceDate);
  const start = addDays(today, -364);

  for (let offset = 0; offset <= 364; offset += 1) {
    const date = addDays(start, offset);
    const signal = (offset * 37 + date.getDay() * 11) % 10;
    const mealsToday = signal < 2 ? 0 : signal < 5 ? 1 : signal < 8 ? 2 : 3;

    if (mealsToday >= 1) {
      logs.push({
        date,
        mealType: "DINNER",
        mealName: dinnerPool[offset % dinnerPool.length],
        cooked: true
      });
    }

    if (mealsToday >= 2) {
      logs.push({
        date,
        mealType: "LUNCH",
        mealName: lunchPool[offset % lunchPool.length],
        cooked: true
      });
    }

    if (mealsToday >= 3) {
      logs.push({
        date,
        mealType: "BREAKFAST",
        mealName: breakfastPool[offset % breakfastPool.length],
        cooked: true
      });
    }
  }

  return logs;
}

export async function seedDatabase() {
  const existingPlans = await prisma.mealPlan.count();
  const existingPreferences = await prisma.userPreference.count();
  const existingLogs = await prisma.mealLog.count();

  if (existingPlans > 0 || existingPreferences > 0 || existingLogs > 0) {
    return;
  }

  const today = startOfDay(new Date());
  const weekStart = addDays(today, -((today.getDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 6);

  const mealPlan = await prisma.mealPlan.create({
    data: {
      name: "Cozy Weeknight Plan",
      startDate: weekStart,
      endDate: weekEnd,
      isCurrent: true,
      meals: {
        create: sampleMeals
      }
    },
    include: {
      meals: true
    }
  });

  await prisma.groceryList.create({
    data: {
      mealPlanId: mealPlan.id,
      name: "This Week's Shop",
      items: {
        create: sampleGroceries.map((item, index) => ({
          ...item,
          sortOrder: index
        }))
      }
    }
  });

  await prisma.userPreference.create({
    data: {
      id: "default",
      dietaryRestrictions: "Pescatarian-friendly weekday rotation",
      householdSize: 3,
      cuisinePreferences: "Mediterranean,Japanese,Comfort food",
      avoidIngredients: "Peanuts",
      notes: "Prefers one-pan dinners on weeknights and a baking project on weekends."
    }
  });

  await prisma.mealLog.createMany({
    data: buildMealLogs(today)
  });
}
