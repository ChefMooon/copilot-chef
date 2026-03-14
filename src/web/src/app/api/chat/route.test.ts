import { beforeEach, describe, expect, it, vi } from "vitest";

type MealTypeValue =
  | "BREAKFAST"
  | "MORNING_SNACK"
  | "LUNCH"
  | "AFTERNOON_SNACK"
  | "DINNER"
  | "SNACK";

type MockMeal = {
  id: string;
  mealPlanId: string | null;
  name: string;
  date: string;
  mealType: MealTypeValue;
  notes: string | null;
  ingredients: string[];
};

type MockGroceryList = {
  id: string;
  mealPlanId: string | null;
  name: string;
  date: string;
  favourite: boolean;
  items: Array<{
    id: string;
    name: string;
    qty: string | null;
    unit: string | null;
    category: string;
    notes: string | null;
    meal: string | null;
    checked: boolean;
    sortOrder: number;
  }>;
};

type MockAction = {
  id: string;
  chatSessionId: string;
  domain: "meal" | "grocery";
  actionType: string;
  summary: string;
  forwardJson: string;
  inverseJson: string;
  undoneAt: string | null;
};

type MockState = {
  meals: Map<string, MockMeal>;
  groceryLists: Map<string, MockGroceryList>;
  actions: MockAction[];
  messages: Array<{ chatSessionId: string; role: "user" | "assistant"; content: string }>;
};

type CoreMockModule = {
  __resetMockState: () => void;
  __seedMeal: (meal: MockMeal) => void;
  __seedGroceryList: (list: MockGroceryList) => void;
  __getMockState: () => MockState;
};

vi.mock("@copilot-chef/core", () => {
  const state = {
    nextId: 1,
    sessions: [] as Array<{ id: string; createdAt: string }>,
    actions: [] as MockAction[],
    pending: [] as Array<{
      id: string;
      chatSessionId: string;
      domain: "meal" | "grocery";
      title: string;
      payloadJson: string;
      createdAt: string;
      expiresAt: string;
    }>,
    messages: [] as Array<{ chatSessionId: string; role: "user" | "assistant"; content: string }>,
    preferences: { persistChatHistory: true },
    meals: new Map<string, MockMeal>(),
    groceryLists: new Map<string, MockGroceryList>(),
  };

  const nowIso = () => new Date().toISOString();
  const nextId = (prefix: string) => `${prefix}-${state.nextId++}`;

  function cloneMeal(meal: MockMeal): MockMeal {
    return {
      ...meal,
      ingredients: [...meal.ingredients],
    };
  }

  function cloneList(list: MockGroceryList): MockGroceryList {
    return {
      ...list,
      items: list.items.map((item) => ({ ...item })),
    };
  }

  class CopilotChef {
    async chat() {
      return {
        sessionId: "copilot-session",
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("mock response"));
            controller.close();
          },
        }),
      };
    }
  }

  class PreferenceService {
    async getPreferences() {
      return state.preferences;
    }
  }

  class ChatHistoryService {
    async createSession() {
      const session = { id: nextId("chat"), createdAt: nowIso() };
      state.sessions.push(session);
      return session;
    }

    async addMessage(chatSessionId: string, role: "user" | "assistant", content: string) {
      state.messages.push({ chatSessionId, role, content });
    }

    async recordAction(input: {
      chatSessionId: string;
      domain: "meal" | "grocery";
      actionType: string;
      summary: string;
      forwardJson: string;
      inverseJson: string;
    }) {
      // Redo branch is invalidated after any new action.
      state.actions = state.actions.filter(
        (action) => !(action.chatSessionId === input.chatSessionId && action.domain === input.domain && action.undoneAt)
      );
      const action: MockAction = {
        id: nextId("action"),
        chatSessionId: input.chatSessionId,
        domain: input.domain,
        actionType: input.actionType,
        summary: input.summary,
        forwardJson: input.forwardJson,
        inverseJson: input.inverseJson,
        undoneAt: null,
      };
      state.actions.push(action);
      return action;
    }

    async getLatestUndoAction(chatSessionId: string, domain: "meal" | "grocery") {
      const action = [...state.actions]
        .reverse()
        .find((entry) => entry.chatSessionId === chatSessionId && entry.domain === domain && !entry.undoneAt);
      return action ?? null;
    }

    async getLatestRedoAction(chatSessionId: string, domain: "meal" | "grocery") {
      const action = [...state.actions]
        .reverse()
        .find((entry) => entry.chatSessionId === chatSessionId && entry.domain === domain && !!entry.undoneAt);
      return action ?? null;
    }

    async markActionUndone(actionId: string) {
      const action = state.actions.find((entry) => entry.id === actionId);
      if (action) {
        action.undoneAt = nowIso();
      }
    }

    async markActionRedone(actionId: string) {
      const action = state.actions.find((entry) => entry.id === actionId);
      if (action) {
        action.undoneAt = null;
      }
    }

    async addPendingSuggestion(input: {
      chatSessionId: string;
      domain: "meal" | "grocery";
      title: string;
      payloadJson: string;
    }) {
      const createdAt = nowIso();
      const expires = new Date();
      expires.setDate(expires.getDate() + 14);
      state.pending.push({
        id: nextId("pending"),
        chatSessionId: input.chatSessionId,
        domain: input.domain,
        title: input.title,
        payloadJson: input.payloadJson,
        createdAt,
        expiresAt: expires.toISOString(),
      });
    }

    async listPendingSuggestions(chatSessionId: string) {
      const now = Date.now();
      return state.pending
        .filter((entry) => entry.chatSessionId === chatSessionId)
        .filter((entry) => new Date(entry.expiresAt).getTime() > now)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    }

    async pruneExpiredPendingSuggestions() {
      const now = Date.now();
      state.pending = state.pending.filter((entry) => new Date(entry.expiresAt).getTime() > now);
    }
  }

  class MealService {
    async createMeal(input: {
      id?: string;
      mealPlanId: string | null;
      name: string;
      date: string;
      mealType: MealTypeValue;
      notes: string | null;
      ingredients: string[];
    }) {
      const id = input.id ?? nextId("meal");
      const meal: MockMeal = {
        id,
        mealPlanId: input.mealPlanId,
        name: input.name,
        date: input.date,
        mealType: input.mealType,
        notes: input.notes,
        ingredients: [...input.ingredients],
      };
      state.meals.set(id, meal);
      return cloneMeal(meal);
    }

    async getMeal(id: string) {
      const meal = state.meals.get(id);
      return meal ? cloneMeal(meal) : null;
    }

    async updateMeal(
      id: string,
      patch: {
        mealPlanId?: string | null;
        name?: string;
        date?: string;
        mealType?: MealTypeValue;
        notes?: string | null;
        ingredients?: string[];
      }
    ) {
      const existing = state.meals.get(id);
      if (!existing) {
        throw new Error("Meal not found");
      }
      const updated: MockMeal = {
        ...existing,
        ...patch,
        ingredients: patch.ingredients ? [...patch.ingredients] : [...existing.ingredients],
      };
      state.meals.set(id, updated);
      return cloneMeal(updated);
    }

    async deleteMeal(id: string) {
      state.meals.delete(id);
    }
  }

  class GroceryService {
    async getGroceryList(id: string) {
      const list = state.groceryLists.get(id);
      return list ? cloneList(list) : null;
    }

    async updateGroceryItem(
      groceryListId: string,
      groceryItemId: string,
      patch: Partial<MockGroceryList["items"][number]>
    ) {
      const list = state.groceryLists.get(groceryListId);
      if (!list) {
        throw new Error("Grocery list not found");
      }
      const nextItems = list.items.map((item) => (item.id === groceryItemId ? { ...item, ...patch } : item));
      const updated = { ...list, items: nextItems };
      state.groceryLists.set(groceryListId, updated);
      return cloneList(updated);
    }

    async restoreGroceryListSnapshot(snapshot: MockGroceryList) {
      state.groceryLists.set(snapshot.id, cloneList(snapshot));
      const restored = state.groceryLists.get(snapshot.id);
      if (!restored) {
        throw new Error("Snapshot restore failed");
      }
      return cloneList(restored);
    }

    async createGroceryItem(groceryListId: string, input: { name: string }) {
      const list = state.groceryLists.get(groceryListId);
      if (!list) {
        throw new Error("Grocery list not found");
      }
      const item = {
        id: nextId("item"),
        name: input.name,
        qty: null,
        unit: null,
        category: "Other",
        notes: null,
        meal: null,
        checked: false,
        sortOrder: list.items.length,
      };
      const updated = { ...list, items: [...list.items, item] };
      state.groceryLists.set(groceryListId, updated);
      return cloneList(updated);
    }

    async deleteGroceryItem(groceryListId: string, groceryItemId: string) {
      const list = state.groceryLists.get(groceryListId);
      if (!list) {
        throw new Error("Grocery list not found");
      }
      const updated = { ...list, items: list.items.filter((item) => item.id !== groceryItemId) };
      state.groceryLists.set(groceryListId, updated);
      return cloneList(updated);
    }

    async updateGroceryList(
      groceryListId: string,
      patch: Partial<Pick<MockGroceryList, "name" | "date" | "favourite">>
    ) {
      const list = state.groceryLists.get(groceryListId);
      if (!list) {
        throw new Error("Grocery list not found");
      }
      const updated = { ...list, ...patch };
      state.groceryLists.set(groceryListId, updated);
      return cloneList(updated);
    }

    async reorderGroceryItems(groceryListId: string, orderedIds: string[]) {
      const list = state.groceryLists.get(groceryListId);
      if (!list) {
        throw new Error("Grocery list not found");
      }
      const byId = new Map(list.items.map((item) => [item.id, item]));
      const reordered = orderedIds
        .map((id, index) => {
          const item = byId.get(id);
          return item ? { ...item, sortOrder: index } : null;
        })
        .filter((item): item is MockGroceryList["items"][number] => item !== null);
      const updated = { ...list, items: reordered };
      state.groceryLists.set(groceryListId, updated);
      return cloneList(updated);
    }
  }

  const chatRequestSchema = {
    parse(input: unknown) {
      return input as {
        message: string;
        sessionId?: string;
        chatSessionId?: string;
        pageContext?: string;
        pageContextData?: unknown;
      };
    },
  };

  return {
    CopilotChef,
    ChatHistoryService,
    PreferenceService,
    GroceryService,
    MealService,
    chatRequestSchema,
    __resetMockState() {
      state.nextId = 1;
      state.sessions = [];
      state.actions = [];
      state.pending = [];
      state.messages = [];
      state.preferences = { persistChatHistory: true };
      state.meals = new Map();
      state.groceryLists = new Map();
    },
    __seedMeal(meal: MockMeal) {
      state.meals.set(meal.id, cloneMeal(meal));
    },
    __seedGroceryList(list: MockGroceryList) {
      state.groceryLists.set(list.id, cloneList(list));
    },
    __getMockState(): MockState {
      return {
        meals: state.meals,
        groceryLists: state.groceryLists,
        actions: state.actions,
        messages: state.messages,
      };
    },
  };
});

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getCoreMock() {
  return (await import("@copilot-chef/core")) as unknown as CoreMockModule;
}

async function postJson(body: Record<string, unknown>) {
  const route = await import("./route");
  const response = await route.POST(buildRequest(body));
  return {
    response,
    json: (await response.json()) as Record<string, unknown>,
  };
}

function nextWeekdayIso(startIso: string, weekday: number) {
  const start = new Date(startIso);
  const delta = (weekday - start.getUTCDay() + 7) % 7;
  const days = delta === 0 ? 7 : delta;
  const next = new Date(start);
  next.setUTCDate(start.getUTCDate() + days);
  return next.toISOString();
}

describe("POST /api/chat command actions", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T12:00:00.000Z"));
    const core = await getCoreMock();
    core.__resetMockState();
  });

  it("creates a meal from an add command", async () => {
    const { json } = await postJson({
      message: "Add Grilled Cheese for lunch today",
      pageContextData: { page: "meal-plan", meals: [] },
    });

    expect(json.action).toMatchObject({
      domain: "meal",
      type: "add-meal",
    });
    expect(String(json.message)).toContain("Added Grilled Cheese");

    const core = await getCoreMock();
    const state = core.__getMockState();
    expect(state.meals.size).toBe(1);
    const created = Array.from(state.meals.values())[0];
    expect(created.name).toBe("Grilled Cheese");
    expect(created.mealType).toBe("LUNCH");
  });

  it("undoes the previous meal action", async () => {
    const add = await postJson({
      message: "Add Grilled Cheese for lunch today",
      pageContextData: { page: "meal-plan", meals: [] },
    });

    const undo = await postJson({
      message: "Undo",
      chatSessionId: add.json.chatSessionId,
      pageContextData: { page: "meal-plan", meals: [] },
    });

    expect(undo.json.action).toMatchObject({
      domain: "meal",
      type: "undo",
    });

    const core = await getCoreMock();
    const state = core.__getMockState();
    expect(state.meals.size).toBe(0);
  });

  it("updates grocery item quantity from a set qty command", async () => {
    const core = await getCoreMock();
    core.__seedGroceryList({
      id: "list-1",
      mealPlanId: null,
      name: "Weekend",
      date: "2026-03-14T12:00:00.000Z",
      favourite: false,
      items: [
        {
          id: "item-1",
          name: "Tomatoes",
          qty: null,
          unit: null,
          category: "Produce",
          notes: null,
          meal: null,
          checked: false,
          sortOrder: 0,
        },
      ],
    });

    const { json } = await postJson({
      message: "Set Tomatoes qty to 3",
      pageContextData: {
        page: "grocery-list",
        activeList: {
          id: "list-1",
          mealPlanId: null,
          name: "Weekend",
          date: "2026-03-14T12:00:00.000Z",
          favourite: false,
          items: [
            {
              id: "item-1",
              name: "Tomatoes",
              qty: null,
              unit: null,
              category: "Produce",
              notes: null,
              meal: null,
              checked: false,
              sortOrder: 0,
            },
          ],
        },
        allLists: [
          {
            id: "list-1",
            name: "Weekend",
            date: "2026-03-14T12:00:00.000Z",
            favourite: false,
            itemCount: 1,
            checkedCount: 0,
          },
        ],
      },
    });

    expect(json.action).toMatchObject({
      domain: "grocery",
      type: "update-item-qty",
    });

    const state = core.__getMockState();
    const list = state.groceryLists.get("list-1");
    expect(list?.items[0].qty).toBe("3");
  });

  it("moves a meal by meal type and weekday", async () => {
    const core = await getCoreMock();
    const tuesdayIso = "2026-03-17T12:00:00.000Z";
    core.__seedMeal({
      id: "meal-lunch-1",
      mealPlanId: null,
      name: "Chicken Wrap",
      date: tuesdayIso,
      mealType: "LUNCH",
      notes: null,
      ingredients: [],
    });

    const { json } = await postJson({
      message: "Move lunch from Tuesday to Friday",
      pageContextData: {
        page: "meal-plan",
        meals: [
          {
            id: "meal-lunch-1",
            name: "Chicken Wrap",
            mealType: "LUNCH",
            date: tuesdayIso,
          },
        ],
      },
    });

    expect(json.action).toMatchObject({ domain: "meal", type: "move-meal" });
    const moved = core.__getMockState().meals.get("meal-lunch-1");
    expect(moved?.date).toBe(nextWeekdayIso("2026-03-14T12:00:00.000Z", 5));
  });

  it("replaces and removes meals from natural language commands", async () => {
    const core = await getCoreMock();
    const tuesdayIso = "2026-03-17T12:00:00.000Z";
    core.__seedMeal({
      id: "meal-dinner-1",
      mealPlanId: null,
      name: "Pasta",
      date: tuesdayIso,
      mealType: "DINNER",
      notes: null,
      ingredients: [],
    });

    const replace = await postJson({
      message: "Replace dinner on Tuesday with Tacos",
      pageContextData: {
        page: "meal-plan",
        meals: [
          {
            id: "meal-dinner-1",
            name: "Pasta",
            mealType: "DINNER",
            date: tuesdayIso,
          },
        ],
      },
    });

    expect(replace.json.action).toMatchObject({ domain: "meal", type: "replace-meal" });
    expect(core.__getMockState().meals.get("meal-dinner-1")?.name).toBe("Tacos");

    const remove = await postJson({
      message: "Remove dinner on Tuesday",
      pageContextData: {
        page: "meal-plan",
        meals: [
          {
            id: "meal-dinner-1",
            name: "Tacos",
            mealType: "DINNER",
            date: tuesdayIso,
          },
        ],
      },
    });

    expect(remove.json.action).toMatchObject({ domain: "meal", type: "remove-meal" });
    expect(core.__getMockState().meals.has("meal-dinner-1")).toBe(false);
  });

  it("supports grocery item unit/category updates and manual reorder", async () => {
    const core = await getCoreMock();
    core.__seedGroceryList({
      id: "list-2",
      mealPlanId: null,
      name: "Weekly",
      date: "2026-03-14T12:00:00.000Z",
      favourite: false,
      items: [
        {
          id: "item-a",
          name: "Milk",
          qty: "1",
          unit: "bottle",
          category: "Dairy",
          notes: null,
          meal: null,
          checked: false,
          sortOrder: 0,
        },
        {
          id: "item-b",
          name: "Carrots",
          qty: "2",
          unit: "lb",
          category: "Produce",
          notes: null,
          meal: null,
          checked: false,
          sortOrder: 1,
        },
      ],
    });

    const pageContextData = {
      page: "grocery-list",
      activeList: {
        id: "list-2",
        mealPlanId: null,
        name: "Weekly",
        date: "2026-03-14T12:00:00.000Z",
        favourite: false,
        items: [
          {
            id: "item-a",
            name: "Milk",
            qty: "1",
            unit: "bottle",
            category: "Dairy",
            notes: null,
            meal: null,
            checked: false,
            sortOrder: 0,
          },
          {
            id: "item-b",
            name: "Carrots",
            qty: "2",
            unit: "lb",
            category: "Produce",
            notes: null,
            meal: null,
            checked: false,
            sortOrder: 1,
          },
        ],
      },
      allLists: [
        {
          id: "list-2",
          name: "Weekly",
          date: "2026-03-14T12:00:00.000Z",
          favourite: false,
          itemCount: 2,
          checkedCount: 0,
        },
      ],
    };

    const unit = await postJson({ message: "Set Milk unit to gallon", pageContextData });
    expect(unit.json.action).toMatchObject({ domain: "grocery", type: "update-item-unit" });

    const category = await postJson({ message: "Move Milk to Produce category", pageContextData });
    expect(category.json.action).toMatchObject({ domain: "grocery", type: "update-item-category" });

    const reorder = await postJson({ message: "Move Carrots to the top", pageContextData });
    expect(reorder.json.action).toMatchObject({ domain: "grocery", type: "manual-reorder" });

    const list = core.__getMockState().groceryLists.get("list-2");
    expect(list?.items[0].name).toBe("Carrots");
    expect(list?.items.find((item) => item.name === "Milk")?.unit).toBe("gallon");
    expect(list?.items.find((item) => item.name === "Milk")?.category).toBe("Produce");
  });

  it("applies pending meal suggestions to next nights", async () => {
    const suggest = await postJson({
      message: "Suggest 3 meals",
      pageContextData: { page: "meal-plan", meals: [] },
    });

    const apply = await postJson({
      message: "Use the 3 meals we just planned for the next 3 nights dinner",
      chatSessionId: suggest.json.chatSessionId,
      pageContextData: { page: "meal-plan", meals: [] },
    });

    expect(apply.json.action).toMatchObject({ domain: "meal", type: "apply-pending-suggestions" });

    const core = await getCoreMock();
    const state = core.__getMockState();
    expect(state.meals.size).toBe(3);
  });
});
