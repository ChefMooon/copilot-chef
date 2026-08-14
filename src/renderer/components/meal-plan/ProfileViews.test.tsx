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

const customLabelProfile: MealTypeProfilePayload = {
  ...defaultProfile,
  mealTypes: defaultProfile.mealTypes.map((definition) => ({
    ...definition,
    name: definition.slug === "breakfast" ? "Sunrise" : "Supper",
  })),
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

const denseMonthMeals: EditableMeal[] = Array.from({ length: 21 }, (_, index) => ({
  id: `dense-meal-${index + 1}`,
  name: `Dense Meal ${index + 1}`,
  date: new Date("2026-04-22T12:00:00"),
  type: "breakfast",
  mealTypeDefinitionId: "filtered-breakfast",
  mealTypeDefinition: filteredProfile.mealTypes[0],
  notes: "",
  ingredients: [],
  description: "",
  instructions: [],
  servings: 1,
  prepTime: null,
  cookTime: null,
  servingsOverride: null,
  recipeId: null,
  linkedRecipe: null,
}));

const makeRect = ({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DOMRect => {
  const right = left + width;
  const bottom = top + height;

  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
};

describe("profile-aware meal plan views", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("provides accessible period navigation for day, week, and month views", () => {
    const dayPrevious = vi.fn();
    const { unmount: unmountDay } = render(
      <DayView
        date={new Date("2026-04-18T12:00:00")}
        meals={[]}
        mealTypeProfiles={[defaultProfile]}
        setDate={dayPrevious}
        onEdit={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const dayPreviousButton = screen.getByRole("button", {
      name: "Go to previous day",
    });
    const dayNextButton = screen.getByRole("button", {
      name: "Go to next day",
    });
    expect(dayPreviousButton).toHaveAttribute("title", "Go to previous day");
    expect(dayNextButton).toHaveAttribute("title", "Go to next day");
    fireEvent.click(dayPreviousButton);
    expect(dayPrevious).toHaveBeenCalledWith(new Date("2026-04-17T12:00:00"));
    fireEvent.click(dayNextButton);
    expect(dayPrevious).toHaveBeenLastCalledWith(new Date("2026-04-19T12:00:00"));
    unmountDay();

    const weekPrevious = vi.fn();
    render(
      <WeekView
        date={new Date("2026-04-18T12:00:00")}
        meals={[]}
        mealTypeProfiles={[defaultProfile]}
        setDate={weekPrevious}
        onEdit={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByRole("button", { name: "Go to previous week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to next week" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go to previous week" }));
    expect(weekPrevious).toHaveBeenCalledWith(new Date("2026-04-11T12:00:00"));
    fireEvent.click(screen.getByRole("button", { name: "Go to next week" }));
    expect(weekPrevious).toHaveBeenLastCalledWith(new Date("2026-04-25T12:00:00"));
    cleanup();

    const monthPrevious = vi.fn();
    render(
      <MonthView
        date={new Date("2026-04-18T12:00:00")}
        meals={[]}
        mealTypeProfiles={[defaultProfile]}
        setDate={monthPrevious}
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Go to previous month" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to next month" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go to previous month" }));
    const expectedPreviousMonth = new Date("2026-04-18T12:00:00");
    expectedPreviousMonth.setDate(1);
    expectedPreviousMonth.setMonth(expectedPreviousMonth.getMonth() - 1);
    expect(monthPrevious).toHaveBeenCalledWith(expectedPreviousMonth);
    fireEvent.click(screen.getByRole("button", { name: "Go to next month" }));
    const expectedNextMonth = new Date("2026-04-18T12:00:00");
    expectedNextMonth.setDate(1);
    expectedNextMonth.setMonth(expectedNextMonth.getMonth() + 1);
    expect(monthPrevious).toHaveBeenLastCalledWith(expectedNextMonth);
  });

  it("renders mixed-profile week headers and unavailable slots", () => {
    render(
      <WeekView
        date={new Date("2026-04-17T12:00:00")}
        meals={sampleMeals}
        mealTypeProfiles={[defaultProfile, weekendProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getAllByText("Default").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Weekend").length).toBeGreaterThan(0);
    expect(screen.getByText("Brunch")).toBeTruthy();
    expect(screen.getAllByText("Not in profile").length).toBeGreaterThan(0);

    const weekendChip = screen
      .getAllByText("Weekend")
      .find((element) => element.className.includes(styles.weekProfileChip));

    expect(weekendChip).toBeTruthy();
    expect((weekendChip as HTMLElement).style.getPropertyValue("--profile-accent")).toBe(
      "#A85774"
    );
  });

  it("renders configured custom meal-type names in the shared week rows", () => {
    render(
      <WeekView
        date={new Date("2026-04-22T12:00:00")}
        meals={[]}
        mealTypeProfiles={[customLabelProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Sunrise")).toHaveClass(styles.weekTypeLabel);
    expect(screen.getByText("Supper")).toHaveClass(styles.weekTypeLabel);
    expect(screen.getAllByText("Default").length).toBeGreaterThan(0);
  });

  it("uses meal-type tinting without a left color bar in day and week views", () => {
    const { container } = render(
      <DayView
        date={new Date("2026-04-18T12:00:00")}
        meals={sampleMeals}
        mealTypeProfiles={[defaultProfile, weekendProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const dayMealCard = container.querySelector(
      `button.${styles.timelineMealCard}`
    ) as HTMLButtonElement;

    expect(dayMealCard).toBeTruthy();
    expect(dayMealCard.style.getPropertyValue("--meal-type-color")).toBe("#3B5E45");
    expect(dayMealCard.style.borderLeft).toBe("");

    cleanup();

    const { container: weekContainer } = render(
      <WeekView
        date={new Date("2026-04-17T12:00:00")}
        meals={sampleMeals}
        mealTypeProfiles={[defaultProfile, weekendProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const weekMealCard = weekContainer.querySelector(
      `button.${styles.weekSlotMealCard}`
    ) as HTMLButtonElement;

    expect(weekMealCard).toBeTruthy();
    expect(weekMealCard.style.getPropertyValue("--meal-type-color")).toBe("#3B5E45");
    expect(weekMealCard.style.borderLeft).toBe("");
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

  it("marks the selected month day while its popover is open", () => {
    render(
      <MonthView
        date={new Date("2026-04-17T12:00:00")}
        meals={[]}
        mealTypeProfiles={[defaultProfile, weekendProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    const selectedDay = screen.getByRole("button", {
      name: /Saturday, April 18/i,
    });

    expect(selectedDay).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(selectedDay);

    expect(selectedDay).toHaveAttribute("aria-pressed", "true");
    expect(selectedDay.className).toContain(styles.monthCellSelected);
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

  it("repositions month popover above and clamps to viewport edges on small windows", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 240,
    });

    const { container } = render(
      <MonthView
        date={new Date("2026-04-22T12:00:00")}
        meals={[]}
        mealTypeProfiles={[filteredProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    const dayButton = screen.getByRole("button", {
      name: /Wednesday, April 22.*Active profile Filtered.*No meals planned\./i,
    });

    vi.spyOn(dayButton, "getBoundingClientRect").mockReturnValue(
      makeRect({ left: 300, top: 210, width: 20, height: 20 })
    );

    fireEvent.click(dayButton);

    const popover = container.querySelector(`.${styles.monthPopover}`) as HTMLElement;

    expect(popover).toBeTruthy();
    expect(popover.style.left).toBe("68px");
    expect(popover.style.top).toBe("12px");
  });

  it("keeps month popover below the trigger when there is enough space", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });

    const { container } = render(
      <MonthView
        date={new Date("2026-04-22T12:00:00")}
        meals={[]}
        mealTypeProfiles={[filteredProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    const dayButton = screen.getByRole("button", {
      name: /Wednesday, April 22.*Active profile Filtered.*No meals planned\./i,
    });

    vi.spyOn(dayButton, "getBoundingClientRect").mockReturnValue(
      makeRect({ left: 120, top: 240, width: 30, height: 30 })
    );

    fireEvent.click(dayButton);

    const popover = container.querySelector(`.${styles.monthPopover}`) as HTMLElement;

    expect(popover).toBeTruthy();
    expect(popover.style.left).toBe("120px");
    expect(popover.style.top).toBe("278px");
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

    const lunchChip = screen
      .getAllByText("Lunch")
      .find((element) => element.className === styles.popoverMealTypeChip);

    expect(lunchChip).toBeTruthy();
    expect((lunchChip as HTMLElement).style.color).toBe("");
    expect(screen.getByText("Leftover Lunch")).toBeTruthy();
  });

  it("shows always-visible Open Day and Open Week actions in month popover", () => {
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

    expect(screen.getByRole("button", { name: /Open Day/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open Week/i })).toBeTruthy();
  });

  it("keeps month popover open when editing an existing meal", () => {
    const onEdit = vi.fn();

    render(
      <MonthView
        date={new Date("2026-04-22T12:00:00")}
        meals={denseMonthMeals}
        mealTypeProfiles={[filteredProfile]}
        setDate={vi.fn()}
        onEdit={onEdit}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Wednesday, April 22.*Active profile Filtered.*21 meals planned\./i,
      })
    );

    const mealEditButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("Dense Meal 1"));

    expect(mealEditButton).toBeTruthy();
    fireEvent.click(mealEditButton as HTMLElement);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: /Month day meals/i })).toBeTruthy();
  });

  it("keeps month popover open when adding a meal from a slot", () => {
    const onEdit = vi.fn();

    render(
      <MonthView
        date={new Date("2026-04-22T12:00:00")}
        meals={[]}
        mealTypeProfiles={[filteredProfile]}
        setDate={vi.fn()}
        onEdit={onEdit}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Wednesday, April 22.*Active profile Filtered.*No meals planned\./i,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /\+ Add Breakfast/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: /Month day meals/i })).toBeTruthy();
  });

  it("opens day view from month popover with selected date", () => {
    const setDate = vi.fn();
    const onRequestDayView = vi.fn();

    render(
      <MonthView
        date={new Date("2026-04-22T12:00:00")}
        meals={denseMonthMeals}
        mealTypeProfiles={[filteredProfile]}
        setDate={setDate}
        onRequestDayView={onRequestDayView}
        onEdit={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Wednesday, April 22.*Active profile Filtered.*21 meals planned\./i,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Open Day/i }));

    expect(onRequestDayView).toHaveBeenCalledTimes(1);
    expect(setDate).toHaveBeenCalledTimes(1);

    const nextDate = setDate.mock.calls[0]?.[0] as Date;
    expect(nextDate).toBeInstanceOf(Date);
    expect(nextDate.toISOString()).toContain("2026-04-22");
  });

  it("opens week view from month popover with selected date", () => {
    const setDate = vi.fn();
    const onRequestWeekView = vi.fn();

    render(
      <MonthView
        date={new Date("2026-04-22T12:00:00")}
        meals={denseMonthMeals}
        mealTypeProfiles={[filteredProfile]}
        setDate={setDate}
        onRequestWeekView={onRequestWeekView}
        onEdit={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Wednesday, April 22.*Active profile Filtered.*21 meals planned\./i,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Open Week/i }));

    expect(onRequestWeekView).toHaveBeenCalledTimes(1);
    expect(setDate).toHaveBeenCalledTimes(1);

    const nextDate = setDate.mock.calls[0]?.[0] as Date;
    expect(nextDate).toBeInstanceOf(Date);
    expect(nextDate.toISOString()).toContain("2026-04-22");
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
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
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
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
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
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
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

  it("uses the full + Add button for week slots with a single meal", () => {
    render(
      <WeekView
        date={new Date("2026-04-17T12:00:00")}
        meals={[
          {
            id: "single-breakfast",
            date: new Date("2026-04-13T08:00:00"),
            type: "breakfast",
            name: "Avocado Toast",
            mealTypeDefinitionId: "default-breakfast",
          },
        ]}
        mealTypeProfiles={[defaultProfile, weekendProfile]}
        setDate={vi.fn()}
        onEdit={vi.fn()}
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getAllByRole("button", { name: "+ Add" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Add breakfast meal" })).toBeNull();
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
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
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
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
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
        onDropPayload={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Lunch")).toBeTruthy();
    expect(screen.getByText("Leftover Lunch")).toBeTruthy();
  });
});