// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import type { EditableMeal } from "@/lib/calendar";
import { setMealPlanDragPayload } from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";
import styles from "./meal-plan.module.css";

const profile: MealTypeProfilePayload = {
  id: "default-profile",
  name: "Default",
  color: "#3B5E45",
  description: "Everyday planning",
  isDefault: true,
  priority: 0,
  startDate: null,
  endDate: null,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
  mealTypes: [
    {
      id: "default-breakfast",
      profileId: "default-profile",
      name: "Breakfast",
      slug: "breakfast",
      color: "#E8885A",
      enabled: true,
      sortOrder: 0,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    {
      id: "default-dinner",
      profileId: "default-profile",
      name: "Dinner",
      slug: "dinner",
      color: "#3B5E45",
      enabled: true,
      sortOrder: 1,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  ],
};

const dayMeals: EditableMeal[] = [
  {
    id: "meal-a",
    name: "Morning Toast",
    date: new Date("2026-04-22T12:00:00"),
    type: "breakfast",
    mealTypeDefinitionId: "default-breakfast",
    mealTypeDefinition: profile.mealTypes[0],
    notes: "",
    ingredients: [],
    description: "",
    cuisine: null,
    instructions: [],
    servings: 1,
    prepTime: null,
    cookTime: null,
    servingsOverride: null,
    recipeId: null,
    linkedRecipe: null,
    sortOrder: 10,
  },
  {
    id: "meal-b",
    name: "Morning Oats",
    date: new Date("2026-04-22T12:00:00"),
    type: "breakfast",
    mealTypeDefinitionId: "default-breakfast",
    mealTypeDefinition: profile.mealTypes[0],
    notes: "",
    ingredients: [],
    description: "",
    cuisine: null,
    instructions: [],
    servings: 1,
    prepTime: null,
    cookTime: null,
    servingsOverride: null,
    recipeId: null,
    linkedRecipe: null,
    sortOrder: 20,
  },
  {
    id: "meal-c",
    name: "Evening Soup",
    date: new Date("2026-04-22T12:00:00"),
    type: "dinner",
    mealTypeDefinitionId: "default-dinner",
    mealTypeDefinition: profile.mealTypes[1],
    notes: "",
    ingredients: [],
    description: "",
    cuisine: null,
    instructions: [],
    servings: 1,
    prepTime: null,
    cookTime: null,
    servingsOverride: null,
    recipeId: null,
    linkedRecipe: null,
    sortOrder: 10,
  },
];

const breakfastOnlyMeals = dayMeals.filter((meal) => meal.type === "breakfast");

function createDataTransfer() {
  const values = new Map<string, string>();
  let restricted = false;

  return {
    setData: (type: string, value: string) => {
      values.set(type, value);
    },
    getData: (type: string) => (restricted ? "" : values.get(type) ?? ""),
    get types() {
      return Array.from(values.keys());
    },
    setDragRestriction: (value: boolean) => {
      restricted = value;
    },
    effectAllowed: "",
    dropEffect: "",
  } as DataTransfer & { setDragRestriction: (value: boolean) => void };
}

describe("meal plan drag prompt paths", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    cleanup();
  });

  it("DayView forwards meal-to-meal drops via onDropPayload", async () => {
    const onDropPayload = vi.fn().mockResolvedValue(undefined);
    const dataTransfer = createDataTransfer();

    render(
      <DayView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={onDropPayload}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const sourceMeal = screen.getByRole("button", { name: /Morning Toast/i });
    const targetMeal = screen.getByRole("button", { name: /^Evening Soup$/i });

    vi.spyOn(targetMeal, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      width: 120,
      height: 40,
      toJSON: () => ({}),
    });

    fireEvent.dragStart(sourceMeal, { dataTransfer });
    fireEvent.dragOver(targetMeal, { dataTransfer });
    fireEvent.drop(targetMeal, { dataTransfer });

    expect(onDropPayload).toHaveBeenCalledTimes(1);
    expect(onDropPayload).toHaveBeenCalledWith(
      {
        kind: "meal",
        mealId: "meal-a",
      },
      {
        kind: "meal",
        mealId: "meal-c",
        insertAfter: false,
      },
      {
        x: undefined,
        y: undefined,
      }
    );
  });

  it("DayView still drops a single meal into an empty slot after dragend fires", async () => {
    const onDropPayload = vi.fn().mockResolvedValue(undefined);
    const dataTransfer = createDataTransfer();

    render(
      <DayView
        date={new Date("2026-04-22T12:00:00")}
        meals={breakfastOnlyMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={onDropPayload}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const sourceMeal = screen.getByRole("button", { name: /Morning Toast/i });

    fireEvent.dragStart(sourceMeal, { dataTransfer });

    const dropTargets = screen.getAllByText(/Drop here/i);
    const emptyDinnerSlot = dropTargets[0]?.closest("div");
    expect(emptyDinnerSlot).not.toBeNull();

    fireEvent.dragEnd(sourceMeal, { dataTransfer });
    fireEvent.dragOver(emptyDinnerSlot as HTMLElement, { dataTransfer });
    fireEvent.drop(emptyDinnerSlot as HTMLElement, { dataTransfer });

    expect(onDropPayload).toHaveBeenCalledWith(
      {
        kind: "meal",
        mealId: "meal-a",
      },
      {
        kind: "slot",
        slotDate: new Date("2026-04-22T12:00:00").toISOString(),
        slotType: "dinner",
      },
      {
        x: undefined,
        y: undefined,
      }
    );
  });

  it("accepts dragover even when drag data is unavailable until drop", async () => {
    const dataTransfer = createDataTransfer();

    render(
      <DayView
        date={new Date("2026-04-22T12:00:00")}
        meals={breakfastOnlyMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const sourceMeal = screen.getByRole("button", { name: /Morning Toast/i });

    fireEvent.dragStart(sourceMeal, { dataTransfer });

    const dropTargets = screen.getAllByText(/Drop here/i);
    const emptyDinnerSlot = dropTargets[0]?.closest("div");
    expect(emptyDinnerSlot).not.toBeNull();
    const dragOverEvent = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    }) as Event & { dataTransfer?: DataTransfer };

    dataTransfer.setDragRestriction(true);
    dragOverEvent.dataTransfer = dataTransfer;
    emptyDinnerSlot?.dispatchEvent(dragOverEvent);

    expect(dragOverEvent.defaultPrevented).toBe(true);
  });

  it("DayView accepts bank meal drops into an empty slot", async () => {
    const onDropPayload = vi.fn().mockResolvedValue(undefined);
    const dataTransfer = createDataTransfer();

    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-1" });

    render(
      <DayView
        date={new Date("2026-04-22T12:00:00")}
        meals={breakfastOnlyMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={onDropPayload}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const emptyDinnerSlot = screen
      .getAllByRole("button", { name: /\+ Add/i })
      .find((element) => element.className.includes("timelineEmptySlot"));
    expect(emptyDinnerSlot).toBeDefined();
    const dragOverEvent = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    }) as Event & { dataTransfer?: DataTransfer };

    dataTransfer.setDragRestriction(true);
    dragOverEvent.dataTransfer = dataTransfer;
    emptyDinnerSlot?.dispatchEvent(dragOverEvent);
    expect(dragOverEvent.defaultPrevented).toBe(true);

    dataTransfer.setDragRestriction(false);
    fireEvent.drop(emptyDinnerSlot as HTMLElement, { dataTransfer });

    expect(onDropPayload).toHaveBeenCalledWith(
      {
        kind: "bank-meal",
        mealId: "bank-1",
      },
      {
        kind: "slot",
        slotDate: new Date("2026-04-22T12:00:00").toISOString(),
        slotType: "dinner",
      },
      {
        x: undefined,
        y: undefined,
      }
    );
  });

  it("DayView highlights occupied targets while dragging a bank meal", async () => {
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-3" });

    render(
      <DayView
        date={new Date("2026-04-22T12:00:00")}
        meals={breakfastOnlyMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const occupiedTarget = screen.getByRole("button", { name: /^Morning Toast$/i });
    fireEvent.dragOver(occupiedTarget, { dataTransfer });
    expect(occupiedTarget).toHaveClass(styles.slotDropTarget);

  });

  it("WeekView forwards slot-drag drops via onDropPayload", async () => {
    const onDropPayload = vi.fn().mockResolvedValue(undefined);
    const dataTransfer = createDataTransfer();

    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={onDropPayload}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const slotDragHandle = screen.getByRole("button", {
      name: /Drag breakfast slot/i,
    });
    const targetMeal = screen.getByRole("button", { name: /^Evening Soup$/i });

    vi.spyOn(targetMeal, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      width: 120,
      height: 40,
      toJSON: () => ({}),
    });

    fireEvent.dragStart(slotDragHandle, { dataTransfer });
    fireEvent.dragEnd(slotDragHandle, { dataTransfer });
    fireEvent.dragOver(targetMeal, { dataTransfer });
    fireEvent.drop(targetMeal, { dataTransfer });

    expect(onDropPayload).toHaveBeenCalledTimes(1);
    const [payloadArg, targetArg, anchorArg] = onDropPayload.mock.calls[0] ?? [];

    expect(payloadArg).toMatchObject({
      kind: "slot",
      slotType: "breakfast",
      mealIds: ["meal-a", "meal-b"],
    });
    expect(targetArg).toEqual({
      kind: "meal",
      mealId: "meal-c",
      insertAfter: false,
    });
    expect(anchorArg).toEqual({
      x: undefined,
      y: undefined,
    });
  });

  it("WeekView uses the captured drag payload when drop data is unavailable", async () => {
    const onDropPayload = vi.fn().mockResolvedValue(undefined);
    const dataTransfer = createDataTransfer();

    const { container } = render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={onDropPayload}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const mealCards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[data-meal-plan-drag-source="calendar-meal"]'
      )
    );
    const sourceMeal = mealCards.find((card) =>
      card.textContent?.includes("Morning Toast")
    );
    const targetMeal = mealCards.find((card) =>
      card.textContent?.includes("Evening Soup")
    );
    expect(sourceMeal).toBeTruthy();
    expect(targetMeal).toBeTruthy();

    vi.spyOn(targetMeal as HTMLButtonElement, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      width: 120,
      height: 40,
      toJSON: () => ({}),
    });

    fireEvent.dragStart(sourceMeal as HTMLButtonElement, { dataTransfer });
    fireEvent.dragOver(targetMeal as HTMLButtonElement, { dataTransfer });
    dataTransfer.setDragRestriction(true);
    fireEvent.drop(targetMeal as HTMLButtonElement, { dataTransfer });

    expect(onDropPayload).toHaveBeenCalledTimes(1);
    expect(onDropPayload.mock.calls[0]?.[0]).toEqual({
      kind: "meal",
      mealId: "meal-a",
    });
  });

  it("WeekView accepts slot dragover when drag data is unavailable until drop", async () => {
    const dataTransfer = createDataTransfer();

    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const slotDragHandle = screen.getByRole("button", {
      name: /Drag breakfast slot/i,
    });

    fireEvent.dragStart(slotDragHandle, { dataTransfer });

    const targetMeal = screen.getByRole("button", { name: /^Evening Soup$/i });
    const dragOverEvent = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    }) as Event & { dataTransfer?: DataTransfer };

    dataTransfer.setDragRestriction(true);
    dragOverEvent.dataTransfer = dataTransfer;
    targetMeal.dispatchEvent(dragOverEvent);

    expect(dragOverEvent.defaultPrevented).toBe(true);
  });

  it("WeekView accepts bank meal drops into an empty slot", async () => {
    const onDropPayload = vi.fn().mockResolvedValue(undefined);
    const dataTransfer = createDataTransfer();

    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-2" });

    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={breakfastOnlyMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={onDropPayload}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const emptySlot = screen
      .getAllByRole("button", { name: /\+ Add/i })
      .find((element) => element.className.includes("weekSlotEmpty"));
    expect(emptySlot).toBeDefined();
    const dragOverEvent = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    }) as Event & { dataTransfer?: DataTransfer };

    dataTransfer.setDragRestriction(true);
    dragOverEvent.dataTransfer = dataTransfer;
    emptySlot?.dispatchEvent(dragOverEvent);
    expect(dragOverEvent.defaultPrevented).toBe(true);

    dataTransfer.setDragRestriction(false);
    fireEvent.drop(emptySlot as HTMLElement, { dataTransfer });

    const [payloadArg, targetArg] = onDropPayload.mock.calls[0] ?? [];
    expect(payloadArg).toEqual({
      kind: "bank-meal",
      mealId: "bank-2",
    });
    expect(targetArg).toMatchObject({
      kind: "slot",
    });
    expect(typeof targetArg?.slotType).toBe("string");
  });

  it("WeekView highlights occupied targets while dragging a bank meal", async () => {
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-4" });

    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const occupiedTarget = screen.getByRole("button", { name: /^Evening Soup$/i });
    fireEvent.dragOver(occupiedTarget, { dataTransfer });

    expect(occupiedTarget).toHaveClass(styles.slotDropTarget);
  });

  it("keeps slot action controls mounted while slot drag is active", async () => {
    const dataTransfer = createDataTransfer();

    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const slotDragHandle = screen.getByRole("button", {
      name: /Drag breakfast slot/i,
    });

    fireEvent.dragStart(slotDragHandle, { dataTransfer });

    expect(
      screen.getByRole("button", { name: /Drag breakfast slot/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add breakfast meal/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Manage breakfast meals/i })).toBeDisabled();
  });

});
