import { z } from "zod";
import { pageContextSchema } from "./page-context";

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
  responseMode: z.enum(["auto", "json", "stream"]).default("auto"),
  sessionId: z.string().optional(),
  pageContext: z.string().optional(),
  pageContextData: pageContextSchema.nullish(),
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
