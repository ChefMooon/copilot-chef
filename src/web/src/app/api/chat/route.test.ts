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
  name: string;
  date: string;
  mealType: MealTypeValue;
  notes: string | null;
  ingredients: string[];
};

type MockGroceryList = {
  id: string;
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
  messages: Array<{
    chatSessionId: string;
    role: "user" | "assistant";
    content: string;
  }>;
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
    messages: [] as Array<{
      chatSessionId: string;
      role: "user" | "assistant";
      content: string;
    }>,
    preferences: { saveChatHistory: true },
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

    async addMessage(
      chatSessionId: string,
      role: "user" | "assistant",
      content: string
    ) {
      state.messages.push({ chatSessionId, role, content });
    }

    async recordAction(input: {
      ownerId?: string;
      chatSessionId: string;
      domain: "meal" | "grocery";
      actionType: string;
      summary: string;
      forwardJson: string;
      inverseJson: string;
    }) {
      // Redo branch is invalidated after any new action.
      state.actions = state.actions.filter(
        (action) =>
          !(
            action.chatSessionId === input.chatSessionId &&
            action.domain === input.domain &&
            action.undoneAt
          )
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

    async getLatestUndoAction(
      ownerId: string,
      chatSessionId: string,
      domain: "meal" | "grocery"
    ) {
      const action = [...state.actions]
        .reverse()
        .find(
          (entry) =>
            entry.chatSessionId === chatSessionId &&
            entry.domain === domain &&
            !entry.undoneAt
        );
      return action ?? null;
    }

    async getLatestRedoAction(
      ownerId: string,
      chatSessionId: string,
      domain: "meal" | "grocery"
    ) {
      const action = [...state.actions]
        .reverse()
        .find(
          (entry) =>
            entry.chatSessionId === chatSessionId &&
            entry.domain === domain &&
            !!entry.undoneAt
        );
      return action ?? null;
    }

    async markActionUndone(ownerId: string, actionId: string) {
      const action = state.actions.find((entry) => entry.id === actionId);
      if (action) {
        action.undoneAt = nowIso();
      }
    }

    async markActionRedone(ownerId: string, actionId: string) {
      const action = state.actions.find((entry) => entry.id === actionId);
      if (action) {
        action.undoneAt = null;
      }
    }

    async addPendingSuggestion(input: {
      ownerId?: string;
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

    async listPendingSuggestions(ownerId: string, chatSessionId: string) {
      const now = Date.now();
      return state.pending
        .filter((entry) => entry.chatSessionId === chatSessionId)
        .filter((entry) => new Date(entry.expiresAt).getTime() > now)
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime()
        );
    }

    async pruneExpiredPendingSuggestions() {
      const now = Date.now();
      state.pending = state.pending.filter(
        (entry) => new Date(entry.expiresAt).getTime() > now
      );
    }
  }

  class MealService {
    async createMeal(input: {
      id?: string;
      name: string;
      date: string;
      mealType: MealTypeValue;
      notes: string | null;
      ingredients: string[];
    }) {
      const id = input.id ?? nextId("meal");
      const meal: MockMeal = {
        id,
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
        ingredients: patch.ingredients
          ? [...patch.ingredients]
          : [...existing.ingredients],
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
      const nextItems = list.items.map((item) =>
        item.id === groceryItemId ? { ...item, ...patch } : item
      );
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
      const updated = {
        ...list,
        items: list.items.filter((item) => item.id !== groceryItemId),
      };
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
        .filter(
          (item): item is MockGroceryList["items"][number] => item !== null
        );
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

  function normalizeText(value: string) {
    return value.trim().toLowerCase();
  }

  function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function findMatchingItems<T extends { id: string; name: string }>(
    items: T[],
    phrase: string
  ) {
    const cleaned = normalizeText(phrase).replace(/^(the|a|an)\s+/, "");
    if (!cleaned) return [];
    const exact = items.filter((item) => normalizeText(item.name) === cleaned);
    if (exact.length > 0) return exact;
    return items.filter((item) => normalizeText(item.name).includes(cleaned));
  }

  function buildItemChoices<T extends { id: string; name: string }>(
    items: T[],
    promptBuilder: (name: string) => string
  ) {
    return items.slice(0, 6).map((item) => ({
      id: item.id,
      label: item.name,
      prompt: promptBuilder(item.name),
    }));
  }

  function resolveRelativeDate(input: string) {
    const today = new Date();
    const lower = normalizeText(input);
    const normalized = lower
      .replace(/[.!?,;:]+$/g, "")
      .replace(/^on\s+/, "")
      .replace(/^for\s+/, "");

    if (
      normalized === "today" ||
      normalized === "tonight" ||
      normalized === "this evening"
    ) {
      return today;
    }

    if (/^tomorrow(?:\s+(?:night|evening))?$/.test(normalized)) {
      const next = new Date(today);
      next.setDate(today.getDate() + 1);
      return next;
    }

    const weekDays = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const weekdayMatch = normalized.match(
      /^(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+(?:night|evening))?$/
    );
    const dayKey = weekdayMatch?.[1] ?? normalized;
    const dayIndex = weekDays.indexOf(dayKey);
    if (dayIndex >= 0) {
      const next = new Date(today);
      const delta = (dayIndex - today.getDay() + 7) % 7;
      next.setDate(today.getDate() + (delta === 0 ? 7 : delta));
      return next;
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function normalizeMealType(value: string): MealTypeValue | null {
    const lower = normalizeText(value).replace(/\s+/g, " ");
    if (lower === "breakfast") return "BREAKFAST";
    if (lower === "morning snack") return "MORNING_SNACK";
    if (lower === "lunch") return "LUNCH";
    if (lower === "afternoon snack") return "AFTERNOON_SNACK";
    if (lower === "dinner") return "DINNER";
    if (lower === "snack") return "SNACK";
    return null;
  }

  function formatMealType(type: MealTypeValue) {
    return type.toLowerCase().replace("_", " ");
  }

  function toWeekdayName(iso: string | null) {
    if (!iso) return "unscheduled";
    return new Date(iso).toLocaleDateString("en-US", { weekday: "long" });
  }

  function toDateLabel(iso: string | null) {
    return iso ? new Date(iso).toLocaleDateString() : "unscheduled";
  }

  function nextNights(count: number) {
    const today = new Date();
    const start = new Date(today);
    start.setHours(12, 0, 0, 0);
    const nights: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const next = new Date(start);
      next.setDate(start.getDate() + i);
      nights.push(next.toISOString());
    }
    return nights;
  }

  function snapshotFromList(list: MockGroceryList) {
    return cloneList(list);
  }

  function serializeMealOps(ops: unknown[]) {
    return JSON.stringify({ ops });
  }

  function parseMealOps(payloadJson: string) {
    const parsed = JSON.parse(payloadJson) as { ops?: unknown[] };
    return parsed.ops ?? [];
  }

  function serializeSnapshot(snapshot: MockGroceryList) {
    return JSON.stringify({ snapshot });
  }

  function parseSnapshot(payloadJson: string) {
    const parsed = JSON.parse(payloadJson) as { snapshot?: MockGroceryList };
    if (!parsed.snapshot) {
      throw new Error("Invalid action snapshot payload");
    }
    return parsed.snapshot;
  }

  return {
    CopilotChef,
    ChatHistoryService,
    PreferenceService,
    GroceryService,
    MealService,
    chatRequestSchema,
    normalizeText,
    escapeRegex,
    findMatchingItems,
    buildItemChoices,
    resolveRelativeDate,
    normalizeMealType,
    formatMealType,
    toWeekdayName,
    toDateLabel,
    nextNights,
    snapshotFromList,
    serializeMealOps,
    parseMealOps,
    serializeSnapshot,
    parseSnapshot,
    __resetMockState() {
      state.nextId = 1;
      state.sessions = [];
      state.actions = [];
      state.pending = [];
      state.messages = [];
      state.preferences = { saveChatHistory: true };
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
    process.env.COPILOT_CHAT_ROUTE_FALLBACK_FIRST = "1";
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

  it("accepts tonight and trailing punctuation in add commands", async () => {
    const tonight = await postJson({
      message: "add sloppy joes and tater tots for dinner tonight",
      pageContextData: { page: "meal-plan", meals: [] },
    });

    expect(tonight.json.action).toMatchObject({
      domain: "meal",
      type: "add-meal",
    });

    const punctuated = await postJson({
      message: "Add Grilled Cheese for lunch today.",
      pageContextData: { page: "meal-plan", meals: [] },
    });

    expect(punctuated.json.action).toMatchObject({
      domain: "meal",
      type: "add-meal",
    });

    const core = await getCoreMock();
    const state = core.__getMockState();
    expect(state.meals.size).toBe(2);
    const names = Array.from(state.meals.values()).map((meal) => meal.name);
    expect(names).toContain("sloppy joes and tater tots");
    expect(names).toContain("Grilled Cheese");
  });

  it("accepts tomorrow night and next weekday night phrases", async () => {
    const tomorrowNight = await postJson({
      message: "Add Tacos for dinner tomorrow night",
      pageContextData: { page: "meal-plan", meals: [] },
    });

    expect(tomorrowNight.json.action).toMatchObject({
      domain: "meal",
      type: "add-meal",
    });

    const nextWeekdayNight = await postJson({
      message: "Add Chili for dinner next tuesday night",
      pageContextData: { page: "meal-plan", meals: [] },
    });

    expect(nextWeekdayNight.json.action).toMatchObject({
      domain: "meal",
      type: "add-meal",
    });

    const core = await getCoreMock();
    const state = core.__getMockState();
    const meals = Array.from(state.meals.values());

    const tacos = meals.find((meal) => meal.name === "Tacos");
    const chili = meals.find((meal) => meal.name === "Chili");

    expect(tacos).toBeDefined();
    expect(chili).toBeDefined();
    expect(tacos?.mealType).toBe("DINNER");
    expect(chili?.mealType).toBe("DINNER");
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
    const movedDateIso = moved?.date
      ? new Date(moved.date).toISOString()
      : undefined;
    expect(movedDateIso).toBe(nextWeekdayIso("2026-03-14T12:00:00.000Z", 5));
  });

  it("replaces and removes meals from natural language commands", async () => {
    const core = await getCoreMock();
    const tuesdayIso = "2026-03-17T12:00:00.000Z";
    core.__seedMeal({
      id: "meal-dinner-1",
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

    expect(replace.json.action).toMatchObject({
      domain: "meal",
      type: "replace-meal",
    });
    expect(core.__getMockState().meals.get("meal-dinner-1")?.name).toBe(
      "Tacos"
    );

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

    expect(remove.json.action).toMatchObject({
      domain: "meal",
      type: "remove-meal",
    });
    expect(core.__getMockState().meals.has("meal-dinner-1")).toBe(false);
  });

  it("supports grocery item unit/category updates and manual reorder", async () => {
    const core = await getCoreMock();
    core.__seedGroceryList({
      id: "list-2",
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

    const unit = await postJson({
      message: "Set Milk unit to gallon",
      pageContextData,
    });
    expect(unit.json.action).toMatchObject({
      domain: "grocery",
      type: "update-item-unit",
    });

    const category = await postJson({
      message: "Move Milk to Produce category",
      pageContextData,
    });
    expect(category.json.action).toMatchObject({
      domain: "grocery",
      type: "update-item-category",
    });

    const reorder = await postJson({
      message: "Move Carrots to the top",
      pageContextData,
    });
    expect(reorder.json.action).toMatchObject({
      domain: "grocery",
      type: "manual-reorder",
    });

    const list = core.__getMockState().groceryLists.get("list-2");
    expect(list?.items[0].name).toBe("Carrots");
    expect(list?.items.find((item) => item.name === "Milk")?.unit).toBe(
      "gallon"
    );
    expect(list?.items.find((item) => item.name === "Milk")?.category).toBe(
      "Produce"
    );
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

    expect(apply.json.action).toMatchObject({
      domain: "meal",
      type: "apply-pending-suggestions",
    });

    const core = await getCoreMock();
    const state = core.__getMockState();
    expect(state.meals.size).toBe(3);
  });
});
