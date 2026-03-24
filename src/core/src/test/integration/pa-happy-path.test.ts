/**
 * E3 PA happy-path integration tests.
 *
 * Tests CopilotChef, all domain services, and ChatHistoryService against a
 * real SQLite database (temp file created by global-setup.ts).  The Copilot
 * SDK client is mocked so no real AI process is needed.
 *
 * Coverage:
 *   Group A — Session lifecycle (chat, endSession, cold-start resume)
 *   Group B — Meal tool handlers (create, undo, redo via direct handler calls)
 *   Group C — Recipe save tool handler
 *   Group D — ChatHistoryService message persistence
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mock function references so the vi.mock factory can close over them
// ---------------------------------------------------------------------------
const { createSessionMock, resumeSessionMock } = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  resumeSessionMock: vi.fn(),
}));

// Mock the Copilot SDK — defineTool must return an object that includes handler
vi.mock("@github/copilot-sdk", () => ({
  defineTool: (name: string, config: Record<string, unknown>) => ({
    name,
    ...config,
  }),
}));

// Mock copilot-client so no real SDK subprocess is launched
vi.mock("../../lib/copilot-client", () => ({
  getClient: vi.fn().mockResolvedValue({
    getState: vi.fn().mockReturnValue("connected"),
    createSession: createSessionMock,
    resumeSession: resumeSessionMock,
  }),
}));

// ---------------------------------------------------------------------------
// Real service + class imports (after mocks are hoisted)
// ---------------------------------------------------------------------------
import { CopilotChef } from "../../copilot/copilot-chef";
import { ChatHistoryService } from "../../services/chat-history-service";
import { GroceryService } from "../../services/grocery-service";
import { MealService } from "../../services/meal-service";
import { PersonaService } from "../../services/persona-service";
import { PreferenceService } from "../../services/preference-service";
import { RecipeService } from "../../services/recipe-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ToolDefinition = {
  name: string;
  handler: (rawArgs: unknown) => Promise<unknown>;
};

function getToolMap(c: CopilotChef) {
  const tools = (
    (c as unknown as { buildTools: () => ToolDefinition[] }).buildTools()
  ) as ToolDefinition[];
  return new Map(tools.map((t) => [t.name, t]));
}

function makeMockSession(id: string) {
  const handlers = new Map<string, (event: unknown) => void>();
  return {
    sessionId: id,
    on: vi.fn().mockImplementation(
      (event: string, handler: (e: unknown) => void) => {
        handlers.set(event, handler);
        return () => handlers.delete(event);
      }
    ),
    send: vi.fn().mockImplementation(async () => {
      handlers.get("assistant.turn_end")?.({});
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendAndWait: vi.fn().mockResolvedValue({ data: { content: "" } }),
  };
}

// ---------------------------------------------------------------------------
// Group A — Session lifecycle
// ---------------------------------------------------------------------------

describe("Group A — Session lifecycle", () => {
  let chef: CopilotChef;
  let historyService: ChatHistoryService;

  /** Persisted across tests A1 → A3 */
  let savedChatSessionId: string;
  let savedCopilotSessionId: string;

  beforeAll(() => {
    historyService = new ChatHistoryService();
    chef = new CopilotChef(
      new MealService(),
      new GroceryService(),
      historyService,
      new PreferenceService(),
      new PersonaService(),
      new RecipeService()
    );
  });

  beforeEach(() => {
    createSessionMock.mockReset();
    resumeSessionMock.mockReset();
  });

  it("E3-1: chat() returns sessionId that can be persisted to DB", async () => {
    const mockSession = makeMockSession("sdk-e3-a1");
    createSessionMock.mockResolvedValue(mockSession);

    // Simulates what the chat route does: create a session record first
    const chatSession = await historyService.createSession("e3-owner-a", "E3 Session A");
    savedChatSessionId = chatSession.id;

    const result = await chef.chat("plan my week");

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect("stream" in result).toBe(true);
    if (!("stream" in result)) throw new Error("Expected stream");

    savedCopilotSessionId = result.sessionId;

    // Simulate what the route does: persist the mapping
    await historyService.setCopilotSessionId(
      "e3-owner-a",
      savedChatSessionId,
      savedCopilotSessionId
    );

    const stored = await historyService.getCopilotSessionId(
      "e3-owner-a",
      savedChatSessionId
    );
    expect(stored).toBe(savedCopilotSessionId);
  });

  it("E3-2: endSession() followed by clearCopilotSessionId nulls the DB mapping", async () => {
    await chef.endSession(savedCopilotSessionId);
    await historyService.clearCopilotSessionId("e3-owner-a", savedChatSessionId);

    const cleared = await historyService.getCopilotSessionId(
      "e3-owner-a",
      savedChatSessionId
    );
    expect(cleared).toBeNull();
  });

  it("E3-3: cold-start resume calls resumeSession with the persisted copilotSessionId", async () => {
    // Re-map a fresh session to have a non-null copilotSessionId in DB
    const setupSession = makeMockSession("sdk-e3-setup");
    createSessionMock.mockResolvedValue(setupSession);

    const chatSession = await historyService.createSession("e3-owner-a", "Cold Resume Session");
    const setupResult = await chef.chat("hello");
    if (!("stream" in setupResult)) throw new Error("Expected stream");

    await historyService.setCopilotSessionId(
      "e3-owner-a",
      chatSession.id,
      setupResult.sessionId
    );

    createSessionMock.mockReset();

    // Create a brand-new CopilotChef — empty sessions Map simulates process restart
    const coldChef = new CopilotChef();
    const resumedSession = makeMockSession(setupResult.sessionId);
    resumeSessionMock.mockResolvedValue(resumedSession);

    await coldChef.chat("continue my last plan", setupResult.sessionId);

    expect(resumeSessionMock).toHaveBeenCalledTimes(1);
    expect(resumeSessionMock).toHaveBeenCalledWith(
      setupResult.sessionId,
      expect.objectContaining({ model: expect.any(String) })
    );
    expect(createSessionMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Group B — Meal domain tool handlers (direct invocation, real DB)
// ---------------------------------------------------------------------------

describe("Group B — Meal domain tools", () => {
  let chef: CopilotChef;
  let historyService: ChatHistoryService;
  let mealService: MealService;
  let toolChatSessionId: string;

  /** Meal ID created in E3-4, reused in E3-5 and E3-6 */
  let createdMealId: string;

  beforeAll(async () => {
    historyService = new ChatHistoryService();
    mealService = new MealService();
    chef = new CopilotChef(
      mealService,
      new GroceryService(),
      historyService,
      new PreferenceService(),
      new PersonaService(),
      new RecipeService()
    );

    const session = await historyService.createSession(
      "e3-owner-b",
      "Meal Tool Session"
    );
    toolChatSessionId = session.id;
  });

  it("E3-4: create_meal tool handler persists a meal to the database", async () => {
    const tools = getToolMap(chef);
    const createTool = tools.get("create_meal");
    expect(createTool).toBeDefined();

    const result = (await createTool!.handler({
      name: "E3 Pancakes",
      mealType: "BREAKFAST",
      date: "2026-03-25",
      ingredients: ["eggs", "flour"],
      chatSessionId: toolChatSessionId,
    })) as { success: boolean; meal: { id: string } };

    expect(result.success).toBe(true);
    expect(result.meal.id).toBeTruthy();

    createdMealId = result.meal.id;

    const fromDb = await mealService.getMeal(createdMealId);
    expect(fromDb).not.toBeNull();
    expect(fromDb?.name).toBe("E3 Pancakes");
    expect(fromDb?.mealType).toBe("BREAKFAST");
    expect(fromDb?.ingredients).toEqual(["eggs", "flour"]);
  });

  it("E3-5: undo_action tool handler deletes the meal and records undoneAt in DB", async () => {
    const tools = getToolMap(chef);
    const undoTool = tools.get("undo_action");
    expect(undoTool).toBeDefined();

    const result = (await undoTool!.handler({
      chatSessionId: toolChatSessionId,
      domain: "meal",
    })) as { success: boolean; actionId: string };

    expect(result.success).toBe(true);

    // Meal should be gone from the DB
    const gone = await mealService.getMeal(createdMealId);
    expect(gone).toBeNull();

    // The action record should be marked as undone
    const action = await historyService.getLatestRedoAction(
      "e3-owner-b",
      toolChatSessionId,
      "meal"
    );
    expect(action).not.toBeNull();
    expect(action?.id).toBe(result.actionId);
    expect(action?.undoneAt).toBeTruthy();
  });

  it("E3-6: redo_action tool handler restores the meal to the database", async () => {
    const tools = getToolMap(chef);
    const redoTool = tools.get("redo_action");
    expect(redoTool).toBeDefined();

    const result = (await redoTool!.handler({
      chatSessionId: toolChatSessionId,
      domain: "meal",
    })) as { success: boolean; actionId: string };

    expect(result.success).toBe(true);

    // Meal should be back in the DB with the same ID
    const restored = await mealService.getMeal(createdMealId);
    expect(restored).not.toBeNull();
    expect(restored?.name).toBe("E3 Pancakes");
  });
});

// ---------------------------------------------------------------------------
// Group C — Recipe save tool handler (real DB)
// ---------------------------------------------------------------------------

describe("Group C — Recipe save tool handler", () => {
  let chef: CopilotChef;
  let recipeService: RecipeService;

  beforeAll(() => {
    recipeService = new RecipeService();
    chef = new CopilotChef(
      new MealService(),
      new GroceryService(),
      new ChatHistoryService(),
      new PreferenceService(),
      new PersonaService(),
      recipeService
    );
  });

  it("E3-7: save_recipe tool handler persists a recipe to the database", async () => {
    const tools = getToolMap(chef);
    const saveTool = tools.get("save_recipe");
    expect(saveTool).toBeDefined();

    const result = (await saveTool!.handler({
      title: "E3 Integration Quiche",
      description: "A test recipe for integration verification.",
      servings: 4,
      prepTime: 15,
      cookTime: 35,
      difficulty: "easy",
      ingredients: [
        { name: "eggs", quantity: 4, unit: null, notes: null },
        { name: "cream", quantity: 200, unit: "ml", notes: null },
      ],
      instructions: ["Whisk eggs and cream.", "Bake at 180°C for 35 minutes."],
      tags: ["e3-test", "quiche"],
    })) as { success: boolean; recipe: { id: string; title: string } };

    expect(result.success).toBe(true);
    expect(result.recipe.id).toBeTruthy();

    const fromDb = await recipeService.getRecipe(result.recipe.id);
    expect(fromDb).not.toBeNull();
    expect(fromDb?.title).toBe("E3 Integration Quiche");
    expect(fromDb?.origin).toBe("ai_generated");
    expect(fromDb?.ingredients.length).toBe(2);
    expect(fromDb?.tags).toContain("e3-test");
  });
});

// ---------------------------------------------------------------------------
// Group D — ChatHistoryService message persistence (real DB)
// ---------------------------------------------------------------------------

describe("Group D — Message persistence", () => {
  let historyService: ChatHistoryService;

  beforeAll(() => {
    historyService = new ChatHistoryService();
  });

  it("E3-8: createSession + addMessage + getSession returns persisted messages", async () => {
    const session = await historyService.createSession(
      "e3-owner-d",
      "Message Persistence Test"
    );

    await historyService.addMessage("e3-owner-d", session.id, "user", "What should I cook?");
    await historyService.addMessage(
      "e3-owner-d",
      session.id,
      "assistant",
      "Try a simple pasta dish."
    );

    const full = await historyService.getSession("e3-owner-d", session.id);
    expect(full).not.toBeNull();
    expect(full?.messages.length).toBe(2);
    expect(full?.messages[0].role).toBe("user");
    expect(full?.messages[0].content).toBe("What should I cook?");
    expect(full?.messages[1].role).toBe("assistant");
    expect(full?.messages[1].content).toBe("Try a simple pasta dish.");
  });
});
