import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  defineTool,
  type CopilotSession,
  type MCPServerConfig,
} from "@github/copilot-sdk";
import { z } from "zod";
import type { MealIngredient } from "@shared/types";

import { getClient } from "../lib/copilot-client";
import {
  nextNights,
  parseMealOps,
  parseSnapshot,
  resolveRelativeDate,
  snapshotFromList,
  serializeMealOps,
  serializeSnapshot,
  type MealForwardOp,
  type MealTypeValue,
} from "../lib/chat-command-utils";
import { ChatHistoryService } from "../services/chat-history-service";
import { GroceryService } from "../services/grocery-service";
import { MealService } from "../services/meal-service";
import { PersonaService } from "../services/persona-service";
import { PreferenceService } from "../services/preference-service";
import { RecipeService } from "../services/recipe-service";
import { MealTypeService } from "../services/meal-type-service";
import { AIRecipeSaveSchema } from "../schemas/recipe-schemas";
import { buildSystemPrompt, type SystemPromptContext } from "./system-prompt";

export { buildSystemPrompt, type SystemPromptContext } from "./system-prompt";

/** Reasoning effort levels supported by the SDK. */
type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

/** Shape of a user-input request from the SDK (onUserInputRequest callback). */
interface UserInputRequest {
  question: string;
  choices?: string[];
  allowFreeform?: boolean;
}

/** Default model — override by setting COPILOT_MODEL in your environment. */
export const COPILOT_DEFAULT_MODEL = "gpt-4.1";
const DEFAULT_CHAT_OWNER_ID = "web-default";

const mealTypeSchema = z.string().min(1);

const mealIngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  group: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  order: z.number().int().nonnegative().optional(),
});

const createMealArgsSchema = z.object({
  name: z.string().min(1),
  mealType: mealTypeSchema,
  date: z.string(),
  notes: z.string().nullable().optional(),
  ingredients: z.array(mealIngredientSchema).optional(),
  description: z.string().nullable().optional(),
  instructions: z.array(z.string()).optional(),
  servings: z.number().int().positive().optional(),
  prepTime: z.number().int().nonnegative().nullable().optional(),
  cookTime: z.number().int().nonnegative().nullable().optional(),
  servingsOverride: z.number().int().positive().nullable().optional(),
  recipeId: z.string().nullable().optional(),
  chatSessionId: z.string().optional(),
});

const listMealsArgsSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .optional();

const getMealArgsSchema = z.object({
  id: z.string().min(1),
});

const updateMealArgsSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  mealType: mealTypeSchema.optional(),
  date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  ingredients: z.array(mealIngredientSchema).optional(),
  description: z.string().nullable().optional(),
  instructions: z.array(z.string()).optional(),
  servings: z.number().int().positive().optional(),
  prepTime: z.number().int().nonnegative().nullable().optional(),
  cookTime: z.number().int().nonnegative().nullable().optional(),
  servingsOverride: z.number().int().positive().nullable().optional(),
  recipeId: z.string().nullable().optional(),
  chatSessionId: z.string().optional(),
});

const deleteMealArgsSchema = z.object({
  id: z.string().min(1),
  chatSessionId: z.string().optional(),
});

const moveMealArgsSchema = z.object({
  id: z.string().min(1),
  toDate: z.string(),
  chatSessionId: z.string().optional(),
});

const replaceMealArgsSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  chatSessionId: z.string().optional(),
});

const suggestMealsArgsSchema = z.object({
  chatSessionId: z.string().min(1),
  count: z.number().int().min(1).max(7).default(3),
});

const applyPendingMealsArgsSchema = z.object({
  chatSessionId: z.string().min(1),
  count: z.number().int().min(1).max(7),
  nights: z.number().int().min(1).max(14).optional(),
});

const undoRedoArgsSchema = z.object({
  chatSessionId: z.string().min(1),
  domain: z.enum(["meal", "grocery"]).optional(),
});

const getByIdArgsSchema = z.object({
  id: z.string().min(1),
});

const createGroceryListArgsSchema = z.object({
  name: z.string().min(1),
  date: z.string().optional(),
  favourite: z.boolean().optional(),
});

const updateGroceryListArgsSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  date: z.string().optional(),
  favourite: z.boolean().optional(),
});

const addGroceryItemArgsSchema = z.object({
  groceryListId: z.string().min(1),
  name: z.string().min(1),
  qty: z.string().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  meal: z.string().optional(),
  checked: z.boolean().optional(),
  chatSessionId: z.string().optional(),
});

const updateGroceryItemArgsSchema = z.object({
  groceryListId: z.string().min(1),
  itemId: z.string().min(1),
  name: z.string().optional(),
  qty: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  category: z.string().optional(),
  notes: z.string().nullable().optional(),
  meal: z.string().nullable().optional(),
  checked: z.boolean().optional(),
  chatSessionId: z.string().optional(),
});

const deleteGroceryItemArgsSchema = z.object({
  groceryListId: z.string().min(1),
  itemId: z.string().min(1),
  chatSessionId: z.string().optional(),
});

const reorderGroceryItemsArgsSchema = z.object({
  groceryListId: z.string().min(1),
  itemIds: z.array(z.string().min(1)).min(1),
  chatSessionId: z.string().optional(),
});

const updatePreferencesArgsSchema = z.object({
  patch: z.object({}).passthrough(),
});

const listRecipesArgsSchema = z
  .object({
    origin: z.enum(["manual", "imported", "ai_generated"]).optional(),
    tags: z.array(z.string()).optional(),
    difficulty: z.string().optional(),
    maxCookTime: z.number().int().positive().optional(),
    favourite: z.boolean().optional(),
    rating: z.number().int().min(1).max(5).optional(),
  })
  .optional();

const saveRecipeArgsSchema = AIRecipeSaveSchema;

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

/** Sentinel bytes used to signal control events inside the UTF-8 delta stream. */
const SENTINEL_PREFIX = "\x00COPILOT_CHEF_EVENT\x00";

/** Tools the model is allowed to call. Built-in CLI tools are excluded. */
const ALLOWED_TOOLS = [
  "create_meal",
  "list_meals",
  "get_meal",
  "update_meal",
  "delete_meal",
  "move_meal",
  "replace_meal",
  "remove_meal",
  "suggest_meals",
  "apply_pending_meals",
  "list_grocery_lists",
  "get_current_grocery_list",
  "get_grocery_list",
  "create_grocery_list",
  "update_grocery_list",
  "delete_grocery_list",
  "add_grocery_item",
  "update_grocery_item",
  "delete_grocery_item",
  "reorder_grocery_items",
  "undo_action",
  "redo_action",
  "get_preferences",
  "update_preferences",
  "list_recipes",
  "get_recipe",
  "save_recipe",
  "delete_recipe",
  "ask_user",
];

/** Per-session mutable state used during streaming. */
type SessionState = {
  writer?: WritableStreamDefaultWriter<Uint8Array>;
  pendingInputResolve?: (response: {
    answer: string;
    wasFreeform: boolean;
  }) => void;
};

const SAVE_RECIPE_INTENTS = [
  /save this recipe/i,
  /add this to my recipe book/i,
  /save that/i,
  /keep this one/i,
];

const MUTATION_TOOL_DOMAINS: Record<string, "meal" | "grocery" | "recipe"> = {
  create_meal: "meal",
  update_meal: "meal",
  delete_meal: "meal",
  move_meal: "meal",
  replace_meal: "meal",
  remove_meal: "meal",
  apply_pending_meals: "meal",
  undo_action: "meal",
  redo_action: "meal",
  create_grocery_list: "grocery",
  update_grocery_list: "grocery",
  delete_grocery_list: "grocery",
  add_grocery_item: "grocery",
  update_grocery_item: "grocery",
  delete_grocery_item: "grocery",
  reorder_grocery_items: "grocery",
  save_recipe: "recipe",
  delete_recipe: "recipe",
};

function resolveToolDate(input: string) {
  const normalizedInput = input.trim();
  const toUtcNoonIso = (date: Date) =>
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        12,
        0,
        0,
        0
      )
    ).toISOString();

  const parsed = new Date(normalizedInput);
  if (!Number.isNaN(parsed.getTime())) {
    return toUtcNoonIso(parsed);
  }

  const relative = resolveRelativeDate(normalizedInput);
  if (relative) {
    const relativeParsed = new Date(relative);
    if (!Number.isNaN(relativeParsed.getTime())) {
      return toUtcNoonIso(relativeParsed);
    }
  }

  throw new Error(`Unable to parse date: ${normalizedInput}`);
}

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

  /** Mutable per-session state (stream writer, pending input resolve). */
  private readonly sessionState = new Map<string, SessionState>();

  constructor(
    private readonly mealService = new MealService(),
    private readonly groceryService = new GroceryService(),
    private readonly historyService = new ChatHistoryService(),
    private readonly preferenceService = new PreferenceService(),
    private readonly personaService = new PersonaService(),
    private readonly recipeService = new RecipeService(),
    private readonly mealTypeService = new MealTypeService()
  ) {}

  private describeActiveMealTypes(context?: SystemPromptContext) {
    const activeMealTypes = context?.activeMealTypes ?? [];
    if (activeMealTypes.length === 0) {
      return "Use the active meal type label for the meal date.";
    }

    return `Use the active meal type label for the meal date. Current active types: ${activeMealTypes
      .map((definition) => `${definition.name} (${definition.slug})`)
      .join(", ")}.`;
  }

  private async resolveToolMealType(mealType: string, date: string) {
    return this.mealTypeService.resolveMealTypeForDate(date, mealType);
  }

  private getActiveStreamingSessionId() {
    for (const [sessionId, state] of this.sessionState.entries()) {
      if (state.writer) {
        return sessionId;
      }
    }
    return undefined;
  }

  private emitSentinel(
    sessionId: string | undefined,
    event: Record<string, unknown>
  ) {
    if (!sessionId) return;
    const state = this.sessionState.get(sessionId);
    if (!state?.writer) return;

    const encoder = new TextEncoder();
    const payload = JSON.stringify(event);
    state.writer
      .write(encoder.encode(`${SENTINEL_PREFIX}${payload}\n`))
      .catch(() => {});
  }

  private toSerializableToolResult(value: unknown) {
    try {
      return JSON.parse(JSON.stringify(value)) as unknown;
    } catch {
      return null;
    }
  }

  private async resolveChatOwnerId(chatSessionId?: string) {
    if (!chatSessionId) {
      return DEFAULT_CHAT_OWNER_ID;
    }

    const ownerId = await this.historyService.getSessionOwnerId(chatSessionId);
    return ownerId ?? DEFAULT_CHAT_OWNER_ID;
  }

  private async recordMealAction(
    chatSessionId: string | undefined,
    input: {
      actionType: string;
      summary: string;
      forwardOps: MealForwardOp[];
      inverseOps: MealForwardOp[];
    }
  ) {
    if (!chatSessionId) return;
    try {
      const ownerId = await this.resolveChatOwnerId(chatSessionId);
      await this.historyService.recordAction({
        ownerId,
        chatSessionId,
        domain: "meal",
        actionType: input.actionType,
        summary: input.summary,
        forwardJson: serializeMealOps(input.forwardOps),
        inverseJson: serializeMealOps(input.inverseOps),
      });
    } catch (error) {
      // Keep the primary tool action successful even if undo history persistence fails.
      console.warn("[CopilotChef] Failed to record meal action history", error);
    }
  }

  private async recordGrocerySnapshotAction(
    chatSessionId: string | undefined,
    input: {
      actionType: string;
      summary: string;
      before: Awaited<ReturnType<GroceryService["getGroceryList"]>>;
      after: Awaited<ReturnType<GroceryService["getGroceryList"]>>;
    }
  ) {
    if (!chatSessionId || !input.before || !input.after) return;
    const ownerId = await this.resolveChatOwnerId(chatSessionId);
    await this.historyService.recordAction({
      ownerId,
      chatSessionId,
      domain: "grocery",
      actionType: input.actionType,
      summary: input.summary,
      forwardJson: serializeSnapshot(snapshotFromList(input.after)),
      inverseJson: serializeSnapshot(snapshotFromList(input.before)),
    });
  }

  private async applyMealOps(payloadJson: string) {
    const ops = parseMealOps(payloadJson);

    for (const op of ops) {
      if (op.op === "create") {
        const existing = await this.mealService.getMeal(op.meal.id);
        if (!existing) {
          await this.mealService.createMeal({
            id: op.meal.id,
            name: op.meal.name,
            date: op.meal.date,
            mealType: op.meal.mealType,
            notes: op.meal.notes,
            ingredients: op.meal.ingredients,
          });
        }
        continue;
      }

      if (op.op === "update") {
        await this.mealService.updateMeal(op.id, op.patch);
        continue;
      }

      const existing = await this.mealService.getMeal(op.id);
      if (existing) {
        await this.mealService.deleteMeal(op.id);
      }
    }
  }

  private async applyActionSnapshot(payloadJson: string) {
    return this.groceryService.restoreGroceryListSnapshot(
      parseSnapshot(payloadJson)
    );
  }

  private async undoAction(chatSessionId: string, domain?: "meal" | "grocery") {
    const ownerId = await this.resolveChatOwnerId(chatSessionId);
    const action = await this.historyService.getLatestUndoAction(
      ownerId,
      chatSessionId,
      domain
    );
    if (!action) {
      return {
        success: false,
        message: domain
          ? `No ${domain} action available to undo.`
          : "No action available to undo.",
      };
    }

    if (action.domain === "meal") {
      await this.applyMealOps(action.inverseJson);
    } else if (action.domain === "grocery") {
      await this.applyActionSnapshot(action.inverseJson);
    }
    await this.historyService.markActionUndone(ownerId, action.id);

    return {
      success: true,
      actionId: action.id,
      domain: action.domain,
      actionType: action.actionType,
      summary: action.summary,
      message: `Undid: ${action.summary}`,
    };
  }

  private async redoAction(chatSessionId: string, domain?: "meal" | "grocery") {
    const ownerId = await this.resolveChatOwnerId(chatSessionId);
    const action = await this.historyService.getLatestRedoAction(
      ownerId,
      chatSessionId,
      domain
    );
    if (!action) {
      return {
        success: false,
        message: domain
          ? `No ${domain} action available to redo.`
          : "No action available to redo.",
      };
    }

    if (action.domain === "meal") {
      await this.applyMealOps(action.forwardJson);
    } else if (action.domain === "grocery") {
      await this.applyActionSnapshot(action.forwardJson);
    }
    await this.historyService.markActionRedone(ownerId, action.id);

    return {
      success: true,
      actionId: action.id,
      domain: action.domain,
      actionType: action.actionType,
      summary: action.summary,
      message: `Redid: ${action.summary}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Context helpers
  // ---------------------------------------------------------------------------

  private async buildContext(): Promise<SystemPromptContext> {
    const { from, to } = getCurrentWeekRange();
    const today = new Date();
    const [meals, groceryList, preferences, recipes, mealTypeSummary] = await Promise.all([
      this.mealService.listMealsInRange(from, to),
      this.groceryService.getCurrentGroceryList(),
      this.preferenceService.getPreferences(),
      this.recipeService.listRecipes(),
      this.mealTypeService.getActiveMealTypeSummary(today),
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
      activeMealTypeProfile: mealTypeSummary.profile
        ? {
            id: mealTypeSummary.profile.id,
            name: mealTypeSummary.profile.name,
            startDate: mealTypeSummary.profile.startDate,
            endDate: mealTypeSummary.profile.endDate,
          }
        : null,
      activeMealTypes: mealTypeSummary.activeMealTypes,
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

  private parseMcpServers() {
    let mcpServers: Record<string, MCPServerConfig> | undefined;
    const mcpEnv = process.env["COPILOT_MCP_SERVERS"];
    if (mcpEnv) {
      try {
        const parsed = JSON.parse(mcpEnv) as Array<{
          name: string;
          command: string;
          args?: string[];
          env?: Record<string, string>;
        }>;
        mcpServers = {};
        for (const entry of parsed) {
          mcpServers[entry.name] = {
            command: entry.command,
            args: entry.args ?? [],
            env: entry.env,
            tools: ["*"],
          };
        }
      } catch {
        console.error("Failed to parse COPILOT_MCP_SERVERS env var");
      }
    }
    return mcpServers;
  }

  private buildTools(context?: SystemPromptContext) {
    const activeMealTypeDescription = this.describeActiveMealTypes(context);

    return [
      defineTool("create_meal", {
        description: "Create a meal entry in the meal calendar.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            mealType: { type: "string", description: activeMealTypeDescription },
            date: { type: "string" },
            notes: { type: ["string", "null"] },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: ["string", "null"] },
                  unit: { type: ["string", "null"] },
                  group: { type: ["string", "null"] },
                  notes: { type: ["string", "null"] },
                  order: { type: "number" },
                },
                required: ["name"],
              },
            },
            description: { type: ["string", "null"] },
            instructions: { type: "array", items: { type: "string" } },
            servings: { type: "number" },
            prepTime: { type: ["number", "null"] },
            cookTime: { type: ["number", "null"] },
            servingsOverride: { type: ["number", "null"] },
            recipeId: { type: ["string", "null"] },
            chatSessionId: { type: "string" },
          },
          required: ["name", "mealType", "date"],
        },
        handler: async (rawArgs) => {
          const args = createMealArgsSchema.parse(rawArgs);
          const resolvedDate = resolveToolDate(args.date);
          const resolvedMealType = await this.resolveToolMealType(
            args.mealType,
            resolvedDate
          );
          const created = await this.mealService.createMeal({
            name: args.name,
            mealType: resolvedMealType.mealType,
            mealTypeDefinitionId: resolvedMealType.mealTypeDefinitionId,
            date: resolvedDate,
            notes: args.notes ?? null,
            ingredients: args.ingredients ?? [],
            description: args.description ?? null,
            instructions: args.instructions ?? [],
            servings: args.servings,
            prepTime: args.prepTime,
            cookTime: args.cookTime,
            servingsOverride: args.servingsOverride,
            recipeId: args.recipeId,
          });

          await this.recordMealAction(args.chatSessionId, {
            actionType: "add-meal",
            summary: `Added ${created.name}`,
            forwardOps: [
              {
                op: "create",
                meal: {
                  id: created.id,
                  name: created.name,
                  date: created.date,
                  mealType: created.mealType,
                  notes: created.notes,
                  ingredients: created.ingredients,
                  description: created.description,
                  instructions: created.instructions,
                  servings: created.servings,
                  prepTime: created.prepTime,
                  cookTime: created.cookTime,
                  servingsOverride: created.servingsOverride,
                  recipeId: created.recipeId,
                },
              },
            ],
            inverseOps: [{ op: "delete", id: created.id }],
          });

          return {
            success: true,
            meal: created,
            message: `Added ${created.name}.`,
          };
        },
      }),
      defineTool("list_meals", {
        description: "List meals for a date range.",
        parameters: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
          },
        },
        handler: async (rawArgs) => {
          const args = listMealsArgsSchema.parse(rawArgs);
          if (args?.from && args?.to) {
            const meals = await this.mealService.listMealsInRange(args.from, args.to);
            return { count: meals.length, meals };
          }

          const { from, to } = getCurrentWeekRange();
          const meals = await this.mealService.listMealsInRange(from, to);
          return { count: meals.length, meals };
        },
      }),
      defineTool("get_meal", {
        description: "Get a meal by id.",
        parameters: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        handler: async (rawArgs) => {
          const args = getMealArgsSchema.parse(rawArgs);
          const meal = await this.mealService.getMeal(args.id);
          return { success: !!meal, meal };
        },
      }),
      defineTool("update_meal", {
        description: "Update a meal by id.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            mealType: { type: "string", description: activeMealTypeDescription },
            date: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: ["string", "null"] },
                  unit: { type: ["string", "null"] },
                  group: { type: ["string", "null"] },
                  notes: { type: ["string", "null"] },
                  order: { type: "number" },
                },
                required: ["name"],
              },
            },
            description: { type: ["string", "null"] },
            instructions: { type: "array", items: { type: "string" } },
            servings: { type: "number" },
            prepTime: { type: ["number", "null"] },
            cookTime: { type: ["number", "null"] },
            servingsOverride: { type: ["number", "null"] },
            recipeId: { type: ["string", "null"] },
            chatSessionId: { type: "string" },
          },
          required: ["id"],
        },
        handler: async (rawArgs) => {
          const args = updateMealArgsSchema.parse(rawArgs);
          const before = await this.mealService.getMeal(args.id);
          if (!before) {
            return { success: false, message: "Meal not found." };
          }
          const targetDate = args.date ? resolveToolDate(args.date) : before.date ?? null;
          const resolvedMealType =
            targetDate && (args.mealType || args.date)
              ? await this.resolveToolMealType(args.mealType ?? before.mealType, targetDate)
              : null;
          const updated = await this.mealService.updateMeal(args.id, {
            name: args.name,
            mealType: resolvedMealType?.mealType,
            mealTypeDefinitionId: resolvedMealType?.mealTypeDefinitionId,
            date: targetDate,
            notes: args.notes,
            ingredients: args.ingredients,
            description: args.description,
            instructions: args.instructions,
            servings: args.servings,
            prepTime: args.prepTime,
            cookTime: args.cookTime,
            servingsOverride: args.servingsOverride,
            recipeId: args.recipeId,
          });

          await this.recordMealAction(args.chatSessionId, {
            actionType: "update-meal",
            summary: `Updated ${updated.name}`,
            forwardOps: [
              {
                op: "update",
                id: updated.id,
                patch: {
                  name: updated.name,
                  mealType: updated.mealType,
                  date: updated.date,
                  notes: updated.notes,
                  ingredients: updated.ingredients,
                  description: updated.description,
                  instructions: updated.instructions,
                  servings: updated.servings,
                  prepTime: updated.prepTime,
                  cookTime: updated.cookTime,
                  servingsOverride: updated.servingsOverride,
                  recipeId: updated.recipeId,
                },
              },
            ],
            inverseOps: [
              {
                op: "update",
                id: before.id,
                patch: {
                  name: before.name,
                  mealType: before.mealType,
                  date: before.date,
                  notes: before.notes,
                  ingredients: before.ingredients,
                  description: before.description,
                  instructions: before.instructions,
                  servings: before.servings,
                  prepTime: before.prepTime,
                  cookTime: before.cookTime,
                  servingsOverride: before.servingsOverride,
                  recipeId: before.recipeId,
                },
              },
            ],
          });

          return { success: true, meal: updated };
        },
      }),
      defineTool("delete_meal", {
        description: "Delete a meal by id.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            chatSessionId: { type: "string" },
          },
          required: ["id"],
        },
        handler: async (rawArgs) => {
          const args = deleteMealArgsSchema.parse(rawArgs);
          const before = await this.mealService.getMeal(args.id);
          if (!before) {
            return { success: false, message: "Meal not found." };
          }
          await this.mealService.deleteMeal(args.id);

          await this.recordMealAction(args.chatSessionId, {
            actionType: "delete-meal",
            summary: `Deleted ${before.name}`,
            forwardOps: [{ op: "delete", id: before.id }],
            inverseOps: [
              {
                op: "create",
                meal: {
                  id: before.id,
                  name: before.name,
                  date: before.date,
                  mealType: before.mealType,
                  notes: before.notes,
                  ingredients: before.ingredients,
                  description: before.description,
                  instructions: before.instructions,
                  servings: before.servings,
                  prepTime: before.prepTime,
                  cookTime: before.cookTime,
                  servingsOverride: before.servingsOverride,
                  recipeId: before.recipeId,
                },
              },
            ],
          });

          return { success: true, id: before.id };
        },
      }),
      defineTool("move_meal", {
        description: "Move a meal to a new date.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            toDate: { type: "string" },
            chatSessionId: { type: "string" },
          },
          required: ["id", "toDate"],
        },
        handler: async (rawArgs) => {
          const args = moveMealArgsSchema.parse(rawArgs);
          const before = await this.mealService.getMeal(args.id);
          if (!before) {
            return { success: false, message: "Meal not found." };
          }
          const targetDate = resolveToolDate(args.toDate);
          const resolvedMealType = await this.resolveToolMealType(
            before.mealType,
            targetDate
          );
          const updated = await this.mealService.updateMeal(args.id, {
            date: targetDate,
            mealType: resolvedMealType.mealType,
            mealTypeDefinitionId: resolvedMealType.mealTypeDefinitionId,
          });

          await this.recordMealAction(args.chatSessionId, {
            actionType: "move-meal",
            summary: `Moved ${updated.name}`,
            forwardOps: [{ op: "update", id: updated.id, patch: { date: updated.date } }],
            inverseOps: [{ op: "update", id: before.id, patch: { date: before.date } }],
          });

          return { success: true, meal: updated };
        },
      }),
      defineTool("replace_meal", {
        description: "Replace the name of a meal.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            chatSessionId: { type: "string" },
          },
          required: ["id", "name"],
        },
        handler: async (rawArgs) => {
          const args = replaceMealArgsSchema.parse(rawArgs);
          const before = await this.mealService.getMeal(args.id);
          if (!before) {
            return { success: false, message: "Meal not found." };
          }
          const updated = await this.mealService.updateMeal(args.id, {
            name: args.name,
          });

          await this.recordMealAction(args.chatSessionId, {
            actionType: "replace-meal",
            summary: `Replaced ${before.name} with ${updated.name}`,
            forwardOps: [{ op: "update", id: updated.id, patch: { name: updated.name } }],
            inverseOps: [{ op: "update", id: before.id, patch: { name: before.name } }],
          });

          return { success: true, meal: updated };
        },
      }),
      defineTool("remove_meal", {
        description: "Alias of delete_meal.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            chatSessionId: { type: "string" },
          },
          required: ["id"],
        },
        handler: async (rawArgs) => {
          const args = deleteMealArgsSchema.parse(rawArgs);
          const before = await this.mealService.getMeal(args.id);
          if (!before) {
            return { success: false, message: "Meal not found." };
          }
          await this.mealService.deleteMeal(args.id);

          await this.recordMealAction(args.chatSessionId, {
            actionType: "remove-meal",
            summary: `Removed ${before.name}`,
            forwardOps: [{ op: "delete", id: before.id }],
            inverseOps: [
              {
                op: "create",
                meal: {
                  id: before.id,
                  name: before.name,
                  date: before.date,
                  mealType: before.mealType,
                  notes: before.notes,
                  ingredients: before.ingredients,
                  description: before.description,
                  instructions: before.instructions,
                  servings: before.servings,
                  prepTime: before.prepTime,
                  cookTime: before.cookTime,
                  servingsOverride: before.servingsOverride,
                  recipeId: before.recipeId,
                },
              },
            ],
          });

          return { success: true, id: before.id };
        },
      }),
      defineTool("suggest_meals", {
        description: "Create pending meal suggestions for a chat session.",
        parameters: {
          type: "object",
          properties: {
            chatSessionId: { type: "string" },
            count: { type: "number" },
          },
          required: ["chatSessionId"],
        },
        handler: async (rawArgs) => {
          const args = suggestMealsArgsSchema.parse(rawArgs);
          const ownerId = await this.resolveChatOwnerId(args.chatSessionId);
          const preferredMealType = await this.mealTypeService.getSuggestedPlanningMealType(
            new Date()
          );
          const pool = [
            "Lemon Herb Chicken Bowls",
            "Creamy Tomato Pasta",
            "Miso Glazed Salmon",
            "Black Bean Tacos",
            "Sheet Pan Sausage and Veg",
            "Coconut Curry Chickpeas",
            "Turkey Lettuce Wraps",
            "Garlic Butter Shrimp Rice",
          ];
          const picks = Array.from({ length: args.count }).map(
            (_, index) => pool[index % pool.length]
          );

          await Promise.all(
            picks.map((name, index) =>
              this.historyService.addPendingSuggestion({
                ownerId,
                chatSessionId: args.chatSessionId,
                domain: "meal",
                title: name,
                payloadJson: JSON.stringify({
                  name,
                  mealType: preferredMealType?.slug ?? "DINNER",
                  rank: index,
                }),
              })
            )
          );

          return {
            success: true,
            count: picks.length,
            suggestions: picks,
          };
        },
      }),
      defineTool("apply_pending_meals", {
        description: "Apply pending meal suggestions to upcoming nights.",
        parameters: {
          type: "object",
          properties: {
            chatSessionId: { type: "string" },
            count: { type: "number" },
            nights: { type: "number" },
          },
          required: ["chatSessionId", "count"],
        },
        handler: async (rawArgs) => {
          const args = applyPendingMealsArgsSchema.parse(rawArgs);
          const ownerId = await this.resolveChatOwnerId(args.chatSessionId);
          const count = Math.max(1, Math.min(args.count, args.nights ?? args.count));
          const suggestions = (
            await this.historyService.listPendingSuggestions(
              ownerId,
              args.chatSessionId
            )
          )
            .filter((entry) => entry.domain === "meal")
            .slice(0, count)
            .reverse();

          if (suggestions.length < count) {
            return {
              success: false,
              message: `Only found ${suggestions.length} pending suggestions.`,
            };
          }

          const dates = nextNights(count);
          const createdMeals = [] as Awaited<ReturnType<MealService["createMeal"]>>[];
          for (let index = 0; index < count; index += 1) {
            const payload = JSON.parse(suggestions[index].payloadJson) as {
              name: string;
              mealType?: MealTypeValue;
            };
            const resolvedMealType = await this.resolveToolMealType(
              payload.mealType ?? "DINNER",
              dates[index]
            );
            const created = await this.mealService.createMeal({
              name: payload.name,
              date: dates[index],
              mealType: resolvedMealType.mealType,
              mealTypeDefinitionId: resolvedMealType.mealTypeDefinitionId,
              notes: null,
              ingredients: [] as MealIngredient[],
            });
            createdMeals.push(created);
          }

          await this.recordMealAction(args.chatSessionId, {
            actionType: "apply-pending-suggestions",
            summary: `Added ${createdMeals.length} dinners from suggestions`,
            forwardOps: createdMeals.map((meal) => ({
              op: "create",
              meal: {
                id: meal.id,
                name: meal.name,
                date: meal.date,
                mealType: meal.mealType,
                notes: meal.notes,
                ingredients: meal.ingredients,
                description: meal.description,
                instructions: meal.instructions,
                servings: meal.servings,
                prepTime: meal.prepTime,
                cookTime: meal.cookTime,
                servingsOverride: meal.servingsOverride,
                recipeId: meal.recipeId,
              },
            })),
            inverseOps: createdMeals.map((meal) => ({ op: "delete", id: meal.id })),
          });

          return { success: true, count: createdMeals.length, meals: createdMeals };
        },
      }),
      defineTool("list_grocery_lists", {
        description: "List grocery lists.",
        parameters: { type: "object", properties: {} },
        handler: async () => {
          const lists = await this.groceryService.listGroceryLists();
          return { count: lists.length, lists };
        },
      }),
      defineTool("get_current_grocery_list", {
        description: "Get current grocery list.",
        parameters: { type: "object", properties: {} },
        handler: async () => ({
          list: await this.groceryService.getCurrentGroceryList(),
        }),
      }),
      defineTool("get_grocery_list", {
        description: "Get grocery list by id.",
        parameters: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        handler: async (rawArgs) => {
          const args = getByIdArgsSchema.parse(rawArgs);
          return { list: await this.groceryService.getGroceryList(args.id) };
        },
      }),
      defineTool("create_grocery_list", {
        description: "Create a grocery list.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            date: { type: "string" },
            favourite: { type: "boolean" },
          },
          required: ["name"],
        },
        handler: async (rawArgs) => {
          const args = createGroceryListArgsSchema.parse(rawArgs);
          const list = await this.groceryService.createGroceryList({
            name: args.name,
            date: args.date,
            favourite: args.favourite,
          });
          return { success: true, list };
        },
      }),
      defineTool("update_grocery_list", {
        description: "Update grocery list metadata.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            date: { type: "string" },
            favourite: { type: "boolean" },
          },
          required: ["id"],
        },
        handler: async (rawArgs) => {
          const args = updateGroceryListArgsSchema.parse(rawArgs);
          const before = await this.groceryService.getGroceryList(args.id);
          const list = await this.groceryService.updateGroceryList(args.id, {
            name: args.name,
            date: args.date,
            favourite: args.favourite,
          });
          await this.recordGrocerySnapshotAction(undefined, {
            actionType: "update-list",
            summary: `Updated list ${list.name}`,
            before,
            after: list,
          });
          return { success: true, list };
        },
      }),
      defineTool("delete_grocery_list", {
        description: "Delete a grocery list.",
        parameters: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        handler: async (rawArgs) => {
          const args = getByIdArgsSchema.parse(rawArgs);
          const result = await this.groceryService.deleteGroceryList(args.id);
          return { success: true, ...result };
        },
      }),
      defineTool("add_grocery_item", {
        description: "Add an item to a grocery list.",
        parameters: {
          type: "object",
          properties: {
            groceryListId: { type: "string" },
            name: { type: "string" },
            qty: { type: "string" },
            unit: { type: "string" },
            category: { type: "string" },
            notes: { type: "string" },
            meal: { type: "string" },
            checked: { type: "boolean" },
            chatSessionId: { type: "string" },
          },
          required: ["groceryListId", "name"],
        },
        handler: async (rawArgs) => {
          const args = addGroceryItemArgsSchema.parse(rawArgs);
          const before = await this.groceryService.getGroceryList(args.groceryListId);
          const list = await this.groceryService.createGroceryItem(args.groceryListId, {
            name: args.name,
            qty: args.qty,
            unit: args.unit,
            category: args.category,
            notes: args.notes,
            meal: args.meal,
            checked: args.checked,
          });
          await this.recordGrocerySnapshotAction(args.chatSessionId, {
            actionType: "add-item",
            summary: `Added ${args.name}`,
            before,
            after: list,
          });
          return { success: true, list };
        },
      }),
      defineTool("update_grocery_item", {
        description: "Update an item in a grocery list.",
        parameters: {
          type: "object",
          properties: {
            groceryListId: { type: "string" },
            itemId: { type: "string" },
            name: { type: "string" },
            qty: { type: ["string", "null"] },
            unit: { type: ["string", "null"] },
            category: { type: "string" },
            notes: { type: ["string", "null"] },
            meal: { type: ["string", "null"] },
            checked: { type: "boolean" },
            chatSessionId: { type: "string" },
          },
          required: ["groceryListId", "itemId"],
        },
        handler: async (rawArgs) => {
          const args = updateGroceryItemArgsSchema.parse(rawArgs);
          const before = await this.groceryService.getGroceryList(args.groceryListId);
          const list = await this.groceryService.updateGroceryItem(args.groceryListId, args.itemId, {
            name: args.name,
            qty: args.qty,
            unit: args.unit,
            category: args.category,
            notes: args.notes,
            meal: args.meal,
            checked: args.checked,
          });
          await this.recordGrocerySnapshotAction(args.chatSessionId, {
            actionType: "update-item",
            summary: `Updated item ${args.itemId}`,
            before,
            after: list,
          });
          return { success: true, list };
        },
      }),
      defineTool("delete_grocery_item", {
        description: "Delete an item from a grocery list.",
        parameters: {
          type: "object",
          properties: {
            groceryListId: { type: "string" },
            itemId: { type: "string" },
            chatSessionId: { type: "string" },
          },
          required: ["groceryListId", "itemId"],
        },
        handler: async (rawArgs) => {
          const args = deleteGroceryItemArgsSchema.parse(rawArgs);
          const before = await this.groceryService.getGroceryList(args.groceryListId);
          const list = await this.groceryService.deleteGroceryItem(args.groceryListId, args.itemId);
          await this.recordGrocerySnapshotAction(args.chatSessionId, {
            actionType: "delete-item",
            summary: `Deleted item ${args.itemId}`,
            before,
            after: list,
          });
          return { success: true, list };
        },
      }),
      defineTool("reorder_grocery_items", {
        description: "Reorder grocery items by id list.",
        parameters: {
          type: "object",
          properties: {
            groceryListId: { type: "string" },
            itemIds: { type: "array", items: { type: "string" } },
            chatSessionId: { type: "string" },
          },
          required: ["groceryListId", "itemIds"],
        },
        handler: async (rawArgs) => {
          const args = reorderGroceryItemsArgsSchema.parse(rawArgs);
          const before = await this.groceryService.getGroceryList(args.groceryListId);
          const list = await this.groceryService.reorderGroceryItems(args.groceryListId, args.itemIds);
          await this.recordGrocerySnapshotAction(args.chatSessionId, {
            actionType: "reorder-items",
            summary: `Reordered ${args.itemIds.length} items`,
            before,
            after: list,
          });
          return { success: true, list };
        },
      }),
      defineTool("undo_action", {
        description: "Undo most recent action in meal or grocery domain.",
        parameters: {
          type: "object",
          properties: {
            chatSessionId: { type: "string" },
            domain: { type: "string", enum: ["meal", "grocery"] },
          },
          required: ["chatSessionId"],
        },
        handler: async (rawArgs) => {
          const args = undoRedoArgsSchema.parse(rawArgs);
          return this.undoAction(args.chatSessionId, args.domain);
        },
      }),
      defineTool("redo_action", {
        description: "Redo most recently undone action in meal or grocery domain.",
        parameters: {
          type: "object",
          properties: {
            chatSessionId: { type: "string" },
            domain: { type: "string", enum: ["meal", "grocery"] },
          },
          required: ["chatSessionId"],
        },
        handler: async (rawArgs) => {
          const args = undoRedoArgsSchema.parse(rawArgs);
          return this.redoAction(args.chatSessionId, args.domain);
        },
      }),
      defineTool("get_preferences", {
        description: "Get user preferences.",
        parameters: { type: "object", properties: {} },
        handler: async () => ({ preferences: await this.preferenceService.getPreferences() }),
      }),
      defineTool("update_preferences", {
        description: "Update user preferences.",
        parameters: {
          type: "object",
          properties: {
            patch: { type: "object" },
          },
          required: ["patch"],
        },
        handler: async (rawArgs) => {
          const args = updatePreferencesArgsSchema.parse(rawArgs);
          return {
            preferences: await this.preferenceService.updatePreferences(args.patch),
          };
        },
      }),
      defineTool("list_recipes", {
        description: "List recipes with optional filters.",
        parameters: {
          type: "object",
          properties: {
            origin: { type: "string", enum: ["manual", "imported", "ai_generated"] },
            tags: { type: "array", items: { type: "string" } },
            difficulty: { type: "string" },
            maxCookTime: { type: "number" },
            favourite: { type: "boolean" },
            rating: { type: "number" },
          },
        },
        handler: async (rawArgs) => {
          const args = listRecipesArgsSchema.parse(rawArgs);
          const recipes = await this.recipeService.listRecipes(args);
          return { count: recipes.length, recipes };
        },
      }),
      defineTool("get_recipe", {
        description: "Get recipe by id.",
        parameters: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        handler: async (rawArgs) => {
          const args = getByIdArgsSchema.parse(rawArgs);
          return { recipe: await this.recipeService.getRecipe(args.id) };
        },
      }),
      defineTool("save_recipe", {
        description: "Save a recipe to the recipe book.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: ["string", "null"] },
            servings: { type: "number" },
            prepTime: { type: ["number", "null"] },
            cookTime: { type: ["number", "null"] },
            difficulty: { type: ["string", "null"] },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: ["number", "null"] },
                  unit: { type: ["string", "null"] },
                  notes: { type: ["string", "null"] },
                },
                required: ["name"],
              },
            },
            instructions: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["title"],
        },
        handler: async (rawArgs) => {
          const args = saveRecipeArgsSchema.parse(rawArgs);
          const recipe = await this.recipeService.createRecipe({
            title: args.title,
            description: args.description ?? null,
            servings: args.servings ?? 2,
            prepTime: args.prepTime ?? null,
            cookTime: args.cookTime ?? null,
            difficulty: args.difficulty ?? null,
            ingredients: args.ingredients.map((ingredient, index) => ({
              name: ingredient.name,
              quantity: ingredient.quantity ?? null,
              unit: ingredient.unit ?? null,
              notes: ingredient.notes ?? null,
              order: index,
            })),
            instructions: args.instructions.length > 0 ? args.instructions : ["Follow recipe steps."],
            tags: args.tags,
            origin: "ai_generated",
          });
          return { success: true, recipe };
        },
      }),
      defineTool("delete_recipe", {
        description: "Delete recipe by id.",
        parameters: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        handler: async (rawArgs) => {
          const args = getByIdArgsSchema.parse(rawArgs);
          await this.recipeService.deleteRecipe(args.id);
          return { success: true, id: args.id };
        },
      }),
    ];
  }

  private async buildSessionConfig(
    extraContext?: string,
    reasoningEffort?: ReasoningEffort
  ) {
    const context = await this.buildContext();
    const systemMessage = buildSystemPrompt({ ...context, extraContext });
    const mcpServers = this.parseMcpServers();

    return {
      model: getModel(),
      configDir: CONFIG_DIR,
      streaming: true,
      ...(reasoningEffort ? { reasoningEffort } : {}),
      availableTools: ALLOWED_TOOLS,
      tools: this.buildTools(context),
      systemMessage: { content: systemMessage },
      onPermissionRequest: (request: { kind: string }) => {
        if (request.kind === "custom-tool") {
          return { kind: "approved" as const };
        }
        return { kind: "denied-by-rules" as const, rules: [] };
      },
      onUserInputRequest: (
        request: UserInputRequest,
        invocation: { sessionId: string }
      ) => {
        const encoder = new TextEncoder();
        const state = this.sessionState.get(invocation.sessionId);
        const sentinel = JSON.stringify({
          type: "input_request",
          question: request.question,
          choices: request.choices ?? [],
          allowFreeform: request.allowFreeform ?? true,
        });

        if (state?.writer) {
          state.writer
            .write(encoder.encode(`${SENTINEL_PREFIX}${sentinel}\n`))
            .catch(() => {});
        }

        return new Promise<{ answer: string; wasFreeform: boolean }>(
          (resolve) => {
            this.sessionState.set(invocation.sessionId, {
              ...state,
              pendingInputResolve: resolve,
            });
          }
        );
      },
      hooks: {
        onPreToolUse: async (input: { toolName: string }) => {
          console.log(`[CopilotChef] onPreToolUse: ${input.toolName}`);
          if (ALLOWED_TOOLS.includes(input.toolName)) {
            return { permissionDecision: "allow" as const };
          }
          console.warn(`[CopilotChef] Denied unknown tool: ${input.toolName}`);
          return { permissionDecision: "deny" as const };
        },
        onPostToolUse: async (input: {
          toolName: string;
          toolResult: unknown;
        }, invocation?: { sessionId: string }) => {
          console.log(
            `[CopilotChef] onPostToolUse: ${input.toolName}`,
            input.toolResult
          );

          const domain = MUTATION_TOOL_DOMAINS[input.toolName];
          if (domain) {
            const sessionId = invocation?.sessionId ?? this.getActiveStreamingSessionId();
            this.emitSentinel(sessionId, {
              type: "domain_update",
              domain,
              toolName: input.toolName,
              toolResult: this.toSerializableToolResult(input.toolResult),
            });
          }
        },
        onErrorOccurred: async (input: {
          errorContext: string;
          error: unknown;
        }) => {
          console.error(
            `[CopilotChef] Error in ${input.errorContext}: ${input.error}`
          );
          return { errorHandling: "abort" as const };
        },
        onSessionEnd: async (
          _input: unknown,
          invocation: { sessionId: string }
        ) => {
          this.sessionState.delete(invocation.sessionId);
        },
      },
      ...(mcpServers ? { mcpServers } : {}),
    };
  }

  private async createCopilotSession(
    extraContext?: string,
    reasoningEffort?: ReasoningEffort
  ): Promise<CopilotSession> {
    ensureConfigDir();
    const client = await getClient();
    const config = await this.buildSessionConfig(extraContext, reasoningEffort);
    return client.createSession(config);
  }

  private async ensureSession(
    sessionId?: string,
    extraContext?: string,
    reasoningEffort?: ReasoningEffort
  ): Promise<{ session: CopilotSession; sessionId: string }> {
    if (sessionId) {
      const existing = this.sessions.get(sessionId);
      if (existing) {
        return { session: existing, sessionId };
      }

      // Phase D — try to resume a persisted SDK session
      try {
        const client = await getClient();
        const config = await this.buildSessionConfig(extraContext, reasoningEffort);
        const session = await client.resumeSession(sessionId, config);
        this.sessions.set(session.sessionId, session);
        return { session, sessionId: session.sessionId };
      } catch {
        // SDK session no longer exists — fall through to create a new one
        console.warn(
          `[CopilotChef] Could not resume session ${sessionId}, creating new`
        );
      }
    }

    // Create a new SDK session — this is the lazy init point.
    const session = await this.createCopilotSession(
      extraContext,
      reasoningEffort
    );
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
    pageContext?: string,
    reasoningEffort?: ReasoningEffort
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
    const { session, sessionId: activeId } = await this.ensureSession(
      sessionId,
      undefined,
      reasoningEffort
    );
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

    // Phase A — real delta streaming via TransformStream
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();

    // Store writer in sessionState so onUserInputRequest can inject sentinels
    this.sessionState.set(activeId, {
      ...this.sessionState.get(activeId),
      writer,
    });

    // Wire up event-driven streaming
    const unsubDelta = session.on(
      "assistant.message_delta",
      (event: { data: { deltaContent: string } }) => {
        const chunk = event.data.deltaContent;
        if (chunk) {
          writer.write(encoder.encode(chunk)).catch(() => {});
        }
      }
    );

    const unsubTurnEnd = session.on("assistant.turn_end", () => {
      cleanup();
    });

    const unsubError = session.on(
      "session.error",
      (event: { data: { message: string } }) => {
        console.error("[CopilotChef] session.error:", event.data.message);
        cleanup(new Error(event.data.message));
      }
    );

    let cleaned = false;
    const cleanup = (error?: Error) => {
      if (cleaned) return;
      cleaned = true;
      unsubDelta();
      unsubTurnEnd();
      unsubError();
      const state = this.sessionState.get(activeId);
      if (state?.writer === writer) {
        this.sessionState.set(activeId, { ...state, writer: undefined });
      }
      if (error) {
        writer.abort(error).catch(() => {});
      } else {
        writer.close().catch(() => {});
      }
    };

    // Fire-and-forget: send the prompt — streaming events handle output
    session.send({ prompt }).catch((err: unknown) => {
      cleanup(err instanceof Error ? err : new Error(String(err)));
    });

    return { sessionId: activeId, stream: readable };
  }

  // ---------------------------------------------------------------------------
  // Phase B — resolve a pending onUserInputRequest
  // ---------------------------------------------------------------------------

  resolveInputRequest(
    sessionId: string,
    answer: string,
    wasFreeform: boolean
  ) {
    const state = this.sessionState.get(sessionId);
    if (!state?.pendingInputResolve) {
      throw new Error(`No pending input request for session ${sessionId}`);
    }
    state.pendingInputResolve({ answer, wasFreeform });
    this.sessionState.set(sessionId, {
      ...state,
      pendingInputResolve: undefined,
    });
  }

  /** Remove a session from memory. */
  async endSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.disconnect();
      } catch {
        // best-effort
      }
    }
    this.sessions.delete(sessionId);
    this.sessionState.delete(sessionId);
    return { sessionId, endedAt: new Date().toISOString() };
  }
}
