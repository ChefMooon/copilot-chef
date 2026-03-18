import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  approveAll,
  defineTool,
  type CopilotSession,
} from "@github/copilot-sdk";
import { z } from "zod";

import { getClient } from "../lib/copilot-client";
import { GroceryService } from "../services/grocery-service";
import { MealService } from "../services/meal-service";
import { PersonaService } from "../services/persona-service";
import { PreferenceService } from "../services/preference-service";
import { RecipeService } from "../services/recipe-service";
import { AIRecipeSaveSchema } from "../schemas/recipe-schemas";
import { buildSystemPrompt, type SystemPromptContext } from "./system-prompt";

export { buildSystemPrompt, type SystemPromptContext } from "./system-prompt";

/** Default model — override by setting COPILOT_MODEL in your environment. */
export const COPILOT_DEFAULT_MODEL = "gpt-4o-mini";

const mealTypeSchema = z.enum([
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "SNACK",
]);

const createMealArgsSchema = z.object({
  name: z.string().min(1),
  mealType: mealTypeSchema,
  date: z.string(),
  notes: z.string().nullable().optional(),
  ingredients: z.array(z.string()).optional(),
});

const listMealsArgsSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .optional();

function getCurrentWeekRange() {
  const now = new Date();
  const monday = new Date(now);
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { from: monday.toISOString(), to: sunday.toISOString() };
}

function getModel(): string {
  return process.env["COPILOT_MODEL"] ?? COPILOT_DEFAULT_MODEL;
}

// Directory for SDK session state. Created on first use.
const CONFIG_DIR = join(process.cwd(), ".copilot-sessions");

function ensureConfigDir() {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
  } catch {
    // ignore — likely already exists
  }
}

const BUILT_IN_PERSONA_KEYS = new Set([
  "coach",
  "scientist",
  "entertainer",
  "minimalist",
  "professor",
  "michelin",
]);

const SAVE_RECIPE_INTENTS = [
  /save this recipe/i,
  /add this to my recipe book/i,
  /save that/i,
  /keep this one/i,
];

function hasSaveRecipeIntent(message: string) {
  return SAVE_RECIPE_INTENTS.some((pattern) => pattern.test(message));
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export class CopilotChef {
  /** Active SDK sessions keyed by their Copilot session ID. */
  private readonly sessions = new Map<string, CopilotSession>();

  constructor(
    private readonly mealService = new MealService(),
    private readonly groceryService = new GroceryService(),
    private readonly preferenceService = new PreferenceService(),
    private readonly personaService = new PersonaService(),
    private readonly recipeService = new RecipeService()
  ) {}

  // ---------------------------------------------------------------------------
  // Context helpers
  // ---------------------------------------------------------------------------

  private async buildContext(): Promise<SystemPromptContext> {
    const { from, to } = getCurrentWeekRange();
    const [meals, groceryList, preferences, recipes] = await Promise.all([
      this.mealService.listMealsInRange(from, to),
      this.groceryService.getCurrentGroceryList(),
      this.preferenceService.getPreferences(),
      this.recipeService.listRecipes(),
    ]);

    let customPersonaPrompt: string | undefined;
    if (preferences && !BUILT_IN_PERSONA_KEYS.has(preferences.chefPersona)) {
      try {
        const persona = await this.personaService.findById(
          preferences.chefPersona
        );
        customPersonaPrompt = persona?.prompt;
      } catch {
        // persona may have been deleted; fall back to default
      }
    }

    return {
      meals,
      groceryList,
      preferences,
      customPersonaPrompt,
      recipeSummary: {
        count: recipes.length,
        recentTitles: recipes.slice(0, 3).map((recipe) => recipe.title),
      },
    };
  }

  private async extractRecipeAction(session: CopilotSession, message: string) {
    const extractionPrompt = [
      "The user asked to save a recipe from this conversation.",
      "Extract a structured recipe object and return ONLY valid JSON.",
      "If details are missing, infer reasonable defaults.",
      "Required keys: title, description, servings, prepTime, cookTime, difficulty, ingredients, instructions, tags.",
      "Each ingredient should be {name, quantity, unit, notes}.",
      `User message: ${message}`,
    ].join("\n");

    const response = await session.sendAndWait({ prompt: extractionPrompt }, 60_000);
    const text = response?.data?.content ?? "";
    const parsed = parseJsonObject(text);
    if (!parsed) {
      return null;
    }

    const validated = AIRecipeSaveSchema.safeParse(parsed);
    if (!validated.success) {
      return null;
    }

    return {
      domain: "recipe" as const,
      type: "save_recipe" as const,
      summary: `Prepared recipe draft: ${validated.data.title}`,
      payload: validated.data,
    };
  }

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  private async createCopilotSession(
    extraContext?: string
  ): Promise<CopilotSession> {
    ensureConfigDir();
    const client = await getClient();
    const context = await this.buildContext();
    const systemMessage = buildSystemPrompt({ ...context, extraContext });

    return client.createSession({
      model: getModel(),
      configDir: CONFIG_DIR,
      streaming: true,
      tools: [
        defineTool("create_meal", {
          description: "Create a meal entry in the user's meal calendar.",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Meal name, e.g. Grilled Cheese",
              },
              mealType: {
                type: "string",
                enum: [
                  "BREAKFAST",
                  "MORNING_SNACK",
                  "LUNCH",
                  "AFTERNOON_SNACK",
                  "DINNER",
                  "SNACK",
                ],
                description: "Meal type",
              },
              date: {
                type: "string",
                description:
                  "ISO date or date-time string for when the meal should occur",
              },
              notes: {
                type: ["string", "null"],
                description: "Optional notes for prep or preferences",
              },
              ingredients: {
                type: "array",
                items: { type: "string" },
                description: "Optional ingredient names",
              },
            },
            required: ["name", "mealType", "date"],
          },
          handler: async (rawArgs) => {
            const args = createMealArgsSchema.parse(rawArgs);
            const created = await this.mealService.createMeal({
              name: args.name,
              mealType: args.mealType,
              date: new Date(args.date).toISOString(),
              notes: args.notes ?? null,
              ingredients: args.ingredients ?? [],
            });

            return {
              success: true,
              meal: created,
              message: `Added ${created.name} for ${created.mealType.toLowerCase().replace("_", " ")} on ${created.date ? new Date(created.date).toLocaleDateString() : "unscheduled"}.`,
            };
          },
        }),
        defineTool("list_meals", {
          description: "List meals for the current context.",
          parameters: {
            type: "object",
            properties: {
              from: { type: "string", description: "Optional ISO start date" },
              to: { type: "string", description: "Optional ISO end date" },
            },
          },
          handler: async (rawArgs) => {
            const args = listMealsArgsSchema.parse(rawArgs);
            if (args?.from && args?.to) {
              const meals = await this.mealService.listMealsInRange(
                args.from,
                args.to
              );
              return { count: meals.length, meals };
            }

            const { from, to } = getCurrentWeekRange();
            const meals = await this.mealService.listMealsInRange(from, to);
            return {
              count: meals.length,
              meals,
            };
          },
        }),
      ],
      systemMessage: { content: systemMessage },
      onPermissionRequest: approveAll,
    });
  }

  private async ensureSession(
    sessionId?: string,
    extraContext?: string
  ): Promise<{ session: CopilotSession; sessionId: string }> {
    if (sessionId) {
      const existing = this.sessions.get(sessionId);
      if (existing) {
        return { session: existing, sessionId };
      }
    }

    // Create a new SDK session — this is the lazy init point.
    const session = await this.createCopilotSession(extraContext);
    const newSessionId = session.sessionId;
    this.sessions.set(newSessionId, session);
    return { session, sessionId: newSessionId };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Send a message to Copilot Chef. On the first call (no sessionId), a new
   * Copilot SDK session is created with a dynamic system prompt built from the
    * current meals, grocery list, and preferences.
   *
   * Returns the active sessionId and a ReadableStream of UTF-8 text tokens so
   * the caller can stream the response directly to the client.
   *
   * @param message     The user's message.
   * @param sessionId   An existing session ID to continue the conversation.
   *                    Pass undefined on the first message.
   * @param extraContext Optional free-form text injected into the system prompt
   *                    when creating a new session.
   */
  async chat(
    message: string,
    sessionId?: string,
    pageContext?: string
  ): Promise<
    | { sessionId: string; stream: ReadableStream<Uint8Array> }
    | {
        sessionId: string;
        message: string;
        action: {
          domain: "recipe";
          type: "save_recipe";
          summary: string;
          payload: unknown;
        };
      }
  > {
    const { session, sessionId: activeId } =
      await this.ensureSession(sessionId);
    const encoder = new TextEncoder();

    if (hasSaveRecipeIntent(message)) {
      const action = await this.extractRecipeAction(session, message);
      if (action) {
        return {
          sessionId: activeId,
          message:
            "I pulled the recipe details from our conversation. Want me to save it to your Recipe Book now?",
          action,
        };
      }
    }

    const prompt = pageContext
      ? `[Page Context]\n${pageContext}\n\n[User Message]\n${message}`
      : message;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        session
          .sendAndWait({ prompt }, 120_000)
          .then((response) => {
            const text = response?.data?.content ?? "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
            try {
              controller.close();
            } catch {
              // already closed
            }
          })
          .catch((err: unknown) => {
            try {
              controller.error(err);
            } catch {
              // already errored
            }
          });
      },
    });

    return { sessionId: activeId, stream };
  }

  /** Remove a session from memory. */
  async endSession(sessionId: string) {
    this.sessions.delete(sessionId);
    return { sessionId, endedAt: new Date().toISOString() };
  }
}
