import { DEFAULT_MEAL_TYPE_TEMPLATES } from "@shared/api/constants";
import type {
  MealIngredient,
  MealPayload,
  MealTypeDefinitionPayload,
  MealTypeProfilePayload,
} from "@shared/types";

export type CalendarMealType = string;
export type ApiMealType = string;
export type CalendarMeal = MealPayload;

export type LinkedRecipeSummary = {
  id: string;
  title: string;
  description: string | null;
  instructions: string[];
  cookNotes: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  cuisine: string | null;
  ingredients: MealIngredient[];
};

export type EditableMeal = {
  id: string;
  name: string;
  date: Date;
  type: CalendarMealType;
  mealTypeDefinitionId: string | null;
  mealTypeDefinition: MealTypeDefinitionPayload | null;
  notes: string;
  ingredients: MealIngredient[];
  description: string;
  cuisine: string | null;
  instructions: string[];
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  servingsOverride: number | null;
  recipeId: string | null;
  linkedRecipe: LinkedRecipeSummary | null;
};

export function formatMealIngredient(ingredient: MealIngredient) {
  const parts = [ingredient.quantity, ingredient.unit, ingredient.name]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .map((part) => part?.trim());

  return parts.join(" ").trim() || ingredient.name;
}

export type MealSlot = {
  type: CalendarMealType;
  meals: EditableMeal[];
};

export type MealTypeConfig = {
  dot: string;
  bg: string;
  text: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
};

export type MealTypeProfileContext = {
  profile: MealTypeProfilePayload;
  mealTypes: MealTypeDefinitionPayload[];
  accentColor: string;
  isProfileStart: boolean;
  isProfileEnd: boolean;
  rangeLabel: string | null;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    red: (value >> 16) & 255,
    green: (value >> 8) & 255,
    blue: value & 255,
  };
}

function mixHex(baseHex: string, targetHex: string, ratio: number) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  const weight = clamp(ratio, 0, 1);

  const red = Math.round(base.red + (target.red - base.red) * weight);
  const green = Math.round(base.green + (target.green - base.green) * weight);
  const blue = Math.round(base.blue + (target.blue - base.blue) * weight);

  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function getTextColor(hex: string) {
  const { red, green, blue } = hexToRgb(hex);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.56 ? "#243127" : mixHex(hex, "#111111", 0.45);
}

function humanizeMealType(slug: string) {
  return slug
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function parseCalendarDate(value: string | Date | null) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const match = DATE_ONLY_PATTERN.exec(value);

    if (match) {
      return new Date(
        Number.parseInt(match[1], 10),
        Number.parseInt(match[2], 10) - 1,
        Number.parseInt(match[3], 10),
        12,
        0,
        0,
        0
      );
    }
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    12,
    0,
    0,
    0
  );
}

export function getDefaultMealTypeDefinitions(): MealTypeDefinitionPayload[] {
  return DEFAULT_MEAL_TYPE_TEMPLATES.map((template) => ({
    id: `default-${template.slug}`,
    profileId: "default-profile",
    name: template.name,
    slug: template.slug,
    color: template.color,
    enabled: template.enabled,
    sortOrder: template.sortOrder,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
}

export function getDefaultMealTypeProfile(): MealTypeProfilePayload {
  const definitions = getDefaultMealTypeDefinitions();

  return {
    id: "default-profile",
    name: "Default",
    color: "#3B5E45",
    description: "Default meal types for everyday planning.",
    isDefault: true,
    priority: 0,
    startDate: null,
    endDate: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    mealTypes: definitions,
  };
}

function normalizeProfileBoundary(value: string | null, endOfDay: boolean) {
  const date = parseCalendarDate(value);
  if (!date) {
    return null;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

export function resolveMealTypeProfileForDate(
  date: Date,
  profiles: MealTypeProfilePayload[]
) {
  if (profiles.length === 0) {
    return getDefaultMealTypeProfile();
  }

  const sortedProfiles = profiles.slice().sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? 1 : -1;
    }

    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });

  const matchingProfile = sortedProfiles.find((profile) => {
    if (profile.isDefault) {
      return false;
    }

    const start = normalizeProfileBoundary(profile.startDate, false);
    const end = normalizeProfileBoundary(profile.endDate, true);
    const value = normalizeMealDate(date).getTime();

    if (start && value < start.getTime()) {
      return false;
    }

    if (end && value > end.getTime()) {
      return false;
    }

    return true;
  });

  return (
    matchingProfile ??
    sortedProfiles.find((profile) => profile.isDefault) ??
    sortedProfiles[0] ??
    getDefaultMealTypeProfile()
  );
}

export function getMealTypeDefinitionsForDate(
  date: Date,
  profiles: MealTypeProfilePayload[]
) {
  return resolveMealTypeProfileForDate(date, profiles).mealTypes;
}

export function mergeMealTypeDefinitions(
  definitionSets: MealTypeDefinitionPayload[][]
) {
  const definitionsBySlug = new Map<string, MealTypeDefinitionPayload>();

  for (const definitions of definitionSets) {
    for (const definition of definitions) {
      const existing = definitionsBySlug.get(definition.slug);

      if (!existing) {
        definitionsBySlug.set(definition.slug, definition);
        continue;
      }

      const shouldReplace =
        (!existing.enabled && definition.enabled) ||
        definition.sortOrder < existing.sortOrder ||
        (definition.sortOrder === existing.sortOrder && definition.name < existing.name);

      if (shouldReplace) {
        definitionsBySlug.set(definition.slug, definition);
      }
    }
  }

  return Array.from(definitionsBySlug.values()).sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );
}

function formatShortDate(value: string) {
  const date = parseCalendarDate(value);

  if (!date) {
    return null;
  }

  return date.toLocaleDateString("default", {
    month: "short",
    day: "numeric",
  });
}

export function formatMealTypeProfileRange(profile: MealTypeProfilePayload) {
  const start = profile.startDate ? formatShortDate(profile.startDate) : null;
  const end = profile.endDate ? formatShortDate(profile.endDate) : null;

  if (start && end) {
    return `${start} - ${end}`;
  }

  if (start) {
    return `From ${start}`;
  }

  if (end) {
    return `Until ${end}`;
  }

  return null;
}

export function getMealTypeProfileAccent(profile: MealTypeProfilePayload) {
  if (profile.color) {
    return profile.color;
  }

  const sortedDefinitions = profile.mealTypes
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return (
    sortedDefinitions.find((definition) => definition.enabled)?.color ??
    sortedDefinitions[0]?.color ??
    "#3B5E45"
  );
}

export function getMealTypeProfileContext(
  date: Date,
  profiles: MealTypeProfilePayload[]
): MealTypeProfileContext {
  const profile = resolveMealTypeProfileForDate(date, profiles);
  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  const previousProfile = resolveMealTypeProfileForDate(previousDate, profiles);
  const nextProfile = resolveMealTypeProfileForDate(nextDate, profiles);

  return {
    profile,
    mealTypes: profile.mealTypes,
    accentColor: getMealTypeProfileAccent(profile),
    isProfileStart: previousProfile.id !== profile.id,
    isProfileEnd: nextProfile.id !== profile.id,
    rangeLabel: formatMealTypeProfileRange(profile),
  };
}

export function getMealTypeProfileContexts(
  dates: Date[],
  profiles: MealTypeProfilePayload[]
) {
  return dates.map((date) => getMealTypeProfileContext(date, profiles));
}

export function eachDayInRange(from: Date, to: Date) {
  const dates: Date[] = [];
  const current = normalizeMealDate(from);
  const end = normalizeMealDate(to);

  while (current.getTime() <= end.getTime()) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function buildMonthCellAriaLabel(
  date: Date,
  profileContext: MealTypeProfileContext,
  meals: EditableMeal[]
) {
  const parts = [
    date.toLocaleDateString("default", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    `Active profile ${profileContext.profile.name}`,
  ];

  if (profileContext.isProfileStart) {
    parts.push("Profile starts today");
  }

  if (profileContext.isProfileEnd) {
    parts.push("Profile ends today");
  }

  if (meals.length === 0) {
    parts.push("No meals planned");
  } else {
    parts.push(`${meals.length} meal${meals.length === 1 ? "" : "s"} planned`);
  }

  return `${parts.join(". ")}.`;
}

export function buildTypeConfig(definitions: MealTypeDefinitionPayload[]) {
  const config: Record<string, MealTypeConfig> = {};

  for (const definition of definitions) {
    config[definition.slug] = {
      dot: definition.color,
      bg: mixHex(definition.color, "#FFFFFF", 0.82),
      text: getTextColor(definition.color),
      label: definition.name,
      enabled: definition.enabled,
      sortOrder: definition.sortOrder,
    };
  }

  return config;
}

export function getMealTypeOrder(definitions: MealTypeDefinitionPayload[]) {
  return definitions
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((definition) => definition.slug);
}

export function getTypeConfig(
  mealType: string,
  definitions: MealTypeDefinitionPayload[] = getDefaultMealTypeDefinitions()
) {
  const config = buildTypeConfig(definitions);
  return (
    config[mealType] ?? {
      dot: "#6A7C91",
      bg: mixHex("#6A7C91", "#FFFFFF", 0.82),
      text: getTextColor("#6A7C91"),
      label: humanizeMealType(mealType),
      enabled: true,
      sortOrder: Number.MAX_SAFE_INTEGER,
    }
  );
}

export function toCalendarMealType(mealType: ApiMealType): CalendarMealType {
  return mealType;
}

export function fromCalendarMealType(mealType: CalendarMealType): ApiMealType {
  return mealType;
}

export function toEditableMeal(meal: CalendarMeal): EditableMeal {
  return {
    id: meal.id,
    name: meal.name,
    date: new Date(meal.date ?? new Date().toISOString()),
    type: toCalendarMealType(meal.mealTypeDefinition?.slug ?? meal.mealType),
    mealTypeDefinitionId: meal.mealTypeDefinitionId,
    mealTypeDefinition: meal.mealTypeDefinition,
    notes: meal.notes ?? "",
    ingredients: meal.ingredients ?? [],
    description: meal.description ?? "",
    cuisine: meal.cuisine ?? null,
    instructions: meal.instructions ?? [],
    servings: meal.servings ?? 2,
    prepTime: meal.prepTime ?? null,
    cookTime: meal.cookTime ?? null,
    servingsOverride: meal.servingsOverride ?? null,
    recipeId: meal.recipeId ?? null,
    linkedRecipe: meal.linkedRecipe ?? null,
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
  "December",
];

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const normalizeMealDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);

export const mealsForDay = (
  meals: EditableMeal[],
  date: Date,
  definitions: MealTypeDefinitionPayload[] = getDefaultMealTypeDefinitions()
) => {
  const order = getMealTypeOrder(definitions);
  const orderIndex = new Map(order.map((type, index) => [type, index]));

  return meals
    .filter((meal) => isSameDay(meal.date, date))
    .sort(
      (left, right) =>
        (orderIndex.get(left.type) ?? Number.MAX_SAFE_INTEGER) -
          (orderIndex.get(right.type) ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name)
    );
};

export const createMealSlots = (
  meals: EditableMeal[],
  date: Date,
  definitions: MealTypeDefinitionPayload[] = getDefaultMealTypeDefinitions()
): MealSlot[] => {
  const dayMeals = mealsForDay(meals, date, definitions);
  const configuredTypes = definitions
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .filter(
      (definition) =>
        definition.enabled || dayMeals.some((meal) => meal.type === definition.slug)
    )
    .map((definition) => definition.slug);

  const unknownTypes = dayMeals
    .map((meal) => meal.type)
    .filter((type, index, values) => values.indexOf(type) === index)
    .filter((type) => !configuredTypes.includes(type));

  return [...configuredTypes, ...unknownTypes].map((type) => ({
    type,
    meals: dayMeals.filter((meal) => meal.type === type),
  }));
};

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
  const to = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  return { from, to };
}

export function createEmptyMeal(
  date: Date,
  type: CalendarMealType,
  mealTypeDefinition?: MealTypeDefinitionPayload | null
): EditableMeal {
  return {
    id: "",
    name: "",
    date: normalizeMealDate(date),
    type,
    mealTypeDefinitionId: mealTypeDefinition?.id ?? null,
    mealTypeDefinition: mealTypeDefinition ?? null,
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
  };
}
