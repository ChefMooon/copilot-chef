import { z } from "zod";

export const quickPromptSchema = z.enum([
  "Plan this week",
  "New grocery list",
  "Suggest a dinner",
  "Add a meal",
  "Open Recipe Book",
  "What's in season?",
  "Surprise me!",
]);

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  pageContext: z.string().optional(),
  pageContextData: z
    .union([
      z.object({
        page: z.literal("meal-plan"),
        view: z.enum(["day", "week", "month"]),
        date: z.string(),
        dateRangeFrom: z.string(),
        dateRangeTo: z.string(),
        meals: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            mealType: z.string(),
            date: z.string(),
          })
        ),
      }),
      z.object({
        page: z.literal("grocery-list"),
        activeList: z
          .object({
            id: z.string(),
            name: z.string(),
            items: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                qty: z.string().nullable(),
                unit: z.string().nullable(),
                category: z.string(),
                checked: z.boolean(),
              })
            ),
            totalItems: z.number(),
            checkedCount: z.number(),
            completionPercentage: z.number(),
          })
          .nullable(),
        allLists: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            itemCount: z.number(),
            checkedCount: z.number(),
          })
        ),
      }),
      z.object({
        page: z.literal("home"),
        totalMeals: z.number(),
        groceryListName: z.string().nullable(),
        groceryCompletion: z.number(),
      }),
      z.object({
        page: z.enum(["stats", "settings"]),
      }),
    ])
    .optional(),
  chatSessionId: z.string().optional(),
});

export const chatChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  prompt: z.string(),
});

export const chatActionResultSchema = z.object({
  domain: z.enum(["meal", "grocery", "recipe"]),
  type: z.string(),
  summary: z.string(),
  payload: z.unknown().optional(),
});

export const chatJsonResponseSchema = z.object({
  sessionId: z.string().optional(),
  chatSessionId: z.string().optional(),
  message: z.string(),
  choices: z.array(chatChoiceSchema).default([]),
  action: chatActionResultSchema.optional(),
});

export const chatResponseSchema = z.object({
  sessionId: z.string(),
  message: z.string(),
  suggestions: z.array(z.string()).default([]),
  quickPrompts: z.array(z.string()).default([]),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type ChatChoice = z.infer<typeof chatChoiceSchema>;
export type ChatActionResult = z.infer<typeof chatActionResultSchema>;
export type ChatJsonResponse = z.infer<typeof chatJsonResponseSchema>;
