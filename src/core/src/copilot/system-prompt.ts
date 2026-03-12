export type SystemPromptContext = {
  mealPlan?: {
    name: string;
    totalMeals: number;
    meals: Array<{ name: string; mealType: string; date: string }>;
  } | null;
  groceryList?: {
    name: string;
    totalItems: number;
    checkedCount: number;
  } | null;
  preferences?: {
    householdSize: number;
    dietaryRestrictions: string[];
    cuisinePreferences: string[];
    avoidIngredients: string[];
    notes?: string | null;
  } | null;
  /** Optional free-form context string injected into the system prompt. */
  extraContext?: string;
};

export function buildSystemPrompt(context: SystemPromptContext = {}): string {
  const { mealPlan, groceryList, preferences, extraContext } = context;

  const sections: string[] = [];

  if (mealPlan) {
    const mealLines = mealPlan.meals
      .map((m) => {
        const label = new Date(m.date).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric"
        });
        return `  - ${label}: ${m.name} (${m.mealType})`;
      })
      .join("\n");

    sections.push(
      `## Current Meal Plan: "${mealPlan.name}"\n${mealPlan.totalMeals} meals planned this week:\n${mealLines}`
    );
  }

  if (groceryList) {
    const pct =
      groceryList.totalItems > 0
        ? Math.round((groceryList.checkedCount / groceryList.totalItems) * 100)
        : 0;

    sections.push(
      `## Current Grocery List: "${groceryList.name}"\n${groceryList.checkedCount} of ${groceryList.totalItems} items collected (${pct}% done).`
    );
  }

  if (preferences) {
    const dietary =
      preferences.dietaryRestrictions.length > 0 ? preferences.dietaryRestrictions.join(", ") : "none";
    const cuisines =
      preferences.cuisinePreferences.length > 0
        ? preferences.cuisinePreferences.join(", ")
        : "no specific preferences";
    const avoid =
      preferences.avoidIngredients.length > 0 ? preferences.avoidIngredients.join(", ") : "none";

    const prefLines = [
      `- Household size: ${preferences.householdSize} people`,
      `- Dietary restrictions: ${dietary}`,
      `- Favorite cuisines: ${cuisines}`,
      `- Avoid: ${avoid}`,
      ...(preferences.notes ? [`- Notes: ${preferences.notes}`] : [])
    ].join("\n");

    sections.push(`## Household Preferences\n${prefLines}`);
  }

  if (extraContext) {
    sections.push(`## Additional Context\n${extraContext}`);
  }

  const contextBlock =
    sections.length > 0 ? `## Current Kitchen State\n\n${sections.join("\n\n")}\n\nUse the state above to give personalized, relevant suggestions.` : "";

  return [
    `You are Copilot Chef, a warm and knowledgeable AI meal-planning assistant. You help households plan meals, build grocery lists, suggest recipes, and make cooking feel approachable and enjoyable.`,
    ``,
    `Your personality is friendly, practical, and encouraging — like a knowledgeable friend who loves food and wants to make weeknight cooking less stressful.`,
    ``,
    `## Your Capabilities`,
    `- Plan weekly meals tailored to dietary preferences and household size`,
    `- Suggest individual recipes with consideration for prep time and effort`,
    `- Generate and organize grocery lists from meal plans`,
    `- Recommend seasonal ingredients and flavor pairings`,
    `- Help balance the week's prep load and minimize food waste`,
    `- Answer questions about cooking techniques, substitutions, and timing`,
    ``,
    `## Response Style`,
    `- Keep responses concise and conversational unless asked for detail`,
    `- Be specific with meal and ingredient recommendations — avoid vague suggestions`,
    `- For meal suggestions, briefly describe what makes the dish work`,
    `- Use a warm, encouraging tone`,
    ``,
    contextBlock
  ]
    .join("\n")
    .trim();
}
