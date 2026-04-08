export type SystemPromptContext = {
  meals?: Array<{ name: string; mealType: string; date: string | null }> | null;
  groceryList?: {
    name: string;
    totalItems: number;
    checkedCount: number;
  } | null;
  preferences?: {
    id: string;
    createdAt: string;
    updatedAt: string;
    householdSize: number;
    cookingLength: string;
    dietaryTags: string[];
    favoriteCuisines: string[];
    avoidCuisines: string[];
    avoidIngredients: string[];
    pantryStaples: string[];
    planningNotes: string;
    nutritionTags: string[];
    skillLevel: string;
    budgetRange: string;
    chefPersona: string;
    replyLength: string;
    emojiUsage: string;
    autoImproveChef: boolean;
    contextAwareness: boolean;
    seasonalAwareness: boolean;
    seasonalRegion: string;
    proactiveTips: boolean;
    autoGenerateGrocery: boolean;
    consolidateIngredients: boolean;
    defaultPlanLength: string;
    groceryGrouping: string;
    defaultRecipeView: string;
    defaultUnitMode: string;
    saveChatHistory: boolean;
  } | null;
  recipeSummary?: {
    count: number;
    recentTitles: string[];
  } | null;
  /** Optional free-form context string injected into the system prompt. */
  extraContext?: string;
  /** Prompt text for a custom persona; populated when chefPersona is not a built-in key. */
  customPersonaPrompt?: string;
};

const personaInstructions: Record<string, string> = {
  coach:
    "You are an encouraging, practical cooking coach. Be warm, motivating, and clear. Use plain language.",
  scientist:
    "You are a precise, analytical cooking guide. Reference technique, chemistry, and data where relevant. Be methodical.",
  entertainer:
    "You are an energetic, witty kitchen entertainer. Be playful, enthusiastic, and fun while still being helpful.",
  minimalist:
    "You are a terse, efficient kitchen assistant. Be direct. No preamble, no filler. Say exactly what is needed.",
  professor:
    "You are a thoughtful, educational culinary guide. Explain the 'why' behind techniques and choices. Be measured.",
  michelin:
    "You are a refined, exacting chef with high standards. Be elegant, precise, and sophisticated in all suggestions.",
};

const replyLengthInstructions: Record<string, string> = {
  concise:
    "Keep responses brief - 1-3 sentences unless detail is explicitly needed.",
  balanced: "Aim for clear, well-structured responses of moderate length.",
  detailed:
    "Be thorough - explain reasoning, include tips, and use structured formatting where helpful.",
};

const emojiInstructions: Record<string, string> = {
  none: "Do not use emoji in any response.",
  frequent: "Use emoji freely throughout your responses.",
  occasional: "Use emoji sparingly - only where they add warmth or clarity.",
};

const chefPersonaLabels: Record<string, string> = {
  coach: "The Coach",
  scientist: "The Scientist",
  entertainer: "The Entertainer",
  minimalist: "The Minimalist",
  professor: "The Professor",
  michelin: "The Michelin",
};

const cookingLengthLabels: Record<string, string> = {
  quick: "Quick (< 20 min)",
  weeknight: "Weeknight-friendly (~30 min)",
  relaxed: "Relaxed (45-60 min)",
  weekend: "Weekend projects (1 hr+)",
};

const skillLevelLabels: Record<string, string> = {
  beginner: "Beginner",
  "home-cook": "Home cook",
  confident: "Confident cook",
  advanced: "Advanced",
};

const budgetLabels: Record<string, string> = {
  budget: "Budget-friendly",
  moderate: "Moderate",
  premium: "Premium",
};

const replyLengthLabels: Record<string, string> = {
  concise: "Concise",
  balanced: "Balanced",
  detailed: "Detailed",
};

const emojiUsageLabels: Record<string, string> = {
  occasional: "Occasional",
  frequent: "Frequent",
  none: "None",
};

const regionLabels: Record<string, string> = {
  "northern-us-canada": "Northern US / Canada",
  "eastern-us": "Eastern US",
  "southern-us": "Southern US",
  "western-us": "Western US / Pacific",
  "western-europe": "Western Europe",
  mediterranean: "Mediterranean",
  "east-asia": "East Asia",
  "south-asia": "South Asia",
  "australia-nz": "Australia / NZ",
  "southern-hemisphere": "Southern hemisphere",
};

function formatLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatList(values: string[]) {
  return values.map((value) => formatLabel(value)).join(", ");
}

export function buildSystemPrompt(context: SystemPromptContext = {}): string {
  const {
    meals,
    groceryList,
    preferences,
    recipeSummary,
    extraContext,
    customPersonaPrompt,
  } = context;
  const activePersona = preferences?.chefPersona ?? "coach";
  const personaInstruction =
    personaInstructions[activePersona] ??
    customPersonaPrompt ??
    personaInstructions.coach;
  const replyLengthInstruction =
    replyLengthInstructions[preferences?.replyLength ?? "balanced"];
  const emojiInstruction =
    emojiInstructions[preferences?.emojiUsage ?? "occasional"];

  const sections: string[] = [];

  if (meals && meals.length > 0) {
    const mealLines = meals
      .filter((m) => m.date)
      .map((m) => {
        const label = new Date(m.date as string).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
        return `  - ${label}: ${m.name} (${m.mealType})`;
      })
      .join("\n");

    sections.push(
      `## Current Meals\n${meals.length} meals scheduled this week:\n${mealLines || "  - No dated meals in this window."}`
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
    const prefLines = [
      `- Household: ${preferences.householdSize} people.`,
      `- Cooking rhythm: ${cookingLengthLabels[preferences.cookingLength] ?? formatLabel(preferences.cookingLength)}.`,
      `- Dietary direction: ${preferences.dietaryTags.length > 0 ? formatList(preferences.dietaryTags) : "None specified"}.`,
      `- Favorite cuisines: ${preferences.favoriteCuisines.length > 0 ? formatList(preferences.favoriteCuisines) : "None specified"}.`,
      `- Avoid cuisines: ${preferences.avoidCuisines.length > 0 ? formatList(preferences.avoidCuisines) : "None specified"}.`,
      `- Avoid ingredients: ${preferences.avoidIngredients.length > 0 ? preferences.avoidIngredients.join(", ") : "None specified"}.`,
      `- Pantry staples (skip from grocery lists): ${preferences.pantryStaples.length > 0 ? preferences.pantryStaples.join(", ") : "None specified"}.`,
      ...(preferences.planningNotes
        ? [`- Planning notes: ${preferences.planningNotes}`]
        : []),
      `- Nutrition focus: ${preferences.nutritionTags.length > 0 ? formatList(preferences.nutritionTags) : "None specified"}.`,
      `- Skill level: ${skillLevelLabels[preferences.skillLevel] ?? formatLabel(preferences.skillLevel)}. Budget: ${budgetLabels[preferences.budgetRange] ?? formatLabel(preferences.budgetRange)}.`,
      `- Response style: ${replyLengthLabels[preferences.replyLength] ?? formatLabel(preferences.replyLength)} length, ${emojiUsageLabels[preferences.emojiUsage] ?? formatLabel(preferences.emojiUsage)} emoji.`,
      `- Chef persona: ${chefPersonaLabels[preferences.chefPersona] ?? formatLabel(preferences.chefPersona)}.`,
      `- AI behavior: auto-improve ${preferences.autoImproveChef ? "on" : "off"}, context awareness ${preferences.contextAwareness ? "on" : "off"}, proactive tips ${preferences.proactiveTips ? "on" : "off"}.`,
      `- Seasonal awareness: ${preferences.seasonalAwareness ? `Enabled (${regionLabels[preferences.seasonalRegion] ?? formatLabel(preferences.seasonalRegion)})` : "Disabled"}.`,
      `- Grocery planning defaults: auto-generate grocery ${preferences.autoGenerateGrocery ? "on" : "off"}, consolidate ingredients ${preferences.consolidateIngredients ? "on" : "off"}, plan length ${preferences.defaultPlanLength} days, grouping ${formatLabel(preferences.groceryGrouping)}.`,
      `- Chat history: ${preferences.saveChatHistory ? "Saved across sessions" : "Do not persist"}.`,
    ].join("\n");

    sections.push(`## Household Preferences\n${prefLines}`);
  }

  if (recipeSummary) {
    const recent =
      recipeSummary.recentTitles.length > 0
        ? recipeSummary.recentTitles.join(", ")
        : "none yet";
    sections.push(
      `## Recipe Library\nUser has ${recipeSummary.count} recipes saved. Recent recipes: ${recent}.`
    );
  }

  if (extraContext) {
    sections.push(`## Additional Context\n${extraContext}`);
  }

  const contextBlock =
    sections.length > 0
      ? `## Current Kitchen State\n\n${sections.join("\n\n")}\n\nUse the state above to give personalized, relevant suggestions.`
      : "";

  return [
    `You are Copilot Chef, a warm and knowledgeable AI meal-planning assistant. You help households plan meals, build grocery lists, suggest recipes, and make cooking feel approachable and enjoyable.`,
    ``,
    personaInstruction,
    ``,
    `## Your Capabilities`,
    `- Plan weekly meals tailored to dietary preferences and household size`,
    `- Suggest individual recipes with consideration for prep time and effort`,
    `- Generate and organize grocery lists from scheduled meals`,
    `- Recommend seasonal ingredients and flavor pairings`,
    `- Help balance the week's prep load and minimize food waste`,
    `- Answer questions about cooking techniques, substitutions, and timing`,
    ``,
    `## Available Tools`,
    `- Meal tools: create, list, get, update, move, replace, remove, and delete meal entries, plus suggest and apply pending meals.`,
    `- Grocery tools: list, get, create, update, and delete grocery lists; add, update, delete, and reorder grocery items.`,
    `- History tools: undo and redo prior meal or grocery actions when chat-session history is available.`,
    `- Preference tools: read and update household preferences, including reasoning effort.`,
    `- Recipe tools: list, get, save, and delete recipes from the recipe book.`,
    `- User input flow: when required, ask the user a focused follow-up question and wait for their response before continuing.`,
    ``,
    `## Tool Usage Rules`,
    `- Prefer tools for state-changing actions instead of describing what you would do.`,
    `- When creating or updating meals, use field names exactly: name, mealType, date, notes, ingredients, description, instructions, servings, prepTime, cookTime, servingsOverride, recipeId.`,
    `- Meal ingredients must be structured objects like { name, quantity, unit, notes, order } rather than plain strings.`,
    `- Never use alternate field names like title, type, or ingredientsJson when calling tools.`,
    `- Read current state with get or list tools before mutating when the target is ambiguous.`,
    `- Ask for clarification if the target item, meal, date, or list is ambiguous.`,
    `- After using a tool, explain the result clearly and confirm what changed.`,
    ``,
    `## Response Style`,
    `- ${replyLengthInstruction}`,
    `- ${emojiInstruction}`,
    `- Be specific with meal and ingredient recommendations — avoid vague suggestions`,
    `- For meal suggestions, briefly describe what makes the dish work`,
    `- Match the selected chef persona consistently without becoming theatrical or role-play heavy`,
    ``,
    contextBlock,
  ]
    .join("\n")
    .trim();
}
