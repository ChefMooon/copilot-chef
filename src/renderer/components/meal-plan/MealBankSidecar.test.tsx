// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MealBankSidecar } from "./MealBankSidecar";
import {
  setMealPlanDragPayload,
  type BankMeal,
} from "@/lib/calendar";
import type { MealTypeDefinitionPayload } from "@shared/types";
import styles from "./meal-plan.module.css";

const mealTypes: MealTypeDefinitionPayload[] = [
  {
    id: "breakfast",
    profileId: "profile-default",
    slug: "breakfast",
    name: "Breakfast",
    color: "#E8885A",
    enabled: true,
    sortOrder: 0,
  },
  {
    id: "dinner",
    profileId: "profile-default",
    slug: "dinner",
    name: "Dinner",
    color: "#3B5E45",
    enabled: true,
    sortOrder: 1,
  },
];

const bankMeals: BankMeal[] = [
  {
    id: "bank-1",
    name: "Freezer Chili",
    date: null,
    type: "bank",
    sortOrder: 10,
    mealTypeDefinitionId: null,
    mealTypeDefinition: null,
    mealSubTypeDefinitionId: null,
    mealSubTypeDefinition: null,
    notes: "Make with cornbread",
    ingredients: [],
    description: "",
    cuisine: "Tex-Mex",
    instructions: [],
    servings: 4,
    prepTime: null,
    cookTime: null,
    servingsOverride: null,
    recipeId: null,
    linkedRecipe: null,
  },
  {
    id: "bank-2",
    name: "Pesto Pasta",
    date: null,
    type: "bank",
    sortOrder: 20,
    mealTypeDefinitionId: null,
    mealTypeDefinition: null,
    mealSubTypeDefinitionId: null,
    mealSubTypeDefinition: null,
    notes: "",
    ingredients: [],
    description: "",
    cuisine: null,
    instructions: [],
    servings: 2,
    prepTime: null,
    cookTime: null,
    servingsOverride: null,
    recipeId: null,
    linkedRecipe: null,
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
    setDragRestriction: (value: boolean) => {
      restricted = value;
    },
    effectAllowed: "",
    dropEffect: "",
  } as DataTransfer & { setDragRestriction: (value: boolean) => void };
}

function renderMealBank(overrides: Partial<Parameters<typeof MealBankSidecar>[0]> = {}) {
  const props: Parameters<typeof MealBankSidecar>[0] = {
    activeDate: new Date("2026-05-25T12:00:00.000Z"),
    collapsed: false,
    isLoading: false,
    mealTypes,
    meals: bankMeals,
    placement: "right",
    onAddCustomMeal: vi.fn(),
    onAddFromRecipe: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onDropMealToBank: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onReorder: vi.fn().mockResolvedValue(undefined),
    onSchedule: vi.fn().mockResolvedValue(undefined),
    onToggleCollapsed: vi.fn(),
    ...overrides,
  };

  render(<MealBankSidecar {...props} />);
  return props;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MealBankSidecar", () => {
  it("renders banked meals and schedules by visible meal type", () => {
    const props = renderMealBank();

    expect(screen.getByText("Freezer Chili")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Dinner" })[0]);

    expect(props.onSchedule).toHaveBeenCalledWith(bankMeals[0], "dinner");
  });

  it("collapses to a clickable tab", () => {
    const props = renderMealBank({ collapsed: true });

    expect(screen.queryByText("Freezer Chili")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Meal Bank/i }));

    expect(props.onToggleCollapsed).toHaveBeenCalledWith(false);
  });

  it("renders the MEALS tab copy and count badge", () => {
    renderMealBank({ collapsed: true });

    expect(screen.getByText("MEALS")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("uses vertical tab label styling for collapsed side placements", () => {
    renderMealBank({ collapsed: true, placement: "right" });

    expect(screen.getByRole("button", { name: /Meal Bank/i })).toHaveClass(
      styles.mealBankTabVertical
    );
  });

  it("keeps bottom placement tab label horizontal", () => {
    renderMealBank({ collapsed: true, placement: "bottom" });

    expect(screen.getByRole("button", { name: /Meal Bank/i })).not.toHaveClass(
      styles.mealBankTabVertical
    );
  });

  it("applies left placement class when configured", () => {
    renderMealBank({ placement: "left" });

    expect(screen.getByRole("complementary")).toHaveClass(styles.mealBankLeft);
  });

  it("reorders banked meals with explicit controls", () => {
    const props = renderMealBank();

    fireEvent.click(screen.getAllByRole("button", { name: "Down" })[0]);

    expect(props.onReorder).toHaveBeenCalledWith(["bank-2", "bank-1"]);
  });

  it("opens the add menu and triggers custom meal action", () => {
    const props = renderMealBank();

    fireEvent.click(screen.getByRole("button", { name: "Add a meal to the Meal Bank" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Custom Meal" }));

    expect(props.onAddCustomMeal).toHaveBeenCalledTimes(1);
  });

  it("opens the add menu and triggers from recipe action", () => {
    const props = renderMealBank();

    fireEvent.click(screen.getByRole("button", { name: "Add a meal to the Meal Bank" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "From Recipe" }));

    expect(props.onAddFromRecipe).toHaveBeenCalledTimes(1);
  });

  it("duplicates a meal from the card actions", () => {
    const props = renderMealBank();

    fireEvent.click(screen.getAllByRole("button", { name: "Duplicate" })[0]);

    expect(props.onDuplicate).toHaveBeenCalledWith(bankMeals[0]);
  });

  it("accepts scheduled meal drops into the bank", () => {
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "meal", mealId: "scheduled-1" });
    const props = renderMealBank({ isCalendarMealDragging: true });

    fireEvent.drop(screen.getByRole("complementary"), { dataTransfer });

    expect(props.onDropMealToBank).toHaveBeenCalledWith("scheduled-1");
  });

  it("allows dragover while browsers hide drag data until drop", () => {
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "meal", mealId: "scheduled-1" });
    renderMealBank({ isCalendarMealDragging: true });
    const dragOverEvent = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    }) as Event & { dataTransfer?: DataTransfer };

    dataTransfer.setDragRestriction(true);
    dragOverEvent.dataTransfer = dataTransfer;
    screen.getByRole("complementary").dispatchEvent(dragOverEvent);

    expect(dragOverEvent.defaultPrevented).toBe(true);
  });

  it("accepts scheduled meal drops on the collapsed tab", () => {
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "meal", mealId: "scheduled-2" });
    const props = renderMealBank({ collapsed: true, isCalendarMealDragging: true });

    fireEvent.drop(screen.getByRole("button", { name: /Meal Bank/i }), {
      dataTransfer,
    });

    expect(props.onDropMealToBank).toHaveBeenCalledWith("scheduled-2");
  });

  it("opens the collapsed drawer after hovering while dragging", () => {
    vi.useFakeTimers();
    const props = renderMealBank({ collapsed: true, isCalendarMealDragging: true });

    fireEvent.dragOver(screen.getByRole("button", { name: /Meal Bank/i }), {
      dataTransfer: createDataTransfer(),
    });
    act(() => {
      vi.advanceTimersByTime(451);
    });

    expect(props.onToggleCollapsed).toHaveBeenCalledWith(false);
  });

  it("ignores invalid drop payloads", () => {
    const dataTransfer = createDataTransfer();
    setMealPlanDragPayload(dataTransfer, { kind: "bank-meal", mealId: "bank-1" });
    const props = renderMealBank({ isCalendarMealDragging: true });

    fireEvent.drop(screen.getByRole("complementary"), { dataTransfer });

    expect(props.onDropMealToBank).not.toHaveBeenCalled();
  });
});