export type MealTypeValue =
  | "BREAKFAST"
  | "MORNING_SNACK"
  | "LUNCH"
  | "AFTERNOON_SNACK"
  | "DINNER"
  | "SNACK";

export type MealShape = {
  id: string;
  name: string;
  date: string | null;
  mealType: MealTypeValue;
  notes: string | null;
  ingredients: string[];
};

export type MealForwardOp =
  | {
      op: "create";
      meal: MealShape;
    }
  | {
      op: "update";
      id: string;
      patch: {
        name?: string;
        date?: string | null;
        mealType?: MealTypeValue;
        notes?: string | null;
        ingredients?: string[];
      };
    }
  | {
      op: "delete";
      id: string;
    };

export type GrocerySnapshotItem = {
  id: string;
  name: string;
  qty: string | null;
  unit: string | null;
  category: string;
  notes: string | null;
  meal: string | null;
  checked: boolean;
  sortOrder: number;
};

export type GroceryListSnapshot = {
  id: string;
  name: string;
  date: string;
  favourite: boolean;
  items: GrocerySnapshotItem[];
};

export type NamedItem = { id: string; name: string };

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findMatchingItems<T extends NamedItem>(items: T[], phrase: string) {
  const cleaned = normalizeText(phrase).replace(/^(the|a|an)\s+/, "");
  if (!cleaned) return [];

  const exact = items.filter((item) => normalizeText(item.name) === cleaned);
  if (exact.length > 0) return exact;

  return items.filter((item) => normalizeText(item.name).includes(cleaned));
}

export function buildItemChoices<T extends NamedItem>(
  items: T[],
  promptBuilder: (name: string) => string
) {
  return items.slice(0, 6).map((item) => ({
    id: item.id,
    label: item.name,
    prompt: promptBuilder(item.name),
  }));
}

export function resolveRelativeDate(input: string) {
  const today = new Date();
  const lower = normalizeText(input);
  const normalized = lower
    .replace(/[.!?,;:]+$/g, "")
    .replace(/^on\s+/, "")
    .replace(/^for\s+/, "");

  if (
    normalized === "today" ||
    normalized === "tonight" ||
    normalized === "this evening"
  ) {
    return today;
  }

  if (/^tomorrow(?:\s+(?:night|evening))?$/.test(normalized)) {
    const next = new Date(today);
    next.setDate(today.getDate() + 1);
    return next;
  }

  const weekDays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const weekdayMatch = normalized.match(
    /^(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+(?:night|evening))?$/
  );
  const dayKey = weekdayMatch?.[1] ?? normalized;
  const dayIndex = weekDays.indexOf(dayKey);
  if (dayIndex >= 0) {
    const next = new Date(today);
    const delta = (dayIndex - today.getDay() + 7) % 7;
    next.setDate(today.getDate() + (delta === 0 ? 7 : delta));
    return next;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeMealType(value: string): MealTypeValue | null {
  const lower = normalizeText(value).replace(/\s+/g, " ");
  if (lower === "breakfast") return "BREAKFAST";
  if (lower === "morning snack") return "MORNING_SNACK";
  if (lower === "lunch") return "LUNCH";
  if (lower === "afternoon snack") return "AFTERNOON_SNACK";
  if (lower === "dinner") return "DINNER";
  if (lower === "snack") return "SNACK";
  return null;
}

export function formatMealType(type: MealTypeValue) {
  return type.toLowerCase().replace("_", " ");
}

export function toWeekdayName(iso: string | null) {
  if (!iso) {
    return "unscheduled";
  }

  return new Date(iso).toLocaleDateString("en-US", { weekday: "long" });
}

export function toDateLabel(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "unscheduled";
}

export function nextNights(count: number) {
  const today = new Date();
  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  const nights: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
    nights.push(next.toISOString());
  }
  return nights;
}

export function snapshotFromList(list: {
  id: string;
  name: string;
  date: string;
  favourite: boolean;
  items: GrocerySnapshotItem[];
}): GroceryListSnapshot {
  return {
    id: list.id,
    name: list.name,
    date: list.date,
    favourite: list.favourite,
    items: list.items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      category: item.category,
      notes: item.notes,
      meal: item.meal,
      checked: item.checked,
      sortOrder: item.sortOrder,
    })),
  };
}

export function serializeMealOps(ops: MealForwardOp[]) {
  return JSON.stringify({ ops });
}

export function parseMealOps(payloadJson: string): MealForwardOp[] {
  const parsed = JSON.parse(payloadJson) as { ops?: MealForwardOp[] };
  return parsed.ops ?? [];
}

export function serializeSnapshot(snapshot: GroceryListSnapshot) {
  return JSON.stringify({ snapshot });
}

export function parseSnapshot(payloadJson: string): GroceryListSnapshot {
  const parsed = JSON.parse(payloadJson) as { snapshot?: GroceryListSnapshot };
  if (!parsed.snapshot) {
    throw new Error("Invalid action snapshot payload");
  }
  return parsed.snapshot;
}
