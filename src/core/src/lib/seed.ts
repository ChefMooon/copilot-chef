type MealTypeValue =
  | "BREAKFAST"
  | "MORNING_SNACK"
  | "LUNCH"
  | "AFTERNOON_SNACK"
  | "DINNER"
  | "SNACK";

import { prisma } from "./prisma";
import { addDays, startOfDay } from "./date";

const sampleMeals: Array<{
  name: string;
  dayOffset: number;
  mealType: MealTypeValue;
  notes: string;
  ingredients: string[];
}> = [
  {
    name: "Lemon Ricotta Pancakes",
    dayOffset: 0,
    mealType: "BREAKFAST",
    notes: "Bright start for the week with blueberry compote.",
    ingredients: ["Ricotta", "Blueberries", "Flour", "Eggs"]
  },
  {
    name: "Apple & Almond Butter",
    dayOffset: 0,
    mealType: "MORNING_SNACK",
    notes: "Simple snack to bridge breakfast and lunch.",
    ingredients: ["Apple", "Almond butter"]
  },
  {
    name: "Green Goddess Grain Bowls",
    dayOffset: 0,
    mealType: "LUNCH",
    notes: "Roasted vegetables, quinoa, and herby dressing.",
    ingredients: ["Quinoa", "Cucumber", "Herbs", "Lemon"]
  },
  {
    name: "Roast Chicken with Spring Vegetables",
    dayOffset: 1,
    mealType: "DINNER",
    notes: "Use leftovers for Thursday lunch wraps.",
    ingredients: ["Chicken", "Carrots", "Potatoes", "Rosemary"]
  },
  {
    name: "Greek Yogurt",
    dayOffset: 2,
    mealType: "AFTERNOON_SNACK",
    notes: "Add honey and cinnamon.",
    ingredients: ["Greek yogurt", "Honey"]
  },
  {
    name: "Miso Butter Salmon",
    dayOffset: 2,
    mealType: "DINNER",
    notes: "Serve with jasmine rice and blistered green beans.",
    ingredients: ["Salmon", "Miso", "Butter", "Green beans"]
  },
  {
    name: "Butternut Squash Risotto",
    dayOffset: 3,
    mealType: "DINNER",
    notes: "Extra parmesan and sage breadcrumbs.",
    ingredients: ["Arborio rice", "Butternut squash", "Parmesan"]
  },
  {
    name: "Sourdough Tartines",
    dayOffset: 4,
    mealType: "LUNCH",
    notes: "Whipped ricotta, herbs, and jammy tomatoes.",
    ingredients: ["Sourdough", "Ricotta", "Tomatoes", "Basil"]
  },
  {
    name: "Coconut Curry Fish Stew",
    dayOffset: 5,
    mealType: "DINNER",
    notes: "One-pot dinner with lime and cilantro.",
    ingredients: ["White fish", "Coconut milk", "Lime", "Cilantro"]
  },
  {
    name: "Citrus Salad Board",
    dayOffset: 6,
    mealType: "LUNCH",
    notes: "A lighter Sunday spread with toasted nuts.",
    ingredients: ["Citrus", "Fennel", "Mint", "Walnuts"]
  }
];

const sampleGroceries = [
  { name: "Whole chicken", category: "Meat & Fish", checked: false, qty: "1", notes: "Free-range if available" },
  { name: "Butternut squash", category: "Produce", checked: true, qty: "2", unit: "pcs" },
  { name: "Arborio rice", category: "Pantry", checked: false, qty: "500", unit: "g" },
  { name: "Fresh thyme & rosemary", category: "Produce", checked: false, qty: "1", unit: "bunches" },
  { name: "Coconut milk", category: "Pantry", checked: true, qty: "2", unit: "cans" },
  { name: "Sourdough starter", category: "Bakery", checked: false },
  { name: "Parmesan block", category: "Dairy & Eggs", checked: true, qty: "150", unit: "g" },
  { name: "Fish fillets", category: "Meat & Fish", checked: false, qty: "2", unit: "pcs" }
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
        create: sampleMeals.map((meal) => ({
          name: meal.name,
          date: addDays(weekStart, meal.dayOffset),
          mealType: meal.mealType,
          notes: meal.notes,
          ingredientsJson: JSON.stringify(meal.ingredients)
        }))
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
      date: weekStart,
      favourite: true,
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
