import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const syncStateMock = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({ prisma: { syncState: syncStateMock } }));

import {
  changeEventBus,
  publishCommittedChange,
  type ChangeEvent,
} from "./change-event-bus";
import { DataManagementService } from "./data-management-service";
import { MealService } from "./meal-service";
import { PrepListService } from "./prep-list-service";
import {
  GroceryService,
  MealSubTypeService,
  MealTypeService,
  PreferenceService,
  RecipeService,
} from "../core-index";

describe("ChangeEventBus", () => {
  let events: ChangeEvent[];
  let unsubscribe: (() => void) | undefined;

  beforeEach(() => {
    events = [];
    unsubscribe = changeEventBus.subscribe((event) => events.push(event));
  });

  afterEach(() => {
    unsubscribe?.();
    vi.restoreAllMocks();
  });

  it("shares exactly one bus instance across all service construction paths", async () => {
    // Legacy fallback constructions (no injected dependencies).
    const mealService = new MealService();
    const prepListService = new PrepListService();
    const dataManagementService = new DataManagementService();

    // Internal fallbacks inside factories must also resolve to the singleton.
    const prepWithInjected = new PrepListService({ mealService });
    const dataWithInjected = new DataManagementService({
      mealService,
      recipeService: new RecipeService(),
      groceryService: new GroceryService(),
      prepListService,
      mealTypeService: new MealTypeService(),
      mealSubTypeService: new MealSubTypeService(),
      preferenceService: new PreferenceService(),
    });

    expect((prepWithInjected as unknown as { mealService: MealService }).mealService).toBe(
      mealService
    );
    expect(dataManagementService).toBeDefined();
    expect(dataWithInjected).toBeDefined();

    // The bus is a module-level singleton — every importer sees the same object.
    const again = await import("./change-event-bus");
    expect(again.changeEventBus).toBe(changeEventBus);
  });

  it("delivers typed envelopes to subscribers", () => {
    changeEventBus.emit({ entity: "recipe", action: "create", id: "r1", revision: 1 });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      entity: "recipe",
      action: "create",
      id: "r1",
      revision: 1,
    });
  });

  it("keeps the watermark monotonic even when older revisions are re-emitted", () => {
    changeEventBus.setRevision(10);
    changeEventBus.emit({ entity: "meal", action: "update", revision: 5 });
    changeEventBus.setRevision(3);

    expect(changeEventBus.revision).toBe(10);
  });

  it("rejects non-finite revisions", () => {
    expect(() =>
      changeEventBus.emit({
        entity: "meal",
        action: "update",
        revision: Number.NaN,
      })
    ).toThrow(/finite/);
  });

  it("publishCommittedChange bumps the persisted revision and emits after commit", async () => {
    syncStateMock.findUnique.mockResolvedValue({ value: "41" });
    syncStateMock.upsert.mockImplementation(
      async ({ update }: { update: { value: string } }) => update
    );

    const revision = await publishCommittedChange("groceryList", "update", "g1");

    expect(revision).toBe(42);
    expect(syncStateMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "sync.revision" } })
    );
    expect(events.at(-1)).toMatchObject({
      entity: "groceryList",
      action: "update",
      id: "g1",
      revision: 42,
    });
  });

  it("treats a lower observed persisted revision as recoverable (monotonic watermark)", async () => {
    // Simulate crash-between-commit-and-emit recovery: persisted counter reset.
    syncStateMock.findUnique.mockResolvedValue(null);
    syncStateMock.upsert.mockImplementation(
      async ({ create }: { create: { key: string; value: string } }) => create
    );

    changeEventBus.setRevision(100);
    const revision = await publishCommittedChange("preference", "bulk");

    expect(revision).toBe(1);
    // The in-memory watermark stays high so clients comparing revisions see
    // "unknown" (lower served revision) and sweep rather than ignoring changes.
    expect(changeEventBus.revision).toBeGreaterThanOrEqual(100);
  });
});
