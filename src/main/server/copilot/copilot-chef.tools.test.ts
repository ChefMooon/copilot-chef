import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@github/copilot-sdk", () => ({
  defineTool: (name: string, config: Record<string, unknown>) => ({
    name,
    ...config,
  }),
}));

import { CopilotChef } from "./copilot-chef";

type ToolDefinition = {
  name: string;
  handler: (rawArgs: unknown) => Promise<unknown>;
};

function createBasePreferences() {
  const now = new Date("2026-03-18T12:00:00.000Z").toISOString();
  return {
    id: "default",
    createdAt: now,
    updatedAt: now,
    householdSize: 2,
    cookingLength: "weeknight",
    dietaryTags: [],
    favoriteCuisines: [],
    avoidCuisines: [],
    avoidIngredients: [],
    pantryStaples: [],
    planningNotes: "",
    nutritionTags: [],
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
    reasoningEffort: "medium",
  };
}

function createServices() {
  const mealService = {
    createMeal: vi.fn(),
    listMealsInRange: vi.fn().mockResolvedValue([]),
    getMeal: vi.fn(),
    updateMeal: vi.fn(),
    deleteMeal: vi.fn().mockResolvedValue({ id: "deleted" }),
  };

  const groceryService = {
    listGroceryLists: vi.fn().mockResolvedValue([]),
    getCurrentGroceryList: vi.fn().mockResolvedValue(null),
    getGroceryList: vi.fn(),
    createGroceryList: vi.fn(),
    updateGroceryList: vi.fn(),
    deleteGroceryList: vi.fn().mockResolvedValue({ id: "list-1" }),
    createGroceryItem: vi.fn(),
    updateGroceryItem: vi.fn(),
    deleteGroceryItem: vi.fn(),
    reorderGroceryItems: vi.fn(),
    restoreGroceryListSnapshot: vi.fn(),
  };

  const historyService = {
    getSessionOwnerId: vi.fn().mockResolvedValue("web-default"),
    recordAction: vi.fn(),
    getLatestUndoAction: vi.fn(),
    getLatestRedoAction: vi.fn(),
    markActionUndone: vi.fn(),
    markActionRedone: vi.fn(),
    addPendingSuggestion: vi.fn(),
    listPendingSuggestions: vi.fn().mockResolvedValue([]),
  };

  const preferenceService = {
    getPreferences: vi.fn().mockResolvedValue(createBasePreferences()),
    updatePreferences: vi.fn(),
  };

  const personaService = {
    findById: vi.fn().mockResolvedValue(null),
  };

  const recipeService = {
    listRecipes: vi.fn().mockResolvedValue([]),
    getRecipe: vi.fn(),
    createRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
  };

  return {
    mealService,
    groceryService,
    historyService,
    preferenceService,
    personaService,
    recipeService,
  };
}

function createChef() {
  const services = createServices();
  const chef = new CopilotChef(
    services.mealService as never,
    services.groceryService as never,
    services.historyService as never,
    services.preferenceService as never,
    services.personaService as never,
    services.recipeService as never
  );

  return { chef, services };
}

function getToolMap(chef: CopilotChef) {
  const tools = ((chef as unknown as { buildTools: () => ToolDefinition[] }).buildTools()) as ToolDefinition[];
  return new Map(tools.map((tool) => [tool.name, tool]));
}

describe("CopilotChef SDK tool handlers", () => {
  const eggIngredient = [
    {
      name: "eggs",
      quantity: "2",
      unit: null,
      group: null,
      notes: null,
      order: 0,
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T12:00:00.000Z"));
  });

  it("create_meal creates a meal and records history", async () => {
    const { chef, services } = createChef();
    services.mealService.createMeal.mockResolvedValue({
      id: "meal-1",
      name: "Pancakes",
      date: "2026-03-19T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: eggIngredient,
    });

    const tool = getToolMap(chef).get("create_meal");
    const result = await tool?.handler({
      name: "Pancakes",
      mealType: "BREAKFAST",
      date: "tomorrow",
      ingredients: eggIngredient,
      chatSessionId: "chat-1",
    });

    expect(services.mealService.createMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Pancakes",
        mealType: "BREAKFAST",
        ingredients: eggIngredient,
        date: expect.stringContaining("2026-03-19"),
      })
    );
    expect(services.historyService.recordAction).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true });
  });

  it("create_meal normalizes date-only input to noon UTC", async () => {
    const { chef, services } = createChef();
    services.mealService.createMeal.mockResolvedValue({
      id: "meal-2",
      name: "Lemon Ricotta Pancakes",
      date: "2026-03-20T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: [],
    });

    const tool = getToolMap(chef).get("create_meal");
    await tool?.handler({
      name: "Lemon Ricotta Pancakes",
      mealType: "BREAKFAST",
      date: "2026-03-20",
      ingredients: [],
      chatSessionId: "chat-1",
    });

    expect(services.mealService.createMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-20T12:00:00.000Z",
      })
    );
  });

  it("create_meal normalizes midnight UTC ISO input to noon UTC", async () => {
    const { chef, services } = createChef();
    services.mealService.createMeal.mockResolvedValue({
      id: "meal-3",
      name: "Lemon Ricotta Pancakes",
      date: "2026-03-20T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: [],
    });

    const tool = getToolMap(chef).get("create_meal");
    await tool?.handler({
      name: "Lemon Ricotta Pancakes",
      mealType: "BREAKFAST",
      date: "2026-03-20T00:00:00.000Z",
      ingredients: [],
      chatSessionId: "chat-1",
    });

    expect(services.mealService.createMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-20T12:00:00.000Z",
      })
    );
  });

  it("list_meals returns meals for explicit range", async () => {
    const { chef, services } = createChef();
    services.mealService.listMealsInRange.mockResolvedValue([{ id: "meal-1" }]);

    const tool = getToolMap(chef).get("list_meals");
    const result = await tool?.handler({
      from: "2026-03-17T00:00:00.000Z",
      to: "2026-03-24T00:00:00.000Z",
    });

    expect(services.mealService.listMealsInRange).toHaveBeenCalledWith(
      "2026-03-17T00:00:00.000Z",
      "2026-03-24T00:00:00.000Z"
    );
    expect(result).toMatchObject({ count: 1 });
  });

  it("get_meal returns a meal by id", async () => {
    const { chef, services } = createChef();
    services.mealService.getMeal.mockResolvedValue({ id: "meal-1", name: "Toast" });

    const result = await getToolMap(chef).get("get_meal")?.handler({ id: "meal-1" });

    expect(services.mealService.getMeal).toHaveBeenCalledWith("meal-1");
    expect(result).toMatchObject({ success: true, meal: { id: "meal-1" } });
  });

  it("update_meal updates a meal and records inverse patch", async () => {
    const { chef, services } = createChef();
    services.mealService.getMeal.mockResolvedValue({
      id: "meal-1",
      name: "Toast",
      date: "2026-03-18T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: [],
    });
    services.mealService.updateMeal.mockResolvedValue({
      id: "meal-1",
      name: "Avocado Toast",
      date: "2026-03-18T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: [],
    });

    const result = await getToolMap(chef).get("update_meal")?.handler({
      id: "meal-1",
      name: "Avocado Toast",
      chatSessionId: "chat-1",
    });

    expect(services.mealService.updateMeal).toHaveBeenCalledWith(
      "meal-1",
      expect.objectContaining({ name: "Avocado Toast" })
    );
    expect(services.historyService.recordAction).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true });
  });

  it("delete_meal deletes a meal and records undo data", async () => {
    const { chef, services } = createChef();
    services.mealService.getMeal.mockResolvedValue({
      id: "meal-1",
      name: "Toast",
      date: "2026-03-18T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: [],
    });

    const result = await getToolMap(chef).get("delete_meal")?.handler({
      id: "meal-1",
      chatSessionId: "chat-1",
    });

    expect(services.mealService.deleteMeal).toHaveBeenCalledWith("meal-1");
    expect(services.historyService.recordAction).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, id: "meal-1" });
  });

  it("move_meal resolves natural dates", async () => {
    const { chef, services } = createChef();
    services.mealService.getMeal.mockResolvedValue({
      id: "meal-1",
      name: "Toast",
      date: "2026-03-18T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: [],
    });
    services.mealService.updateMeal.mockResolvedValue({
      id: "meal-1",
      name: "Toast",
      date: "2026-03-19T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: [],
    });

    const result = await getToolMap(chef).get("move_meal")?.handler({
      id: "meal-1",
      toDate: "tomorrow",
      chatSessionId: "chat-1",
    });

    expect(services.mealService.updateMeal).toHaveBeenCalledWith(
      "meal-1",
      expect.objectContaining({ date: expect.stringContaining("2026-03-19") })
    );
    expect(result).toMatchObject({ success: true });
  });

  it("replace_meal renames a meal", async () => {
    const { chef, services } = createChef();
    services.mealService.getMeal.mockResolvedValue({
      id: "meal-1",
      name: "Toast",
      date: "2026-03-18T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: [],
    });
    services.mealService.updateMeal.mockResolvedValue({
      id: "meal-1",
      name: "Bagel",
      date: "2026-03-18T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: [],
    });

    const result = await getToolMap(chef).get("replace_meal")?.handler({
      id: "meal-1",
      name: "Bagel",
      chatSessionId: "chat-1",
    });

    expect(services.mealService.updateMeal).toHaveBeenCalledWith(
      "meal-1",
      { name: "Bagel" }
    );
    expect(result).toMatchObject({ success: true });
  });

  it("remove_meal removes a meal", async () => {
    const { chef, services } = createChef();
    services.mealService.getMeal.mockResolvedValue({
      id: "meal-1",
      name: "Toast",
      date: "2026-03-18T12:00:00.000Z",
      mealType: "BREAKFAST",
      notes: null,
      ingredients: [],
    });

    const result = await getToolMap(chef).get("remove_meal")?.handler({
      id: "meal-1",
      chatSessionId: "chat-1",
    });

    expect(services.mealService.deleteMeal).toHaveBeenCalledWith("meal-1");
    expect(result).toMatchObject({ success: true, id: "meal-1" });
  });

  it("suggest_meals stores pending suggestions", async () => {
    const { chef, services } = createChef();

    const result = await getToolMap(chef).get("suggest_meals")?.handler({
      chatSessionId: "chat-1",
      count: 3,
    });

    expect(services.historyService.addPendingSuggestion).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ success: true, count: 3 });
  });

  it("apply_pending_meals creates upcoming meals from pending suggestions", async () => {
    const { chef, services } = createChef();
    services.historyService.listPendingSuggestions.mockResolvedValue([
      {
        domain: "meal",
        payloadJson: JSON.stringify({ name: "Soup", mealType: "DINNER" }),
      },
      {
        domain: "meal",
        payloadJson: JSON.stringify({ name: "Tacos", mealType: "DINNER" }),
      },
    ]);
    services.mealService.createMeal
      .mockResolvedValueOnce({
        id: "meal-1",
        name: "Soup",
        date: "2026-03-18T12:00:00.000Z",
        mealType: "DINNER",
        notes: null,
        ingredients: [],
      })
      .mockResolvedValueOnce({
        id: "meal-2",
        name: "Tacos",
        date: "2026-03-19T12:00:00.000Z",
        mealType: "DINNER",
        notes: null,
        ingredients: [],
      });

    const result = await getToolMap(chef).get("apply_pending_meals")?.handler({
      chatSessionId: "chat-1",
      count: 2,
    });

    expect(services.mealService.createMeal).toHaveBeenCalledTimes(2);
    expect(services.historyService.recordAction).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, count: 2 });
  });

  it("list_grocery_lists returns lists", async () => {
    const { chef, services } = createChef();
    services.groceryService.listGroceryLists.mockResolvedValue([{ id: "list-1" }]);

    const result = await getToolMap(chef).get("list_grocery_lists")?.handler({});

    expect(services.groceryService.listGroceryLists).toHaveBeenCalled();
    expect(result).toMatchObject({ count: 1 });
  });

  it("get_current_grocery_list returns the current list", async () => {
    const { chef, services } = createChef();
    services.groceryService.getCurrentGroceryList.mockResolvedValue({ id: "list-1" });

    const result = await getToolMap(chef).get("get_current_grocery_list")?.handler({});

    expect(result).toMatchObject({ list: { id: "list-1" } });
  });

  it("get_grocery_list returns a list by id", async () => {
    const { chef, services } = createChef();
    services.groceryService.getGroceryList.mockResolvedValue({ id: "list-1" });

    const result = await getToolMap(chef).get("get_grocery_list")?.handler({ id: "list-1" });

    expect(services.groceryService.getGroceryList).toHaveBeenCalledWith("list-1");
    expect(result).toMatchObject({ list: { id: "list-1" } });
  });

  it("create_grocery_list creates a list", async () => {
    const { chef, services } = createChef();
    services.groceryService.createGroceryList.mockResolvedValue({ id: "list-1", name: "Weekly" });

    const result = await getToolMap(chef).get("create_grocery_list")?.handler({ name: "Weekly" });

    expect(services.groceryService.createGroceryList).toHaveBeenCalledWith({
      name: "Weekly",
      date: undefined,
      favourite: undefined,
    });
    expect(result).toMatchObject({ success: true, list: { id: "list-1" } });
  });

  it("update_grocery_list updates a list", async () => {
    const { chef, services } = createChef();
    services.groceryService.getGroceryList.mockResolvedValue({
      id: "list-1",
      name: "Weekly",
      date: "2026-03-18T12:00:00.000Z",
      favourite: false,
      items: [],
    });
    services.groceryService.updateGroceryList.mockResolvedValue({ id: "list-1", name: "Updated" });

    const result = await getToolMap(chef).get("update_grocery_list")?.handler({
      id: "list-1",
      name: "Updated",
    });

    expect(services.groceryService.updateGroceryList).toHaveBeenCalledWith("list-1", {
      name: "Updated",
      date: undefined,
      favourite: undefined,
    });
    expect(result).toMatchObject({ success: true });
  });

  it("delete_grocery_list deletes a list", async () => {
    const { chef, services } = createChef();

    const result = await getToolMap(chef).get("delete_grocery_list")?.handler({ id: "list-1" });

    expect(services.groceryService.deleteGroceryList).toHaveBeenCalledWith("list-1");
    expect(result).toMatchObject({ success: true, id: "list-1" });
  });

  it("add_grocery_item adds an item", async () => {
    const { chef, services } = createChef();
    services.groceryService.getGroceryList.mockResolvedValue({
      id: "list-1",
      name: "Weekly",
      date: "2026-03-18T12:00:00.000Z",
      favourite: false,
      items: [],
    });
    services.groceryService.createGroceryItem.mockResolvedValue({ id: "list-1", items: [{ id: "item-1" }] });

    const result = await getToolMap(chef).get("add_grocery_item")?.handler({
      groceryListId: "list-1",
      name: "Milk",
      chatSessionId: "chat-1",
    });

    expect(services.groceryService.createGroceryItem).toHaveBeenCalledWith(
      "list-1",
      expect.objectContaining({ name: "Milk" })
    );
    expect(result).toMatchObject({ success: true });
  });

  it("update_grocery_item updates an item", async () => {
    const { chef, services } = createChef();
    services.groceryService.getGroceryList.mockResolvedValue({
      id: "list-1",
      name: "Weekly",
      date: "2026-03-18T12:00:00.000Z",
      favourite: false,
      items: [{ id: "item-1", name: "Milk", qty: null, unit: null, category: "Other", notes: null, meal: null, checked: false, sortOrder: 0 }],
    });
    services.groceryService.updateGroceryItem.mockResolvedValue({
      id: "list-1",
      name: "Weekly",
      date: "2026-03-18T12:00:00.000Z",
      favourite: false,
      items: [{ id: "item-1", name: "Milk", qty: "2", unit: null, category: "Other", notes: null, meal: null, checked: false, sortOrder: 0 }],
    });

    const result = await getToolMap(chef).get("update_grocery_item")?.handler({
      groceryListId: "list-1",
      itemId: "item-1",
      qty: "2",
      chatSessionId: "chat-1",
    });

    expect(services.groceryService.updateGroceryItem).toHaveBeenCalledWith(
      "list-1",
      "item-1",
      expect.objectContaining({ qty: "2" })
    );
    expect(result).toMatchObject({ success: true });
  });

  it("delete_grocery_item deletes an item", async () => {
    const { chef, services } = createChef();
    services.groceryService.getGroceryList.mockResolvedValue({
      id: "list-1",
      name: "Weekly",
      date: "2026-03-18T12:00:00.000Z",
      favourite: false,
      items: [{ id: "item-1", name: "Milk", qty: null, unit: null, category: "Other", notes: null, meal: null, checked: false, sortOrder: 0 }],
    });
    services.groceryService.deleteGroceryItem.mockResolvedValue({
      id: "list-1",
      name: "Weekly",
      date: "2026-03-18T12:00:00.000Z",
      favourite: false,
      items: [],
    });

    const result = await getToolMap(chef).get("delete_grocery_item")?.handler({
      groceryListId: "list-1",
      itemId: "item-1",
      chatSessionId: "chat-1",
    });

    expect(services.groceryService.deleteGroceryItem).toHaveBeenCalledWith("list-1", "item-1");
    expect(result).toMatchObject({ success: true });
  });

  it("reorder_grocery_items reorders items", async () => {
    const { chef, services } = createChef();
    services.groceryService.getGroceryList.mockResolvedValue({
      id: "list-1",
      name: "Weekly",
      date: "2026-03-18T12:00:00.000Z",
      favourite: false,
      items: [
        { id: "item-1", name: "Milk", qty: null, unit: null, category: "Other", notes: null, meal: null, checked: false, sortOrder: 0 },
        { id: "item-2", name: "Eggs", qty: null, unit: null, category: "Other", notes: null, meal: null, checked: false, sortOrder: 1 },
      ],
    });
    services.groceryService.reorderGroceryItems.mockResolvedValue({
      id: "list-1",
      name: "Weekly",
      date: "2026-03-18T12:00:00.000Z",
      favourite: false,
      items: [
        { id: "item-2", name: "Eggs", qty: null, unit: null, category: "Other", notes: null, meal: null, checked: false, sortOrder: 0 },
        { id: "item-1", name: "Milk", qty: null, unit: null, category: "Other", notes: null, meal: null, checked: false, sortOrder: 1 },
      ],
    });

    const result = await getToolMap(chef).get("reorder_grocery_items")?.handler({
      groceryListId: "list-1",
      itemIds: ["item-2", "item-1"],
      chatSessionId: "chat-1",
    });

    expect(services.groceryService.reorderGroceryItems).toHaveBeenCalledWith("list-1", ["item-2", "item-1"]);
    expect(result).toMatchObject({ success: true });
  });

  it("undo_action replays the inverse action", async () => {
    const { chef, services } = createChef();
    services.historyService.getLatestUndoAction.mockResolvedValue({
      id: "action-1",
      domain: "meal",
      actionType: "delete-meal",
      summary: "Deleted Toast",
      inverseJson: JSON.stringify({
        ops: [
          {
            op: "create",
            meal: {
              id: "meal-1",
              name: "Toast",
              date: "2026-03-18T12:00:00.000Z",
              mealType: "BREAKFAST",
              notes: null,
              ingredients: [],
            },
          },
        ],
      }),
    });
    services.mealService.getMeal.mockResolvedValue(null);
    services.mealService.createMeal.mockResolvedValue({ id: "meal-1" });

    const result = await getToolMap(chef).get("undo_action")?.handler({
      chatSessionId: "chat-1",
      domain: "meal",
    });

    expect(services.historyService.markActionUndone).toHaveBeenCalledWith(
      "web-default",
      "action-1"
    );
    expect(result).toMatchObject({ success: true, domain: "meal" });
  });

  it("redo_action reapplies a grocery snapshot", async () => {
    const { chef, services } = createChef();
    services.historyService.getLatestRedoAction.mockResolvedValue({
      id: "action-1",
      domain: "grocery",
      actionType: "update-item",
      summary: "Updated Milk",
      forwardJson: JSON.stringify({
        snapshot: {
          id: "list-1",
          name: "Weekly",
          date: "2026-03-18T12:00:00.000Z",
          favourite: false,
          items: [],
        },
      }),
    });
    services.groceryService.restoreGroceryListSnapshot.mockResolvedValue({ id: "list-1" });

    const result = await getToolMap(chef).get("redo_action")?.handler({
      chatSessionId: "chat-1",
      domain: "grocery",
    });

    expect(services.historyService.markActionRedone).toHaveBeenCalledWith(
      "web-default",
      "action-1"
    );
    expect(result).toMatchObject({ success: true, domain: "grocery" });
  });

  it("get_preferences returns preferences", async () => {
    const { chef, services } = createChef();

    const result = await getToolMap(chef).get("get_preferences")?.handler({});

    expect(services.preferenceService.getPreferences).toHaveBeenCalled();
    expect(result).toMatchObject({ preferences: { chefPersona: "coach" } });
  });

  it("update_preferences applies a patch", async () => {
    const { chef, services } = createChef();
    services.preferenceService.updatePreferences.mockResolvedValue({ replyLength: "concise" });

    const result = await getToolMap(chef).get("update_preferences")?.handler({
      patch: { replyLength: "concise", reasoningEffort: "high" },
    });

    expect(services.preferenceService.updatePreferences).toHaveBeenCalledWith({
      replyLength: "concise",
      reasoningEffort: "high",
    });
    expect(result).toMatchObject({ preferences: { replyLength: "concise" } });
  });

  it("list_recipes returns filtered recipes", async () => {
    const { chef, services } = createChef();
    services.recipeService.listRecipes.mockResolvedValue([{ id: "recipe-1" }]);

    const result = await getToolMap(chef).get("list_recipes")?.handler({
      tags: ["breakfast"],
      maxCookTime: 20,
    });

    expect(services.recipeService.listRecipes).toHaveBeenCalledWith({
      tags: ["breakfast"],
      maxCookTime: 20,
    });
    expect(result).toMatchObject({ count: 1 });
  });

  it("get_recipe returns a recipe by id", async () => {
    const { chef, services } = createChef();
    services.recipeService.getRecipe.mockResolvedValue({ id: "recipe-1", title: "Omelet" });

    const result = await getToolMap(chef).get("get_recipe")?.handler({ id: "recipe-1" });

    expect(services.recipeService.getRecipe).toHaveBeenCalledWith("recipe-1");
    expect(result).toMatchObject({ recipe: { id: "recipe-1" } });
  });

  it("save_recipe saves an AI-generated recipe", async () => {
    const { chef, services } = createChef();
    services.recipeService.createRecipe.mockResolvedValue({ id: "recipe-1", title: "Omelet" });

    const result = await getToolMap(chef).get("save_recipe")?.handler({
      title: "Omelet",
      ingredients: [{ name: "Eggs" }],
      instructions: ["Whisk eggs", "Cook in pan"],
      tags: ["breakfast"],
    });

    expect(services.recipeService.createRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Omelet",
        origin: "ai_generated",
        tags: ["breakfast"],
      })
    );
    expect(result).toMatchObject({ success: true, recipe: { id: "recipe-1" } });
  });

  it("delete_recipe deletes a recipe", async () => {
    const { chef, services } = createChef();

    const result = await getToolMap(chef).get("delete_recipe")?.handler({ id: "recipe-1" });

    expect(services.recipeService.deleteRecipe).toHaveBeenCalledWith("recipe-1");
    expect(result).toMatchObject({ success: true, id: "recipe-1" });
  });

  it("session config preserves ask_user flow and full tool availability", async () => {
    const { chef } = createChef();
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const stateMap = (chef as unknown as {
      sessionState: Map<string, { writer?: { write: (chunk: Uint8Array) => Promise<void> } }>;
    }).sessionState;
    stateMap.set("session-1", { writer });

    const config = await (chef as unknown as {
      buildSessionConfig: (extraContext?: string, reasoningEffort?: string) => Promise<Record<string, unknown>>;
    }).buildSessionConfig(undefined, "high");

    expect(Array.isArray(config.availableTools)).toBe(true);
    expect(config.availableTools).toEqual(
      expect.arrayContaining(["create_meal", "save_recipe", "redo_action", "ask_user"])
    );

    const pending = (config.onUserInputRequest as (
      request: { question: string; choices?: string[]; allowFreeform?: boolean },
      invocation: { sessionId: string }
    ) => Promise<{ answer: string; wasFreeform: boolean }>)({
      question: "Which breakfast?",
      choices: ["Toast", "Bagel"],
      allowFreeform: true,
    }, { sessionId: "session-1" });

    expect(writer.write).toHaveBeenCalled();
    chef.resolveInputRequest("session-1", "Bagel", false);
    await expect(pending).resolves.toEqual({ answer: "Bagel", wasFreeform: false });
  });
});
