export type SlashCommand = {
  command: string;
  label: string;
  description: string;
  prompt: string;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: "/plan-week",
    label: "Plan this week",
    description: "Generate a full week of meals based on my preferences",
    prompt:
      "Please plan out a full week of meals for me based on my household preferences and any meals already in my plan.",
  },
  {
    command: "/new-grocery-list",
    label: "New grocery list",
    description: "Create a grocery list from currently scheduled meals",
    prompt:
      "Please generate a grocery list based on my current meals this week. Include all ingredients needed, organised by category.",
  },
  {
    command: "/suggest-meals",
    label: "Suggest meals",
    description: "Get 5 personalised meal suggestions",
    prompt:
      "Suggest 5 meals I could add to my plan this week. Consider my preferences and what would make a balanced week.",
  },
  {
    command: "/check-pantry",
    label: "Check pantry",
    description: "Review what I likely already have before shopping",
    prompt:
      "Based on my scheduled meals and grocery list, what do I likely already have in my pantry? What should I check before shopping?",
  },
  {
    command: "/nutrition",
    label: "Nutrition overview",
    description: "Get a nutritional summary of planned meals",
    prompt:
      "Give me a rough nutritional overview of the meals currently on my schedule. Are there any gaps or imbalances I should address?",
  },
  {
    command: "/quick-shop",
    label: "Quick shop list",
    description: "Category-organised summary of unchecked items",
    prompt:
      "Create a concise, category-organised shopping summary of my unchecked grocery items. Group by store section (produce, dairy, meat, etc.).",
  },
  {
    command: "/open-recipe-book",
    label: "Open Recipe Book",
    description: "Navigate to recipes and summarize saved items",
    prompt:
      "Open Recipe Book and give me a short summary of what is currently saved in my library.",
  },
];
