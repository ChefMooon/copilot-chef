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
    ingredients: ["Ricotta", "Blueberries", "Flour", "Eggs"],
  },
  {
    name: "Apple & Almond Butter",
    dayOffset: 0,
    mealType: "MORNING_SNACK",
    notes: "Simple snack to bridge breakfast and lunch.",
    ingredients: ["Apple", "Almond butter"],
  },
  {
    name: "Green Goddess Grain Bowls",
    dayOffset: 0,
    mealType: "LUNCH",
    notes: "Roasted vegetables, quinoa, and herby dressing.",
    ingredients: ["Quinoa", "Cucumber", "Herbs", "Lemon"],
  },
  {
    name: "Roast Chicken with Spring Vegetables",
    dayOffset: 1,
    mealType: "DINNER",
    notes: "Use leftovers for Thursday lunch wraps.",
    ingredients: ["Chicken", "Carrots", "Potatoes", "Rosemary"],
  },
  {
    name: "Greek Yogurt",
    dayOffset: 2,
    mealType: "AFTERNOON_SNACK",
    notes: "Add honey and cinnamon.",
    ingredients: ["Greek yogurt", "Honey"],
  },
  {
    name: "Miso Butter Salmon",
    dayOffset: 2,
    mealType: "DINNER",
    notes: "Serve with jasmine rice and blistered green beans.",
    ingredients: ["Salmon", "Miso", "Butter", "Green beans"],
  },
  {
    name: "Butternut Squash Risotto",
    dayOffset: 3,
    mealType: "DINNER",
    notes: "Extra parmesan and sage breadcrumbs.",
    ingredients: ["Arborio rice", "Butternut squash", "Parmesan"],
  },
  {
    name: "Sourdough Tartines",
    dayOffset: 4,
    mealType: "LUNCH",
    notes: "Whipped ricotta, herbs, and jammy tomatoes.",
    ingredients: ["Sourdough", "Ricotta", "Tomatoes", "Basil"],
  },
  {
    name: "Coconut Curry Fish Stew",
    dayOffset: 5,
    mealType: "DINNER",
    notes: "One-pot dinner with lime and cilantro.",
    ingredients: ["White fish", "Coconut milk", "Lime", "Cilantro"],
  },
  {
    name: "Citrus Salad Board",
    dayOffset: 6,
    mealType: "LUNCH",
    notes: "A lighter Sunday spread with toasted nuts.",
    ingredients: ["Citrus", "Fennel", "Mint", "Walnuts"],
  },
];

const sampleGroceries = [
  {
    name: "Whole chicken",
    category: "Meat & Fish",
    checked: false,
    qty: "1",
    notes: "Free-range if available",
  },
  {
    name: "Butternut squash",
    category: "Produce",
    checked: true,
    qty: "2",
    unit: "pcs",
  },
  {
    name: "Arborio rice",
    category: "Pantry",
    checked: false,
    qty: "500",
    unit: "g",
  },
  {
    name: "Fresh thyme & rosemary",
    category: "Produce",
    checked: false,
    qty: "1",
    unit: "bunches",
  },
  {
    name: "Coconut milk",
    category: "Pantry",
    checked: true,
    qty: "2",
    unit: "cans",
  },
  { name: "Sourdough starter", category: "Bakery", checked: false },
  {
    name: "Parmesan block",
    category: "Dairy & Eggs",
    checked: true,
    qty: "150",
    unit: "g",
  },
  {
    name: "Fish fillets",
    category: "Meat & Fish",
    checked: false,
    qty: "2",
    unit: "pcs",
  },
];

const breakfastPool = [
  "Skillet granola bowls",
  "Soft scrambled eggs on toast",
  "Ricotta oats with citrus",
  "Savory mushroom crepes",
];

const lunchPool = [
  "Herbed chickpea salad",
  "Leftover roast wraps",
  "Tomato soup and toasties",
  "Warm lentil bowls",
];

const dinnerPool = [
  "Sheet-pan shawarma chicken",
  "Mushroom pasta bake",
  "Roasted cod with fennel",
  "Braised white beans",
  "Crisp gnocchi with greens",
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
        cooked: true,
      });
    }

    if (mealsToday >= 2) {
      logs.push({
        date,
        mealType: "LUNCH",
        mealName: lunchPool[offset % lunchPool.length],
        cooked: true,
      });
    }

    if (mealsToday >= 3) {
      logs.push({
        date,
        mealType: "BREAKFAST",
        mealName: breakfastPool[offset % breakfastPool.length],
        cooked: true,
      });
    }
  }

  return logs;
}

export async function seedDatabase() {
  const existingMeals = await prisma.meal.count();
  const existingPreferences = await prisma.userPreference.count();
  const existingLogs = await prisma.mealLog.count();
  const existingRecipes = await prisma.recipe.count();

  if (
    existingMeals > 0 ||
    existingPreferences > 0 ||
    existingLogs > 0 ||
    existingRecipes > 0
  ) {
    return;
  }

  const today = startOfDay(new Date());
  const weekStart = addDays(today, -((today.getDay() + 6) % 7));
  await prisma.meal.createMany({
    data: sampleMeals.map((meal) => ({
      name: meal.name,
      date: addDays(weekStart, meal.dayOffset),
      mealType: meal.mealType,
      notes: meal.notes,
      ingredientsJson: JSON.stringify(meal.ingredients),
    })),
  });

  await prisma.groceryList.create({
    data: {
      name: "This Week's Shop",
      date: weekStart,
      favourite: true,
      items: {
        create: sampleGroceries.map((item, index) => ({
          ...item,
          sortOrder: index,
        })),
      },
    },
  });

  await prisma.userPreference.create({
    data: {
      id: "default",
      householdSize: 3,
      cookingLength: "weeknight",
      dietaryTags: "pescatarian,gluten-free",
      favoriteCuisines: "mediterranean,japanese,comfort-food",
      avoidCuisines: "indian",
      avoidIngredients: JSON.stringify(["Peanuts", "Tree nuts"]),
      pantryStaples: JSON.stringify(["Olive oil", "Garlic", "Salt & pepper"]),
      planningNotes:
        "Prefers one-pan dinners on weeknights and a baking project on weekends.",
      nutritionTags: "high-protein,gut-health",
      skillLevel: "home-cook",
      budgetRange: "moderate",
      chefPersona: "coach",
      replyLength: "balanced",
      emojiUsage: "occasional",
      autoImproveChef: true,
      contextAwareness: true,
      seasonalAwareness: true,
      seasonalRegion: "eastern-us",
      proactiveTips: false,
      autoGenerateGrocery: true,
      consolidateIngredients: true,
      defaultPlanLength: "7",
      groceryGrouping: "category",
      defaultRecipeView: "basic",
      defaultUnitMode: "cup",
      saveChatHistory: true,
    },
  });

  const tomatoSauce = await prisma.recipe.create({
    data: {
      title: "Basic Tomato Sauce",
      description: "A simple weeknight red sauce for pasta, meatballs, or pizza.",
      servings: 4,
      prepTime: 10,
      cookTime: 30,
      difficulty: "easy",
      instructions: JSON.stringify([
        "Heat olive oil in a saucepan over medium heat.",
        "Add garlic and cook until fragrant, about 30 seconds.",
        "Add crushed tomatoes, oregano, salt, and pepper.",
        "Simmer for 25 minutes and finish with basil.",
      ]),
      origin: "manual",
      ingredients: {
        create: [
          { name: "olive oil", quantity: 2, unit: "tbsp", order: 0 },
          { name: "garlic", quantity: 3, unit: "clove", order: 1 },
          { name: "crushed tomatoes", quantity: 28, unit: "oz", order: 2 },
          { name: "oregano", quantity: 1, unit: "tsp", order: 3 },
          { name: "basil", quantity: 0.25, unit: "cup", order: 4 },
        ],
      },
      tags: {
        create: [{ tag: "italian" }, { tag: "sauce" }, { tag: "dinner" }],
      },
    },
  });

  const chickpeaBowl = await prisma.recipe.create({
    data: {
      title: "Crispy Chickpea Grain Bowl",
      description: "High-protein bowl with lemony tahini dressing.",
      servings: 2,
      prepTime: 15,
      cookTime: 25,
      difficulty: "medium",
      instructions: JSON.stringify([
        "Roast chickpeas and vegetables until crisp-tender.",
        "Cook quinoa according to package instructions.",
        "Whisk tahini, lemon juice, and water into a dressing.",
        "Assemble bowls with quinoa, vegetables, chickpeas, and dressing.",
      ]),
      origin: "manual",
      ingredients: {
        create: [
          { name: "chickpeas", quantity: 1, unit: "cup", order: 0 },
          { name: "quinoa", quantity: 0.5, unit: "cup", order: 1 },
          { name: "broccoli", quantity: 2, unit: "cup", order: 2 },
          { name: "tahini", quantity: 2, unit: "tbsp", order: 3 },
          { name: "lemon juice", quantity: 1, unit: "tbsp", order: 4 },
        ],
      },
      tags: {
        create: [
          { tag: "vegetarian" },
          { tag: "lunch" },
          { tag: "high-protein" },
        ],
      },
    },
  });

  await prisma.recipe.create({
    data: {
      title: "Weeknight Spaghetti",
      description: "Fast spaghetti dinner built on a classic tomato sauce.",
      servings: 4,
      prepTime: 10,
      cookTime: 20,
      difficulty: "easy",
      instructions: JSON.stringify([
        "Boil salted water and cook spaghetti until al dente.",
        "Warm tomato sauce and add a splash of pasta water.",
        "Toss pasta with sauce and finish with parmesan.",
      ]),
      origin: "manual",
      ingredients: {
        create: [
          { name: "spaghetti", quantity: 1, unit: "lb", order: 0 },
          { name: "parmesan", quantity: 0.5, unit: "cup", order: 1 },
        ],
      },
      tags: {
        create: [
          { tag: "dinner" },
          { tag: "italian" },
          { tag: "weeknight" },
        ],
      },
      linkedFrom: {
        create: [{ subRecipeId: tomatoSauce.id }],
      },
    },
  });

  await prisma.recipe.create({
    data: {
      title: "Sourdough Avocado Toast",
      description: "Quick breakfast with citrus and chili flakes.",
      servings: 2,
      prepTime: 8,
      cookTime: 5,
      difficulty: "easy",
      instructions: JSON.stringify([
        "Toast the sourdough slices.",
        "Mash avocado with lemon juice, salt, and pepper.",
        "Spread on toast and top with chili flakes.",
      ]),
      origin: "manual",
      ingredients: {
        create: [
          { name: "sourdough", quantity: 2, unit: "slice", order: 0 },
          { name: "avocado", quantity: 1, unit: "piece", order: 1 },
          { name: "lemon juice", quantity: 1, unit: "tsp", order: 2 },
        ],
      },
      tags: {
        create: [
          { tag: "breakfast" },
          { tag: "quick" },
          { tag: "vegetarian" },
        ],
      },
    },
  });

  await prisma.mealLog.createMany({
    data: buildMealLogs(today),
  });
}
