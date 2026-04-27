// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DayView } from "./DayView";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import styles from "./meal-plan.module.css";
import type { EditableMeal } from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";

const defaultProfile: MealTypeProfilePayload = {
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

const weekendProfile: MealTypeProfilePayload = {
  id: "weekend-profile",
  name: "Weekend",
  color: "#A85774",
  description: "Brunch-first weekends",
  isDefault: false,
  priority: 10,
  startDate: "2026-04-18T12:00:00",
  endDate: "2026-04-19T12:00:00",
  createdAt: "2026-04-10T12:00:00",
  updatedAt: "2026-04-10T12:00:00",
  mealTypes: [
    {
      id: "weekend-brunch",
      profileId: "weekend-profile",
      name: "Brunch",
      slug: "brunch",
      color: "#8A7DB8",
      enabled: true,
      sortOrder: 0,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    },
    {
      id: "weekend-dinner",
      profileId: "weekend-profile",
      name: "Dinner",
      slug: "dinner",
      color: "#3B5E45",
      enabled: true,
      sortOrder: 1,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    },
  ],
};

const filteredProfile: MealTypeProfilePayload = {
  id: "filtered-profile",
  name: "Filtered",
  color: "#355D4E",
  description: "Only breakfast and dinner enabled",
  isDefault: true,
  priority: 0,
  startDate: null,
  endDate: null,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
  mealTypes: [
    {
      id: "filtered-breakfast",
      profileId: "filtered-profile",
      name: "Breakfast",
      slug: "breakfast",
      color: "#E8885A",
      enabled: true,
      sortOrder: 0,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    {
      id: "filtered-lunch",
      profileId: "filtered-profile",
      name: "Lunch",
      slug: "lunch",
      color: "#4F8A62",
      enabled: false,
      sortOrder: 1,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    {
      id: "filtered-dinner",
      profileId: "filtered-profile",
      name: "Dinner",
      slug: "dinner",
      color: "#3B5E45",
      enabled: true,
      sortOrder: 2,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  ],
};

const disabledTypeMeal: EditableMeal = {
  id: "meal-disabled-lunch",
  name: "Leftover Lunch",
  date: new Date("2026-04-22T12:00:00"),
  type: "lunch",
  mealTypeDefinitionId: "filtered-lunch",
  mealTypeDefinition: filteredProfile.mealTypes[1],
  notes: "planned earlier",
  ingredients: [],
  description: "",
  instructions: [],
  servings: 1,
  prepTime: null,
  cookTime: null,
  servingsOverride: null,
  recipeId: null,
  linkedRecipe: null,
};

const sampleMeals: EditableMeal[] = [
  {
    id: "meal-1",
    name: "Sheet Pan Dinner",
    date: new Date("2026-04-18T12:00:00"),
    type: "dinner",
    mealTypeDefinitionId: "weekend-dinner",
    mealTypeDefinition: weekendProfile.mealTypes[1],
    notes: "Use leftovers",
    ingredients: [],
    description: "",
    instructions: [],
    servings: 2,
    prepTime: null,
    cookTime: null,
    servingsOverride: null,
    recipeId: null,
    linkedRecipe: null,
  },
];

describe("profile-aware meal plan views", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders mixed-profile week headers and unavailable slots", () => {
    render(
      <WeekView
        date={new Date("2026-04-17T12:00:00")}
        meals={sampleMeals}
        mealTypeProfiles={[defaultProfile, weekendProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onMoveMeal={vi.fn().mockResolvedValue(undefined)}
        onSwapMeals={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getAllByText("Default").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Weekend").length).toBeGreaterThan(0);
    expect(screen.getByText("Profile starts")).toBeTruthy();
    expect(screen.getByText("Brunch")).toBeTruthy();
    expect(screen.getAllByText("Not in profile").length).toBeGreaterThan(0);

    const weekendChip = screen
      .getAllByText("Weekend")
      .find((element) => element.className.includes(styles.weekProfileChip));

    expect(weekendChip).toBeTruthy();
    expect((weekendChip as HTMLElement).style.color).toBe("rgb(168, 87, 116)");
  });

  it("shows profile details in the month popover even when no meals are planned", () => {
    render(
      <MonthView
        date={new Date("2026-04-17T12:00:00")}
        meals={[]}
        mealTypeProfiles={[defaultProfile, weekendProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Saturday, April 18.*Active profile Weekend.*Profile starts today.*No meals planned\./i,
      })
    );

    expect(screen.getAllByText("Weekend").length).toBeGreaterThan(0);
    expect(screen.getByText("Profile starts on this day")).toBeTruthy();
    expect(screen.getByText("No meals planned.")).toBeTruthy();
    expect(screen.getByText("Brunch")).toBeTruthy();
  });

  it("shows only enabled meal type chips in month popover when no meals exist", () => {
    render(
      <MonthView
        date={new Date("2026-04-22T12:00:00")}
        meals={[]}
        mealTypeProfiles={[filteredProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Wednesday, April 22.*Active profile Filtered.*No meals planned\./i,
      })
    );

    expect(screen.getByText("Breakfast")).toBeTruthy();
    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.queryByText("Lunch")).toBeNull();
  });

  it("keeps disabled meal type chips visible in month popover when meals exist in that type", () => {
    render(
      <MonthView
        date={new Date("2026-04-22T12:00:00")}
        meals={[disabledTypeMeal]}
        mealTypeProfiles={[filteredProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Wednesday, April 22.*Active profile Filtered.*1 meal planned\./i,
      })
    );

    expect(screen.getAllByText("Lunch").length).toBeGreaterThan(0);
    expect(screen.getByText("Leftover Lunch")).toBeTruthy();
  });

  it("dims non-matching month cells when a profile is focused", () => {
    render(
      <MonthView
        date={new Date("2026-04-17T12:00:00")}
        highlightedProfileId="weekend-profile"
        meals={[]}
        mealTypeProfiles={[defaultProfile, weekendProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    const defaultDayButton = screen.getByRole("button", {
      name: /Friday, April 17.*Active profile Default/i,
    });
    const weekendDayButton = screen.getByRole("button", {
      name: /Saturday, April 18.*Active profile Weekend/i,
    });

    expect(defaultDayButton.className).toContain(styles.monthProfileMuted);
    expect(weekendDayButton.className).not.toContain(styles.monthProfileMuted);
  });

  it("shows only enabled rows in week view unless a disabled type has planned meals", () => {
    const { rerender } = render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={[]}
        mealTypeProfiles={[filteredProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onMoveMeal={vi.fn().mockResolvedValue(undefined)}
        onSwapMeals={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Breakfast")).toBeTruthy();
    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.queryByText("Lunch")).toBeNull();

    rerender(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={[disabledTypeMeal]}
        mealTypeProfiles={[filteredProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onMoveMeal={vi.fn().mockResolvedValue(undefined)}
        onSwapMeals={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Lunch")).toBeTruthy();
    expect(screen.getByText("Leftover Lunch")).toBeTruthy();
  });

  it("opens add meal from week view with the correct day and meal type", () => {
    const onEdit = vi.fn();

    render(
      <WeekView
        date={new Date("2026-04-17T12:00:00")}
        meals={[]}
        mealTypeProfiles={[defaultProfile, weekendProfile]}
        setDate={vi.fn()}
        onEdit={onEdit}
        onMoveMeal={vi.fn().mockResolvedValue(undefined)}
        onSwapMeals={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const addButtons = screen.getAllByRole("button", { name: "+ Add" });
    fireEvent.click(addButtons[0]);

    expect(onEdit).toHaveBeenCalledTimes(1);

    const payload = onEdit.mock.calls[0]?.[0] as EditableMeal;
    expect(payload.type).toBe("breakfast");
    expect(payload.mealTypeDefinitionId).toBe("default-breakfast");
    expect(payload.date.getFullYear()).toBe(2026);
    expect(payload.date.getMonth()).toBe(3);
    expect(payload.date.getDate()).toBe(13);
  });

  it("dims the day view when the focused profile is not active on the selected date", () => {
    const { container } = render(
      <DayView
        date={new Date("2026-04-17T12:00:00")}
        highlightedProfileId="weekend-profile"
        meals={[]}
        mealTypeProfiles={[defaultProfile, weekendProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onMoveMeal={vi.fn().mockResolvedValue(undefined)}
        onSwapMeals={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const dayViewRoot = container.firstElementChild;

    expect(dayViewRoot?.className).toContain(styles.dayProfileMuted);
  });

  it("shows only enabled slots in day view unless a disabled type has planned meals", () => {
    const { rerender } = render(
      <DayView
        date={new Date("2026-04-22T12:00:00")}
        highlightedProfileId={null}
        meals={[]}
        mealTypeProfiles={[filteredProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onMoveMeal={vi.fn().mockResolvedValue(undefined)}
        onSwapMeals={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Breakfast")).toBeTruthy();
    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.queryByText("Lunch")).toBeNull();

    rerender(
      <DayView
        date={new Date("2026-04-22T12:00:00")}
        highlightedProfileId={null}
        meals={[disabledTypeMeal]}
        mealTypeProfiles={[filteredProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onMoveMeal={vi.fn().mockResolvedValue(undefined)}
        onSwapMeals={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Lunch")).toBeTruthy();
    expect(screen.getByText("Leftover Lunch")).toBeTruthy();
  });
});