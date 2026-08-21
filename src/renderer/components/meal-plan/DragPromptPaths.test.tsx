// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

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

function makeRect({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockWeekBoardGeometry() {
  return vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains(styles.weekBoard)) {
        return makeRect({ left: 0, top: 0, width: 1024, height: 600 });
      }

      const dayIndex = this.getAttribute("data-week-day-index");
      if (dayIndex !== null) {
        return makeRect({
          left: 128 + Number(dayIndex) * 128,
          top: 0,
          width: 128,
          height: 48,
        });
      }

      return makeRect({ left: 0, top: 0, width: 0, height: 0 });
    });
}

function dispatchEdgeDragOver(
  element: HTMLElement,
  dataTransfer: DataTransfer,
  clientX: number,
  clientY: number
) {
  const event = new MouseEvent("dragover", {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  }) as unknown as Event & {
    clientX: number;
    clientY: number;
    dataTransfer: DataTransfer;
  };

  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  act(() => {
    element.dispatchEvent(event);
  });
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

  it("cancels edge navigation below the threshold and ignores invalid payloads", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00"));
    mockWeekBoardGeometry();
    const setDate = vi.fn();
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-edge" });

    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={[]}
        mealTypeProfiles={[profile]}
        setDate={setDate}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const nextZone = document.querySelector<HTMLElement>(
      `[data-week-edge-zone="next"]`
    );
    const previousZone = document.querySelector<HTMLElement>(
      `[data-week-edge-zone="previous"]`
    );
    const board = nextZone?.closest(`.${styles.weekBoard}`);
    expect(nextZone).toBeTruthy();
    expect(previousZone).toBeTruthy();
    expect(board).toBeTruthy();
    expect((nextZone as HTMLElement).style.left).toBe("992px");
    expect((nextZone as HTMLElement).style.top).toBe("48px");
    expect(nextZone).not.toHaveClass(styles.weekEdgeZoneActive);
    expect(nextZone?.querySelector("[data-week-edge-arrow='next']")).toBeNull();

    dispatchEdgeDragOver(board as HTMLElement, dataTransfer, 1000, 100);
    expect(nextZone).toHaveClass(styles.weekEdgeZoneActive);
    expect(nextZone?.querySelector("[data-week-edge-arrow='next']")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(setDate).not.toHaveBeenCalled();

    fireEvent.dragLeave(board as HTMLElement);
    expect(nextZone).not.toHaveClass(styles.weekEdgeZoneActive);
    expect(nextZone?.querySelector("[data-week-edge-arrow='next']")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(setDate).not.toHaveBeenCalled();

    const invalidDataTransfer = createDataTransfer();
    dispatchEdgeDragOver(board as HTMLElement, invalidDataTransfer, 1000, 100);
    act(() => {
      vi.advanceTimersByTime(801);
    });
    expect(setDate).not.toHaveBeenCalled();

    expect(previousZone).toBeTruthy();
  });

  it("navigates once per edge entry and cancels a changed direction", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00"));
    mockWeekBoardGeometry();
    const setDate = vi.fn();
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-edge" });

    const { unmount, rerender } = render(
      <WeekView
        date={new Date("2026-04-29T12:00:00")}
        meals={[]}
        mealTypeProfiles={[profile]}
        setDate={setDate}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const nextZone = document.querySelector<HTMLElement>(
      `[data-week-edge-zone="next"]`
    );
    const previousZone = document.querySelector<HTMLElement>(
      `[data-week-edge-zone="previous"]`
    );
    const board = nextZone?.closest(`.${styles.weekBoard}`);
    expect(nextZone).toBeTruthy();
    expect(previousZone).toBeTruthy();
    expect(board).toBeTruthy();
    expect(nextZone).not.toHaveClass(styles.weekEdgeZoneActive);
    expect(nextZone?.querySelector("[data-week-edge-arrow='next']")).toBeNull();

    dispatchEdgeDragOver(board as HTMLElement, dataTransfer, 140, 100);
    expect(previousZone).toHaveClass(styles.weekEdgeZoneActive);
    expect(previousZone?.querySelector("[data-week-edge-arrow='previous']")).toBeTruthy();
    dispatchEdgeDragOver(board as HTMLElement, dataTransfer, 1000, 100);
    expect(nextZone).toHaveClass(styles.weekEdgeZoneActive);
    expect(nextZone?.querySelector("[data-week-edge-arrow='next']")).toBeTruthy();
    expect(previousZone).not.toHaveClass(styles.weekEdgeZoneActive);
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(setDate).toHaveBeenCalledTimes(1);
    expect(setDate).toHaveBeenCalledWith(new Date("2026-05-06T12:00:00"));

    rerender(
      <WeekView
        date={new Date("2026-05-06T12:00:00")}
        meals={[]}
        mealTypeProfiles={[profile]}
        setDate={setDate}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    dispatchEdgeDragOver(board as HTMLElement, dataTransfer, 1000, 100);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(setDate).toHaveBeenCalledTimes(2);

    fireEvent.dragLeave(nextZone as HTMLElement);
  expect(nextZone).not.toHaveClass(styles.weekEdgeZoneActive);
  expect(nextZone?.querySelector("[data-week-edge-arrow='next']")).toBeNull();
  dispatchEdgeDragOver(board as HTMLElement, dataTransfer, 1000, 100);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(setDate).toHaveBeenCalledTimes(3);

    unmount();
  });

  it("cleans edge timers on dragend, drop, and unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00"));
    mockWeekBoardGeometry();
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-edge" });

    const firstSetDate = vi.fn();
    const firstRender = render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        setDate={firstSetDate}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const firstNextZone = document.querySelector<HTMLElement>(
      `[data-week-edge-zone="next"]`
    );
    const sourceMeal = screen.getByRole("button", { name: /^Morning Toast$/i });
    fireEvent.dragOver(firstNextZone as HTMLElement, {
      clientX: 1000,
      clientY: 100,
      dataTransfer,
    });
    fireEvent.dragEnd(sourceMeal, { dataTransfer });
    act(() => {
      vi.advanceTimersByTime(801);
    });
    expect(firstSetDate).not.toHaveBeenCalled();
    firstRender.unmount();

    const secondSetDate = vi.fn();
    const secondRender = render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={[]}
        mealTypeProfiles={[profile]}
        setDate={secondSetDate}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const secondNextZone = document.querySelector<HTMLElement>(
      `[data-week-edge-zone="next"]`
    );
    fireEvent.dragOver(secondNextZone as HTMLElement, {
      clientX: 1000,
      clientY: 100,
      dataTransfer,
    });
    fireEvent.drop(secondNextZone as HTMLElement, { dataTransfer });
    act(() => {
      vi.advanceTimersByTime(801);
    });
    expect(secondSetDate).not.toHaveBeenCalled();

    secondRender.unmount();
    const thirdSetDate = vi.fn();
    const thirdRender = render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={[]}
        mealTypeProfiles={[profile]}
        setDate={thirdSetDate}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const thirdNextZone = document.querySelector<HTMLElement>(
      `[data-week-edge-zone="next"]`
    );
    fireEvent.dragOver(thirdNextZone as HTMLElement, {
      clientX: 1000,
      clientY: 100,
      dataTransfer,
    });
    thirdRender.unmount();
    act(() => {
      vi.advanceTimersByTime(801);
    });
    expect(thirdSetDate).not.toHaveBeenCalled();
  });
});
