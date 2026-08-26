// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render as testingRender, screen } from "@testing-library/react";

import { WeekView } from "./WeekView";
import { showSlotDragPreview } from "./dragPreview";
import type { EditableMeal } from "@/lib/calendar";
import { setMealPlanDragPayload } from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";
import styles from "./meal-plan.module.css";
import { TooltipProvider } from "@/components/ui/tooltip";

function render(ui: Parameters<typeof testingRender>[0]) {
  const result = testingRender(
    <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
  );
  return {
    ...result,
    rerender: (nextUi: Parameters<typeof testingRender>[0]) =>
      result.rerender(
        <TooltipProvider delayDuration={0}>{nextUi}</TooltipProvider>
      ),
  };
}

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
  } as unknown as DataTransfer & { setDragRestriction: (value: boolean) => void };
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
  return event;
}

function installRafPump() {
  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 1;

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, callback);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    pending.delete(id);
  });

  const pump = (frames: number) => {
    for (let frame = 0; frame < frames; frame += 1) {
      const callbacks = Array.from(pending.values());
      pending.clear();
      act(() => {
        callbacks.forEach((callback) => callback(16));
      });
    }
  };

  const pendingCount = () => pending.size;

  return { pump, pendingCount };
}

function stubScrollerMetrics(
  scroller: HTMLElement,
  overrides: {
    scrollWidth?: number;
    clientWidth?: number;
    scrollHeight?: number;
    clientHeight?: number;
    initialScrollLeft?: number;
    initialScrollTop?: number;
  } = {}
) {
  let scrollLeft = overrides.initialScrollLeft ?? 0;
  let scrollTop = overrides.initialScrollTop ?? 0;

  Object.defineProperty(scroller, "scrollLeft", {
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
    configurable: true,
  });
  Object.defineProperty(scroller, "scrollTop", {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
    configurable: true,
  });
  Object.defineProperty(scroller, "scrollWidth", {
    value: overrides.scrollWidth ?? 2000,
    configurable: true,
  });
  Object.defineProperty(scroller, "clientWidth", {
    value: overrides.clientWidth ?? 800,
    configurable: true,
  });
  Object.defineProperty(scroller, "scrollHeight", {
    value: overrides.scrollHeight ?? 1500,
    configurable: true,
  });
  Object.defineProperty(scroller, "clientHeight", {
    value: overrides.clientHeight ?? 500,
    configurable: true,
  });

  vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(
    makeRect({ left: 0, top: 0, width: 800, height: 500 })
  );
}

function renderOverflowingWeekView(options: {
  setDate?: (date: Date) => void;
} = {}) {
  const result = render(
    <WeekView
      date={new Date("2026-04-22T12:00:00")}
      meals={[]}
      mealTypeProfiles={[profile]}
      setDate={options.setDate ?? vi.fn<(date: Date) => void>()}
      onEdit={vi.fn()}
      onDuplicateMeal={vi.fn()}
      onOpenSlotManager={vi.fn()}
      onDropPayload={vi.fn().mockResolvedValue(undefined)}
    />
  );

  const scroller = result.container.querySelector(
    `.${styles.weekBoardScroller}`
  ) as HTMLElement;
  stubScrollerMetrics(scroller);
  fireEvent.scroll(scroller);

  const board = result.container.querySelector(
    `.${styles.weekBoard}`
  ) as HTMLElement;

  return { ...result, scroller, board };
}

describe("week view drag navigation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body
      .querySelectorAll(`.${styles.slotDragPreview}`)
      .forEach((node) => node.remove());
    cleanup();
  });

  it("nests day headers inside a shared header wrapper", () => {
    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const firstDayHeader = document.querySelector<HTMLElement>(
      "[data-week-day-index='0']"
    );
    expect(firstDayHeader).not.toBeNull();

    const headerWrapper = firstDayHeader?.closest(`.${styles.weekBoardHeader}`);
    expect(headerWrapper).not.toBeNull();
    expect(headerWrapper?.querySelectorAll("[data-week-day-index]")).toHaveLength(7);

    const corner = headerWrapper?.querySelector(`.${styles.weekBoardCorner}`);
    expect(corner).not.toBeNull();
    expect(headerWrapper?.firstElementChild).toBe(corner);
  });

  it("renders one row wrapper per meal type holding exactly its eight cells", () => {
    const { container } = render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const board = container.querySelector(`.${styles.weekBoard}`);
    expect(board).not.toBeNull();

    const rows = board?.querySelectorAll<HTMLElement>("[data-week-board-row]");
    expect(rows).toHaveLength(2);

    rows?.forEach((row) => {
      expect(row.children).toHaveLength(8);
      expect(row.querySelectorAll(`.${styles.weekTypeCell}`)).toHaveLength(1);
      expect(row.querySelectorAll(`.${styles.weekSlotCell}`)).toHaveLength(7);
    });

    const headerWrapper = board?.querySelector(`.${styles.weekBoardHeader}`);
    expect(headerWrapper?.parentElement).toBe(board);
  });

  it("still routes dragover and drop on a meal card through onDropPayload", async () => {
    const onDropPayload = vi.fn().mockResolvedValue(undefined);
    const dataTransfer = createDataTransfer();

    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={onDropPayload}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const sourceMeal = screen.getByRole("button", { name: /^Morning Toast$/i });
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
    expect(onDropPayload.mock.calls[0]?.[0]).toEqual({
      kind: "meal",
      mealId: "meal-a",
    });
    expect(onDropPayload.mock.calls[0]?.[1]).toMatchObject({
      kind: "meal",
      mealId: "meal-c",
    });
  });

  it("carries sticky pane and scroller classes on the expected nodes", () => {
    const { container } = render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const scroller = container.querySelector(`.${styles.weekBoardScroller}`);
    const header = container.querySelector(`.${styles.weekBoardHeader}`);
    const corner = header?.querySelector(`.${styles.weekBoardCorner}`);
    const typeCell = container.querySelector(`.${styles.weekTypeCell}`);

    expect(scroller).not.toBeNull();
    expect(header).not.toBeNull();
    expect(corner).not.toBeNull();
    expect(typeCell).not.toBeNull();
  });

  it("toggles scroll elevation shadows only when canScroll booleans flip", () => {
    const { container } = render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const scroller = container.querySelector(
      `.${styles.weekBoardScroller}`
    ) as HTMLElement;
    const header = container.querySelector(
      `.${styles.weekBoardHeader}`
    ) as HTMLElement;
    const corner = header.querySelector(`.${styles.weekBoardCorner}`) as HTMLElement;
    const typeCell = container.querySelectorAll(
      `.${styles.weekTypeCell}`
    )[0] as HTMLElement;

    expect(header).not.toHaveClass(styles.weekShadowBottom);
    expect(corner).not.toHaveClass(styles.weekShadowRight);
    expect(typeCell).not.toHaveClass(styles.weekTypeCellShadowRight);

    Object.defineProperty(scroller, "scrollLeft", {
      value: 120,
      configurable: true,
    });
    Object.defineProperty(scroller, "scrollWidth", {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(scroller, "clientWidth", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(scroller, "scrollTop", {
      value: 40,
      configurable: true,
    });
    Object.defineProperty(scroller, "scrollHeight", {
      value: 1500,
      configurable: true,
    });
    Object.defineProperty(scroller, "clientHeight", {
      value: 500,
      configurable: true,
    });
    fireEvent.scroll(scroller);

    expect(corner).toHaveClass(styles.weekShadowRight);
    expect(typeCell).toHaveClass(styles.weekTypeCellShadowRight);
    expect(header).toHaveClass(styles.weekShadowBottom);

    Object.defineProperty(scroller, "scrollTop", { value: 1200, configurable: true });
    fireEvent.scroll(scroller);

    expect(corner).toHaveClass(styles.weekShadowRight);
    expect(header).not.toHaveClass(styles.weekShadowBottom);

    Object.defineProperty(scroller, "scrollLeft", { value: 1200, configurable: true });
    fireEvent.scroll(scroller);

    expect(corner).not.toHaveClass(styles.weekShadowRight);
    expect(typeCell).not.toHaveClass(styles.weekTypeCellShadowRight);
    expect(header).not.toHaveClass(styles.weekShadowBottom);
  });

  it("flips to the previous week after holding the left wall on a fitted board", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00"));
    const setDate = vi.fn<(date: Date) => void>();
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-edge" });

    const { container } = render(
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

    const board = container.querySelector(`.${styles.weekBoard}`) as HTMLElement;
    expect(document.querySelector("[data-week-edge-zone]")).toBeNull();

    dispatchEdgeDragOver(board, dataTransfer, 30, 100);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(setDate).not.toHaveBeenCalled();
    const leftBand = container.querySelector("[data-week-scroll-band='left']");
    expect(leftBand).toHaveClass(styles.weekScrollBandActive);
    expect(leftBand).toHaveClass(styles.weekScrollBandFlipping);

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(setDate).toHaveBeenCalledTimes(1);
    expect(setDate).toHaveBeenCalledWith(new Date("2026-04-15T12:00:00"));
    expect(leftBand).toHaveClass(styles.weekScrollBandActive);
    expect(leftBand).toHaveClass(styles.weekScrollBandFlipping);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(setDate).toHaveBeenCalledTimes(1);

    fireEvent.dragLeave(board);
    dispatchEdgeDragOver(board, dataTransfer, 30, 100);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(setDate).toHaveBeenCalledTimes(2);
  });

  it("auto-scrolls first and flips only after holding the clamped right wall", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00"));
    const setDate = vi.fn<(date: Date) => void>();
    const result = renderOverflowingWeekView({ setDate });

    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-edge" });

    dispatchEdgeDragOver(result.board, dataTransfer, 790, 250);
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(result.scroller.scrollLeft).toBeGreaterThan(0);
    expect(setDate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2200);
    });
    expect(result.scroller.scrollLeft).toBe(1200);
    expect(setDate).toHaveBeenCalledTimes(1);
    expect(setDate).toHaveBeenCalledWith(new Date("2026-04-29T12:00:00"));
  });

  it("flips back to the source week from the opposite wall", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00"));
    const setDate = vi.fn<(date: Date) => void>();
    const result = renderOverflowingWeekView({ setDate });
    const renderProps = {
      meals: [],
      mealTypeProfiles: [profile],
      setDate,
      onEdit: vi.fn(),
      onDuplicateMeal: vi.fn(),
      onOpenSlotManager: vi.fn(),
      onDropPayload: vi.fn().mockResolvedValue(undefined),
    };

    stubScrollerMetrics(result.scroller, {
      scrollWidth: 2000,
      clientWidth: 800,
      initialScrollLeft: 1200,
    });

    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-edge" });

    dispatchEdgeDragOver(result.board, dataTransfer, 790, 250);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(setDate).toHaveBeenCalledTimes(1);
    expect(setDate).toHaveBeenCalledWith(new Date("2026-04-29T12:00:00"));

    result.rerender(
      <WeekView
        date={new Date("2026-04-29T12:00:00")}
        {...renderProps}
      />
    );

    stubScrollerMetrics(result.scroller, {
      scrollWidth: 2000,
      clientWidth: 800,
      initialScrollLeft: 0,
    });
    dispatchEdgeDragOver(result.board, dataTransfer, 8, 250);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(setDate).toHaveBeenCalledTimes(2);
    expect(setDate).toHaveBeenLastCalledWith(new Date("2026-04-22T12:00:00"));
  });

  it("re-arms the same-direction flip after the pointer leaves the band", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00"));
    const setDate = vi.fn<(date: Date) => void>();
    const { container } = render(
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

    const board = container.querySelector(`.${styles.weekBoard}`) as HTMLElement;
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-edge" });

    dispatchEdgeDragOver(board, dataTransfer, 30, 100);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(setDate).toHaveBeenCalledTimes(1);

    dispatchEdgeDragOver(board, dataTransfer, 400, 100);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(setDate).toHaveBeenCalledTimes(1);

    dispatchEdgeDragOver(board, dataTransfer, 30, 100);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(setDate).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(setDate).toHaveBeenCalledTimes(2);
  });

  it("previews the insertion caret above or below a hovered meal card", () => {
    const dataTransfer = createDataTransfer();

    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const sourceMeal = screen.getByRole("button", { name: /^Morning Toast$/i });
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
    const firstEvent = dispatchEdgeDragOver(targetMeal, dataTransfer, 60, 10);

    const shell = targetMeal.closest(`.${styles.weekMealCardShell}`);
    expect(shell).not.toBeNull();
    let caret = shell?.querySelector(
      `.${styles.slotInsertCaret}.${styles.slotInsertCaretTop}`
    );
    expect(caret).not.toBeNull();
    expect(caret).toHaveClass(styles.slotInsertCaret);
    expect(caret?.getAttribute("aria-hidden")).toBe("true");
    expect(firstEvent.defaultPrevented).toBe(true);

    dispatchEdgeDragOver(targetMeal, dataTransfer, 60, 30);
    caret = shell?.querySelector(
      `.${styles.slotInsertCaret}.${styles.slotInsertCaretBottom}`
    );
    expect(caret).not.toBeNull();

    fireEvent.dragLeave(targetMeal, { dataTransfer });
    caret = shell?.querySelector(`.${styles.slotInsertCaret}`);
    expect(caret).toBeNull();
  });

  it("flips from the far-left band while overflowing once the wall hold elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00"));
    const setDate = vi.fn<(date: Date) => void>();
    const result = renderOverflowingWeekView({ setDate });

    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-5" });

    dispatchEdgeDragOver(result.board, dataTransfer, 8, 250);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(setDate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(setDate).toHaveBeenCalledTimes(1);
    expect(setDate).toHaveBeenCalledWith(new Date("2026-04-15T12:00:00"));
  });

  it("auto-scrolls toward the right edge faster as the pointer gets deeper", () => {
    const { pump } = installRafPump();

    const deep = renderOverflowingWeekView();
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-1" });
    dispatchEdgeDragOver(deep.board, dataTransfer, 795, 250);
    pump(1);
    const deepDelta = (deep.scroller as unknown as { scrollLeft: number })
      .scrollLeft;
    deep.unmount();

    const shallow = renderOverflowingWeekView();
    dispatchEdgeDragOver(shallow.board, dataTransfer, 740, 250);
    pump(1);
    const shallowDelta = (shallow.scroller as unknown as { scrollLeft: number })
      .scrollLeft;

    expect(deepDelta).toBeGreaterThan(0);
    expect(shallowDelta).toBeGreaterThan(0);
    expect(deepDelta).toBeGreaterThan(shallowDelta);
    expect(Math.max(deepDelta, shallowDelta)).toBeLessThanOrEqual(
      14 + Number.EPSILON
    );
  });

  it("clamps at the scroll end while keeping the loop alive", () => {
    const { pump, pendingCount } = installRafPump();
    const result = renderOverflowingWeekView();
    stubScrollerMetrics(result.scroller, {
      scrollWidth: 2000,
      clientWidth: 800,
      initialScrollLeft: 1198,
    });
    fireEvent.scroll(result.scroller);

    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-1" });
    dispatchEdgeDragOver(result.board, dataTransfer, 798, 250);

    pump(3);
    expect(result.scroller.scrollLeft).toBe(1200);

    pump(5);
    expect(result.scroller.scrollLeft).toBe(1200);
    expect(pendingCount()).toBeGreaterThan(0);
  });

  it("starts the auto-scroll loop for external drags with no readable payload", () => {
    const { pump } = installRafPump();
    const result = renderOverflowingWeekView();

    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-2" });
    dataTransfer.setDragRestriction(true);
    const dragOverEvent = dispatchEdgeDragOver(
      result.board,
      dataTransfer,
      790,
      250
    );

    expect(dragOverEvent.defaultPrevented).toBe(true);

    pump(2);
    expect(result.scroller.scrollLeft).toBeGreaterThan(0);
  });

  it("auto-scrolls vertically from the bottom band and clamps at the end", () => {
    const { pump } = installRafPump();
    const result = renderOverflowingWeekView();

    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-7" });
    dispatchEdgeDragOver(result.board, dataTransfer, 400, 495);
    pump(2);
    expect(result.scroller.scrollTop).toBeGreaterThan(0);

    stubScrollerMetrics(result.scroller, {
      scrollHeight: 1500,
      clientHeight: 500,
      initialScrollTop: 995,
    });
    pump(4);
    expect(result.scroller.scrollTop).toBe(1000);
  });

  it("stops the loop on drop, dragend, board dragleave, and unmount", () => {
    const { pump, pendingCount } = installRafPump();
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-3" });

    const first = renderOverflowingWeekView();
    dispatchEdgeDragOver(first.board, dataTransfer, 790, 250);
    pump(1);
    expect(first.scroller.scrollLeft).toBeGreaterThan(0);

    fireEvent.drop(first.board, { dataTransfer });
    const before = first.scroller.scrollLeft;
    pump(3);
    expect(first.scroller.scrollLeft).toBe(before);
    expect(pendingCount()).toBe(0);
    first.unmount();

    const second = renderOverflowingWeekView();
    dispatchEdgeDragOver(second.board, dataTransfer, 790, 250);
    pump(1);
    fireEvent.dragEnd(second.board, { dataTransfer });
    const secondBefore = second.scroller.scrollLeft;
    pump(3);
    expect(second.scroller.scrollLeft).toBe(secondBefore);
    expect(pendingCount()).toBe(0);
    second.unmount();

    const third = renderOverflowingWeekView();
    dispatchEdgeDragOver(third.board, dataTransfer, 790, 250);
    pump(1);
    fireEvent.dragLeave(third.board);
    const thirdBefore = third.scroller.scrollLeft;
    pump(3);
    expect(third.scroller.scrollLeft).toBe(thirdBefore);
    expect(pendingCount()).toBe(0);

    const fourth = renderOverflowingWeekView();
    dispatchEdgeDragOver(fourth.board, dataTransfer, 790, 250);
    pump(1);
    expect(fourth.scroller.scrollLeft).toBeGreaterThan(0);
    fourth.unmount();
    pump(3);
    expect(pendingCount()).toBe(0);
  });

  it("keeps the loop functional when a resize crosses the overflow boundary mid-drag", () => {
    const { pump, pendingCount } = installRafPump();
    const result = renderOverflowingWeekView();

    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-4" });
    dispatchEdgeDragOver(result.board, dataTransfer, 790, 250);
    pump(1);
    expect(result.scroller.scrollLeft).toBeGreaterThan(0);

    stubScrollerMetrics(result.scroller, {
      scrollWidth: 700,
      clientWidth: 800,
      initialScrollLeft: result.scroller.scrollLeft,
    });
    fireEvent(window, new Event("resize"));
    pump(3);
    expect(pendingCount()).toBeGreaterThan(0);

    stubScrollerMetrics(result.scroller, {
      scrollWidth: 2000,
      clientWidth: 800,
      initialScrollLeft: result.scroller.scrollLeft,
    });
    dispatchEdgeDragOver(result.board, dataTransfer, 790, 250);
    pump(2);
    expect(pendingCount()).toBeGreaterThan(0);
  });

  it("hides scroll bands without overflow but keeps the wall-flip indicator", () => {
    const { pump } = installRafPump();
    const result = renderOverflowingWeekView();

    stubScrollerMetrics(result.scroller, {
      scrollWidth: 800,
      clientWidth: 800,
      scrollHeight: 500,
      clientHeight: 500,
    });
    fireEvent.scroll(result.scroller);

    const band = (band: string) =>
      result.container.querySelector(`[data-week-scroll-band='${band}']`);

    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-8" });

    dispatchEdgeDragOver(result.board, dataTransfer, 400, 30);
    pump(2);
    expect(band("top")).not.toHaveClass(styles.weekScrollBandActive);
    expect(band("bottom")).not.toHaveClass(styles.weekScrollBandActive);
    expect(band("left")).not.toHaveClass(styles.weekScrollBandActive);
    expect(band("right")).not.toHaveClass(styles.weekScrollBandActive);
    expect(result.scroller.scrollTop).toBe(0);

    dispatchEdgeDragOver(result.board, dataTransfer, 790, 495);
    pump(2);
    expect(band("bottom")).not.toHaveClass(styles.weekScrollBandActive);
    expect(band("right")).toHaveClass(styles.weekScrollBandActive);
    expect(result.scroller.scrollLeft).toBe(0);
    expect(result.scroller.scrollTop).toBe(0);

    result.unmount();
    pump(1);
  });

  it("renders a single-meal drag ghost through the shared preview helper", () => {
    const { pump } = installRafPump();
    const dataTransfer = createDataTransfer();

    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={dayMeals}
        mealTypeProfiles={[profile]}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onDuplicateMeal={vi.fn()}
        onOpenSlotManager={vi.fn()}
        setDate={vi.fn()}
      />
    );

    const sourceMeal = screen.getByRole("button", { name: /^Morning Toast$/i });
    fireEvent.dragStart(sourceMeal, { dataTransfer });

    let ghost = document.body.querySelector(`.${styles.mealDragPreview}`);
    expect(ghost).not.toBeNull();
    expect(ghost).toHaveClass(styles.slotDragPreview);
    expect(ghost?.querySelector(`.${styles.slotDragPreviewTitle}`)?.textContent).toBe(
      "Morning Toast"
    );

    pump(2);
    ghost = document.body.querySelector(`.${styles.mealDragPreview}`);
    expect(ghost).toBeNull();
  });

  it("builds the slot drag ghost with the same shared classes as the meal ghost", () => {
    const { pump } = installRafPump();
    const dataTransfer = createDataTransfer();

    showSlotDragPreview(dataTransfer, {
      title: "Dragging 2 breakfast meals",
      namesLine: "Morning Toast • Morning Oats",
      metaLine: "4/22/2026",
    });

    const ghost = document.body.querySelector(`.${styles.slotDragPreview}`);
    expect(ghost).not.toBeNull();
    expect(ghost).not.toHaveClass(styles.mealDragPreview);
    expect(ghost?.querySelector(`.${styles.slotDragPreviewTitle}`)?.textContent).toBe(
      "Dragging 2 breakfast meals"
    );
    expect(ghost?.querySelector(`.${styles.slotDragPreviewList}`)?.textContent).toBe(
      "Morning Toast • Morning Oats"
    );

    pump(2);
    expect(document.body.querySelector(`.${styles.slotDragPreview}`)).toBeNull();
  });

  it("shows clipped-edge fades only on scrollable sides and intensifies engaged bands", () => {
    const { pump } = installRafPump();
    const result = renderOverflowingWeekView();

    const fade = (band: string) =>
      result.container.querySelector(`[data-week-scroll-fade='${band}']`);

    expect(fade("right")).toHaveClass(styles.weekScrollFadeVisible);
    expect(fade("bottom")).toHaveClass(styles.weekScrollFadeVisible);
    expect(fade("left")).not.toHaveClass(styles.weekScrollFadeVisible);
    expect(fade("top")).not.toHaveClass(styles.weekScrollFadeVisible);
    expect(fade("right")).not.toHaveClass(styles.weekScrollFadeIntense);

    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-6" });
    dispatchEdgeDragOver(result.board, dataTransfer, 790, 250);
    pump(1);

    expect(fade("right")).toHaveClass(styles.weekScrollFadeIntense);
    expect(fade("bottom")).toHaveClass(styles.weekScrollFadeVisible);
    expect(fade("bottom")).not.toHaveClass(styles.weekScrollFadeIntense);
  });
});
