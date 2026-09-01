// @vitest-environment jsdom

import { cleanup, fireEvent, render as testingRender, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DuplicateMealModal } from "./DuplicateMealModal";
import type { EditableMeal } from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";
import { TooltipProvider } from "@/components/ui/tooltip";

function render(ui: Parameters<typeof testingRender>[0]) {
  return testingRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

const monday = new Date(2026, 4, 18);

const mealTypeProfiles: MealTypeProfilePayload[] = [
  {
    id: "profile-default",
    name: "Default",
    description: null,
    color: "#3b5e45",
    isDefault: true,
    priority: 0,
    startDate: null,
    endDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    mealTypes: [
      {
        id: "breakfast",
        profileId: "profile-default",
        slug: "BREAKFAST",
        name: "Breakfast",
        color: "#f97316",
        enabled: true,
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "dinner",
        profileId: "profile-default",
        slug: "DINNER",
        name: "Dinner",
        color: "#22c55e",
        enabled: true,
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
];

const meal: EditableMeal = {
  id: "meal-1",
  name: "Shakshuka",
  date: monday,
  type: "BREAKFAST",
  sortOrder: 10,
  mealTypeDefinitionId: "breakfast",
  mealTypeDefinition: mealTypeProfiles[0].mealTypes[0],
  mealSubTypeDefinitionId: null,
  mealSubTypeDefinition: null,
  notes: "With feta",
  ingredients: [],
  description: "Tomato and eggs",
  cuisine: "Middle Eastern",
  instructions: ["Cook onions", "Simmer tomatoes", "Poach eggs"],
  servings: 2,
  prepTime: 15,
  cookTime: 20,
  servingsOverride: null,
  recipeId: null,
  linkedRecipe: null,
};

const rangedProfile: MealTypeProfilePayload = {
  ...mealTypeProfiles[0],
  id: "profile-ranged",
  name: "Ranged",
  isDefault: false,
  priority: 10,
  startDate: "2026-05-19T00:00:00",
  endDate: "2026-05-20T00:00:00",
  mealTypes: [
    {
      ...mealTypeProfiles[0].mealTypes[0],
      id: "brunch",
      slug: "BRUNCH",
      name: "Brunch",
    },
    {
      ...mealTypeProfiles[0].mealTypes[1],
      id: "supper",
      slug: "SUPPER",
      name: "Supper",
    },
    {
      ...mealTypeProfiles[0].mealTypes[0],
      id: "locked",
      slug: "LOCKED",
      name: "Locked",
      enabled: false,
    },
  ],
};

const unavailableProfile: MealTypeProfilePayload = {
  ...rangedProfile,
  id: "profile-unavailable",
  name: "Unavailable",
  startDate: "2026-05-21T00:00:00",
  endDate: "2026-05-21T00:00:00",
  mealTypes: [],
};

afterEach(() => {
  cleanup();
});

describe("DuplicateMealModal", () => {
  it("disables duplicating to the source day", () => {
    render(
      <DuplicateMealModal
        isOpen
        meal={meal}
        mealTypeProfiles={mealTypeProfiles}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        referenceDate={monday}
      />
    );

    expect(screen.getByText("Source day")).toBeTruthy();

    const sourceButton = document.querySelector(
      "button[data-source-day='true']"
    );

    expect(sourceButton).toBeTruthy();
    expect(sourceButton).toHaveAttribute("aria-disabled", "true");
  });

  it("marks the current day separately from the source day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 19, 12));

    try {
      render(
        <DuplicateMealModal
          isOpen
          meal={meal}
          mealTypeProfiles={mealTypeProfiles}
          onClose={vi.fn()}
          onDuplicate={vi.fn()}
          referenceDate={monday}
        />
      );

      expect(screen.getByText("Current day")).toBeInTheDocument();
      expect(
        document.querySelector("[data-current-day='true']")
      ).toHaveAttribute("data-source-day", "false");
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends selected day and default target meal type", () => {
    const onDuplicate = vi.fn();

    render(
      <DuplicateMealModal
        isOpen
        meal={meal}
        mealTypeProfiles={mealTypeProfiles}
        onClose={vi.fn()}
        onDuplicate={onDuplicate}
        referenceDate={monday}
      />
    );

    const target = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[data-target-date]")
    ).find(
      (button) => button.dataset.sourceDay === "false" && !button.disabled
    );

    expect(target).toBeTruthy();

    fireEvent.click(target as HTMLButtonElement);

    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDuplicate.mock.calls[0][0]).toMatchObject({
      mealType: "BREAKFAST",
      mealTypeDefinitionId: "breakfast",
    });
  });

  it("applies each meal type definition color to its target control", () => {
    render(
      <DuplicateMealModal
        isOpen
        meal={meal}
        mealTypeProfiles={[mealTypeProfiles[0], rangedProfile]}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        referenceDate={monday}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Tue, May 19, Duplicate as Brunch",
      })
    ).toHaveStyle({ "--meal-type-color": "#f97316" });
    expect(
      screen.getByRole("button", {
        name: "Wed, May 20, Duplicate as Supper",
      })
    ).toHaveStyle({ "--meal-type-color": "#22c55e" });
  });

  it("renders every enabled definition from a date-ranged profile", () => {
    const onDuplicate = vi.fn();

    render(
      <DuplicateMealModal
        isOpen
        meal={meal}
        mealTypeProfiles={[mealTypeProfiles[0], rangedProfile]}
        onClose={vi.fn()}
        onDuplicate={onDuplicate}
        referenceDate={monday}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Tue, May 19, Duplicate as Brunch",
      })
    ).toBeTruthy();
    const supperButton = screen.getByRole("button", {
      name: "Tue, May 19, Duplicate as Supper",
    });

    expect(supperButton).toHaveAttribute(
      "data-meal-type-definition-id",
      "supper"
    );
    fireEvent.click(supperButton);

    expect(onDuplicate).toHaveBeenCalledWith({
      date: new Date(2026, 4, 19),
      mealType: "SUPPER",
      mealTypeDefinitionId: "supper",
    });
  });

  it("omits disabled definitions and disables dates with no available definitions", () => {
    render(
      <DuplicateMealModal
        isOpen
        meal={meal}
        mealTypeProfiles={[
          mealTypeProfiles[0],
          rangedProfile,
          unavailableProfile,
        ]}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        referenceDate={monday}
      />
    );

    expect(
      screen.queryByRole("button", {
        name: "Tue, May 19, Duplicate as Locked",
      })
    ).not.toBeInTheDocument();
    const unavailableDay = screen.getByRole("button", {
      name: "Thu, May 21, No meal types available",
    });

    expect(unavailableDay).toBeDisabled();
  });

  it("moves between future and current weeks without entering a past week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 13, 12));

    render(
      <DuplicateMealModal
        isOpen
        meal={meal}
        mealTypeProfiles={mealTypeProfiles}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        referenceDate={new Date(2026, 4, 25)}
      />
    );

    expect(
      screen.getByRole("button", { name: "Previous week" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(
      screen.getByRole("button", { name: "Previous week" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(
      screen.queryByRole("button", { name: "Previous week" })
    ).not.toBeInTheDocument();
    expect(
      Array.from(
        document.querySelectorAll<HTMLElement>("[data-target-date]")
      ).some((element) => element.dataset.targetDate?.startsWith("2026-05-11"))
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(
      screen.getByRole("button", { name: "Previous week" })
    ).toBeInTheDocument();
    expect(
      Array.from(
        document.querySelectorAll<HTMLElement>("[data-target-date]")
      ).some((element) => element.dataset.targetDate?.startsWith("2026-05-18"))
    ).toBe(true);
  });

  it("updates the source-day indication when the displayed week changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 13, 12));

    render(
      <DuplicateMealModal
        isOpen
        meal={meal}
        mealTypeProfiles={mealTypeProfiles}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        referenceDate={monday}
      />
    );

    expect(screen.getByText("Source day")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.queryByText("Source day")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByText("Source day")).toBeInTheDocument();
  });

  it("disables every definition option and close control while duplicating", () => {
    render(
      <DuplicateMealModal
        isDuplicating
        isOpen
        meal={meal}
        mealTypeProfiles={[mealTypeProfiles[0], rangedProfile]}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        referenceDate={monday}
      />
    );

    expect(
      Array.from(
        document.querySelectorAll<HTMLButtonElement>("button[data-target-date]")
      ).every((button) => button.getAttribute("aria-disabled") === "true")
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Close duplicate meal dialog" })
    ).toBeDisabled();
  });
});
