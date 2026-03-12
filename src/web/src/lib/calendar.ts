export const MEAL_TYPES = [
  "breakfast",
  "morning snack",
  "lunch",
  "afternoon snack",
  "dinner"
] as const;

export type CalendarMealType = (typeof MEAL_TYPES)[number];

export type ApiMealType =
  | "BREAKFAST"
  | "MORNING_SNACK"
  | "LUNCH"
  | "AFTERNOON_SNACK"
  | "DINNER"
  | "SNACK";

export type CalendarMeal = {
  id: string;
  mealPlanId: string | null;
  name: string;
  date: string;
  mealType: ApiMealType;
  notes: string | null;
  ingredients: string[];
};

export type EditableMeal = {
  id: string;
  mealPlanId: string | null;
  name: string;
  date: Date;
  type: CalendarMealType;
  notes: string;
  ingredients: string[];
};

export const TYPE_CONFIG: Record<
  CalendarMealType,
  { dot: string; bg: string; text: string; label: string }
> = {
  breakfast: { dot: "#E8885A", bg: "#FDF0E8", text: "#A0441A", label: "BREAKFAST" },
  "morning snack": { dot: "#C5A84B", bg: "#FBF6E8", text: "#8A6E20", label: "MORNING SNACK" },
  lunch: { dot: "#5A7D63", bg: "#EAF2EC", text: "#2E5438", label: "LUNCH" },
  "afternoon snack": { dot: "#8A7DB8", bg: "#F0EDF8", text: "#5A4D8A", label: "AFTERNOON SNACK" },
  dinner: { dot: "#3B5E45", bg: "#D4E4D8", text: "#1E3A26", label: "DINNER" }
};

export function toCalendarMealType(mealType: ApiMealType): CalendarMealType {
  switch (mealType) {
    case "BREAKFAST":
      return "breakfast";
    case "MORNING_SNACK":
      return "morning snack";
    case "LUNCH":
      return "lunch";
    case "AFTERNOON_SNACK":
    case "SNACK":
      return "afternoon snack";
    case "DINNER":
      return "dinner";
  }
}

export function fromCalendarMealType(mealType: CalendarMealType): Exclude<ApiMealType, "SNACK"> {
  switch (mealType) {
    case "breakfast":
      return "BREAKFAST";
    case "morning snack":
      return "MORNING_SNACK";
    case "lunch":
      return "LUNCH";
    case "afternoon snack":
      return "AFTERNOON_SNACK";
    case "dinner":
      return "DINNER";
  }
}

export function toEditableMeal(meal: CalendarMeal): EditableMeal {
  return {
    id: meal.id,
    mealPlanId: meal.mealPlanId,
    name: meal.name,
    date: new Date(meal.date),
    type: toCalendarMealType(meal.mealType),
    notes: meal.notes ?? "",
    ingredients: meal.ingredients ?? []
  };
}

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const mealsForDay = (meals: EditableMeal[], date: Date) =>
  meals
    .filter((meal) => isSameDay(meal.date, date))
    .sort((left, right) => MEAL_TYPES.indexOf(left.type) - MEAL_TYPES.indexOf(right.type));

export function getMonday(date: Date) {
  const monday = new Date(date);
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toRangeByView(view: "day" | "week" | "month", date: Date) {
  if (view === "day") {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (view === "week") {
    const mon = getMonday(date);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return { from: mon, to: sun };
  }

  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

export function createEmptyMeal(date: Date, type: CalendarMealType): EditableMeal {
  return {
    id: "",
    mealPlanId: null,
    name: "",
    date,
    type,
    notes: "",
    ingredients: []
  };
}
