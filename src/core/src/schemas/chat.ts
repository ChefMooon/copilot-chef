import { z } from "zod";

export const quickPromptSchema = z.enum([
  "Plan this week",
  "New grocery list",
  "Suggest a dinner",
  "Add a meal",
  "What's in season?",
  "Surprise me!"
]);

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional()
});

export const chatResponseSchema = z.object({
  sessionId: z.string(),
  message: z.string(),
  suggestions: z.array(z.string()).default([]),
  quickPrompts: z.array(z.string()).default([])
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
