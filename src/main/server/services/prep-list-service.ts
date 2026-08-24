import type {
  MealIngredient,
  MealPayload,
  PrepItemKind,
  PrepListGenerateInput,
  PrepListGroupBy,
  PrepListSortMode,
  PrepListSourceMode,
} from "@shared/types";

import { bootstrapDatabase } from "../lib/bootstrap";
import { prisma } from "../lib/prisma";
import {
  emitCommittedChange,
  publishCommittedChange,
  reserveCommittedChange,
} from "./change-event-bus";
import { MealService } from "./meal-service";

type PrepItemRecord = {
  id: string;
  kind: string;
  name: string;
  qty: string | null;
  unit: string | null;
  ingredientType: string | null;
  prepGroup: string | null;
  dish: string | null;
  notes: string | null;
  checked: boolean;
  sortOrder: number;
  sourceMealIdsJson: string;
  sourceRecipeIdsJson: string;
  sourceLabelsJson: string;
};

type PrepListRecord = {
  id: string;
  name: string;
  notes: string | null;
  date: Date | null;
  fromDate: Date | null;
  toDate: Date | null;
  sourceMode: string;
  sourceLabel: string | null;
  sourceMealIdsJson: string;
  sourceRecipeIdsJson: string;
  favourite: boolean;
  sortMode: string;
  groupBy: string;
  includeIngredients: boolean;
  includeTasks: boolean;
  includeQuantities: boolean;
  includeIngredientTypes: boolean;
  includeSourceLabels: boolean;
  excludePantryStaples: boolean;
  createdAt: Date;
  updatedAt: Date;
  items: PrepItemRecord[];
};

type CreatePrepListInput = {
  name: string;
  notes?: string | null;
  date?: string | Date | null;
  fromDate?: string | Date | null;
  toDate?: string | Date | null;
  sourceMode?: PrepListSourceMode;
  sourceLabel?: string | null;
  sourceMealIds?: string[];
  sourceRecipeIds?: string[];
  favourite?: boolean;
  sortMode?: PrepListSortMode;
  groupBy?: PrepListGroupBy;
  includeIngredients?: boolean;
  includeTasks?: boolean;
  includeQuantities?: boolean;
  includeIngredientTypes?: boolean;
  includeSourceLabels?: boolean;
  excludePantryStaples?: boolean;
  items?: CreatePrepItemInput[];
};

type UpdatePrepListInput = Partial<
  Omit<CreatePrepListInput, "items" | "sourceMealIds" | "sourceRecipeIds">
>;

type CreatePrepItemInput = {
  kind?: PrepItemKind;
  name: string;
  qty?: string | null;
  unit?: string | null;
  ingredientType?: string | null;
  prepGroup?: string | null;
  dish?: string | null;
  notes?: string | null;
  checked?: boolean;
  sourceMealIds?: string[];
  sourceRecipeIds?: string[];
  sourceLabels?: string[];
};

type UpdatePrepItemInput = Partial<CreatePrepItemInput>;

type GenerateDraft = Omit<CreatePrepListInput, "name"> & {
  items: CreatePrepItemInput[];
};

type GeneratedItem = Required<Pick<CreatePrepItemInput, "kind" | "name">> &
  Omit<CreatePrepItemInput, "kind" | "name"> & { quantityValue?: number | null };

const DEFAULT_GROUP_BY: PrepListGroupBy = "dish";
const DEFAULT_SORT_MODE: PrepListSortMode = "manual";

function toDate(value: string | Date | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date provided");
  }

  return parsed;
}

function parseJsonStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function serializeStringArray(value: string[] | undefined) {
  return JSON.stringify([...(value ?? [])]);
}

function coerceSourceMode(value: string): PrepListSourceMode {
  const allowed: PrepListSourceMode[] = [
    "manual",
    "single-meal",
    "meal-slot",
    "day",
    "week",
    "month",
    "date-range",
    "historical",
  ];

  return allowed.includes(value as PrepListSourceMode)
    ? (value as PrepListSourceMode)
    : "manual";
}

function coerceSortMode(value: string): PrepListSortMode {
  const allowed: PrepListSortMode[] = ["manual", "name", "dish", "type", "kind", "checked"];
  return allowed.includes(value as PrepListSortMode)
    ? (value as PrepListSortMode)
    : DEFAULT_SORT_MODE;
}

function coerceGroupBy(value: string): PrepListGroupBy {
  const allowed: PrepListGroupBy[] = ["dish", "type", "prepGroup", "kind", "none"];
  return allowed.includes(value as PrepListGroupBy)
    ? (value as PrepListGroupBy)
    : DEFAULT_GROUP_BY;
}

function serializePrepList(prepList: PrepListRecord) {
  const checkedCount = prepList.items.filter((item) => item.checked).length;

  return {
    id: prepList.id,
    name: prepList.name,
    notes: prepList.notes,
    date: prepList.date ? prepList.date.toISOString() : null,
    fromDate: prepList.fromDate ? prepList.fromDate.toISOString() : null,
    toDate: prepList.toDate ? prepList.toDate.toISOString() : null,
    sourceMode: coerceSourceMode(prepList.sourceMode),
    sourceLabel: prepList.sourceLabel,
    sourceMealIds: parseJsonStringArray(prepList.sourceMealIdsJson),
    sourceRecipeIds: parseJsonStringArray(prepList.sourceRecipeIdsJson),
    favourite: prepList.favourite,
    sortMode: coerceSortMode(prepList.sortMode),
    groupBy: coerceGroupBy(prepList.groupBy),
    includeIngredients: prepList.includeIngredients,
    includeTasks: prepList.includeTasks,
    includeQuantities: prepList.includeQuantities,
    includeIngredientTypes: prepList.includeIngredientTypes,
    includeSourceLabels: prepList.includeSourceLabels,
    excludePantryStaples: prepList.excludePantryStaples,
    createdAt: prepList.createdAt.toISOString(),
    updatedAt: prepList.updatedAt.toISOString(),
    checkedCount,
    totalItems: prepList.items.length,
    completionPercentage:
      prepList.items.length === 0
        ? 0
        : Math.round((checkedCount / prepList.items.length) * 100),
    items: prepList.items
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => ({
        id: item.id,
        kind: item.kind === "task" ? "task" : "ingredient",
        name: item.name,
        qty: item.qty,
        unit: item.unit,
        ingredientType: item.ingredientType,
        prepGroup: item.prepGroup,
        dish: item.dish,
        notes: item.notes,
        checked: item.checked,
        sortOrder: item.sortOrder,
        sourceMealIds: parseJsonStringArray(item.sourceMealIdsJson),
        sourceRecipeIds: parseJsonStringArray(item.sourceRecipeIdsJson),
        sourceLabels: parseJsonStringArray(item.sourceLabelsJson),
      })),
  };
}

function comparePrepLists(
  left: { date: Date | null; createdAt: Date },
  right: { date: Date | null; createdAt: Date }
) {
  const leftOngoing = left.date === null;
  const rightOngoing = right.date === null;

  if (leftOngoing && rightOngoing) {
    return right.createdAt.getTime() - left.createdAt.getTime();
  }
  if (leftOngoing) return -1;
  if (rightOngoing) return 1;

  const dateDiff = left.date!.getTime() - right.date!.getTime();
  return dateDiff !== 0
    ? dateDiff
    : right.createdAt.getTime() - left.createdAt.getTime();
}

async function getListOrThrow(id: string) {
  const prepList = await prisma.prepList.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!prepList) {
    throw new Error("Prep list not found");
  }

  return prepList;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseQuantity(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }

  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    return Number(fraction[1]) / Number(fraction[2]);
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function getIngredientType(ingredient: MealIngredient) {
  return ingredient.group?.trim() || "Ingredient";
}

function mealRecipeId(meal: MealPayload) {
  return meal.linkedRecipe?.id ?? meal.recipeId ?? null;
}

function getMealIngredients(meal: MealPayload) {
  return meal.linkedRecipe?.ingredients?.length
    ? meal.linkedRecipe.ingredients
    : meal.ingredients;
}

function addGeneratedIngredient(
  map: Map<string, GeneratedItem>,
  meal: MealPayload,
  ingredient: MealIngredient,
  includeQuantities: boolean
) {
  const name = ingredient.name.trim();
  if (!name) return;

  const unit = ingredient.unit?.trim() || null;
  const key = `${normalizeName(name)}::${unit ?? ""}`;
  const recipeId = mealRecipeId(meal);
  const quantityValue = parseQuantity(ingredient.quantity);
  const existing = map.get(key);

  if (!existing) {
    map.set(key, {
      kind: "ingredient",
      name,
      qty: includeQuantities ? ingredient.quantity : null,
      unit,
      ingredientType: getIngredientType(ingredient),
      prepGroup: ingredient.group,
      dish: meal.name,
      notes: ingredient.notes,
      sourceMealIds: [meal.id],
      sourceRecipeIds: recipeId ? [recipeId] : [],
      sourceLabels: [meal.name],
      quantityValue,
    });
    return;
  }

  existing.sourceMealIds = Array.from(new Set([...(existing.sourceMealIds ?? []), meal.id]));
  existing.sourceLabels = Array.from(new Set([...(existing.sourceLabels ?? []), meal.name]));
  if (recipeId) {
    existing.sourceRecipeIds = Array.from(
      new Set([...(existing.sourceRecipeIds ?? []), recipeId])
    );
  }
  if (existing.dish && existing.dish !== meal.name) {
    existing.dish = "Multiple dishes";
  }

  if (includeQuantities && quantityValue !== null && existing.quantityValue !== null) {
    existing.quantityValue = (existing.quantityValue ?? 0) + quantityValue;
    existing.qty = formatQuantity(existing.quantityValue);
  } else if (includeQuantities && ingredient.quantity && existing.qty !== ingredient.quantity) {
    existing.notes = [existing.notes, `${meal.name}: ${ingredient.quantity}${unit ? ` ${unit}` : ""}`]
      .filter(Boolean)
      .join("; ");
  }
}

function buildTaskItems(meal: MealPayload) {
  const taskNames = new Set<string>();
  const candidates = [...meal.instructions, ...(meal.linkedRecipe?.instructions ?? [])];
  const prepVerbPattern = /\b(chop|slice|dice|mince|wash|rinse|marinate|soak|trim|peel|grate|mix|whisk|preheat)\b/i;

  candidates.forEach((instruction) => {
    const trimmed = instruction.trim();
    if (trimmed && prepVerbPattern.test(trimmed)) {
      taskNames.add(trimmed);
    }
  });

  return Array.from(taskNames).slice(0, 8).map<GeneratedItem>((name) => ({
    kind: "task",
    name,
    qty: null,
    unit: null,
    ingredientType: null,
    prepGroup: "Prep task",
    dish: meal.name,
    notes: null,
    sourceMealIds: [meal.id],
    sourceRecipeIds: mealRecipeId(meal) ? [mealRecipeId(meal)!] : [],
    sourceLabels: [meal.name],
  }));
}

export class PrepListService {
  private readonly mealService: MealService;

  constructor(options?: { mealService?: MealService }) {
    this.mealService = options?.mealService ?? new MealService();
  }

  async listPrepLists() {
    await bootstrapDatabase();

    const prepLists = await prisma.prepList.findMany({
      include: { items: true },
      orderBy: [{ createdAt: "desc" }],
    });

    return [...prepLists].sort(comparePrepLists).map(serializePrepList);
  }

  async getCurrentPrepList() {
    await bootstrapDatabase();

    const prepLists = await prisma.prepList.findMany({
      include: { items: true },
      orderBy: [{ createdAt: "desc" }],
    });

    const prepList = [...prepLists].sort(comparePrepLists)[0] ?? null;
    return prepList ? serializePrepList(prepList) : null;
  }

  async getPrepList(id: string) {
    await bootstrapDatabase();

    const prepList = await prisma.prepList.findUnique({
      where: { id },
      include: { items: true },
    });

    return prepList ? serializePrepList(prepList) : null;
  }

  async createPrepList(input: CreatePrepListInput) {
    await bootstrapDatabase();

    const prepList = await prisma.prepList.create({
      data: {
        name: input.name,
        notes: input.notes ?? null,
        date: toDate(input.date),
        fromDate: toDate(input.fromDate),
        toDate: toDate(input.toDate),
        sourceMode: input.sourceMode ?? "manual",
        sourceLabel: input.sourceLabel,
        sourceMealIdsJson: serializeStringArray(input.sourceMealIds),
        sourceRecipeIdsJson: serializeStringArray(input.sourceRecipeIds),
        favourite: input.favourite ?? false,
        sortMode: input.sortMode ?? DEFAULT_SORT_MODE,
        groupBy: input.groupBy ?? DEFAULT_GROUP_BY,
        includeIngredients: input.includeIngredients ?? true,
        includeTasks: input.includeTasks ?? true,
        includeQuantities: input.includeQuantities ?? true,
        includeIngredientTypes: input.includeIngredientTypes ?? true,
        includeSourceLabels: input.includeSourceLabels ?? true,
        excludePantryStaples: input.excludePantryStaples ?? false,
        items: {
          create: (input.items ?? []).map((item, index) => ({
            kind: item.kind ?? "ingredient",
            name: item.name,
            qty: item.qty,
            unit: item.unit,
            ingredientType: item.ingredientType,
            prepGroup: item.prepGroup,
            dish: item.dish,
            notes: item.notes,
            checked: item.checked ?? false,
            sortOrder: index,
            sourceMealIdsJson: serializeStringArray(item.sourceMealIds),
            sourceRecipeIdsJson: serializeStringArray(item.sourceRecipeIds),
            sourceLabelsJson: serializeStringArray(item.sourceLabels),
          })),
        },
      },
      include: { items: true },
    });

    await publishCommittedChange("prepList", "create", prepList.id);
    return serializePrepList(prepList);
  }

  async generatePrepList(input: PrepListGenerateInput) {
    const draft = await this.buildGeneratedDraft(input);

    return this.createPrepList({
      name: input.name?.trim() || draft.sourceLabel || "Generated Prep List",
      notes: input.notes ?? null,
      ...draft,
    });
  }

  async regeneratePrepList(id: string) {
    await bootstrapDatabase();

    const existing = serializePrepList((await getListOrThrow(id)) as PrepListRecord);
    if (existing.sourceMode === "manual") {
      throw new Error("Manual prep lists cannot be regenerated");
    }

    const input: PrepListGenerateInput = {
      name: existing.name,
      notes: existing.notes,
      sourceMode: existing.sourceMode,
      mealIds: existing.sourceMode === "single-meal" ? existing.sourceMealIds : undefined,
      mealType:
        existing.sourceMode === "meal-slot"
          ? existing.sourceLabel?.split(" from ")[0] ?? undefined
          : undefined,
      fromDate: existing.fromDate ?? existing.date,
      toDate: existing.toDate ?? existing.date,
      date: existing.date,
      favourite: existing.favourite,
      sortMode: existing.sortMode,
      groupBy: existing.groupBy,
      includeIngredients: existing.includeIngredients,
      includeTasks: existing.includeTasks,
      includeQuantities: existing.includeQuantities,
      includeIngredientTypes: existing.includeIngredientTypes,
      includeSourceLabels: existing.includeSourceLabels,
      excludePantryStaples: existing.excludePantryStaples,
    };

    const draft = await this.buildGeneratedDraft(input);

    await prisma.$transaction(async (tx) => {
      await tx.prepList.update({
        where: { id },
        data: {
          date: toDate(draft.date),
          fromDate: toDate(draft.fromDate),
          toDate: toDate(draft.toDate),
          sourceMode: draft.sourceMode ?? existing.sourceMode,
          sourceLabel: draft.sourceLabel,
          sourceMealIdsJson: serializeStringArray(draft.sourceMealIds),
          sourceRecipeIdsJson: serializeStringArray(draft.sourceRecipeIds),
          favourite: draft.favourite ?? existing.favourite,
          sortMode: draft.sortMode ?? existing.sortMode,
          groupBy: draft.groupBy ?? existing.groupBy,
          includeIngredients: draft.includeIngredients ?? existing.includeIngredients,
          includeTasks: draft.includeTasks ?? existing.includeTasks,
          includeQuantities: draft.includeQuantities ?? existing.includeQuantities,
          includeIngredientTypes:
            draft.includeIngredientTypes ?? existing.includeIngredientTypes,
          includeSourceLabels: draft.includeSourceLabels ?? existing.includeSourceLabels,
          excludePantryStaples:
            draft.excludePantryStaples ?? existing.excludePantryStaples,
        },
      });

      await tx.prepItem.deleteMany({ where: { prepListId: id } });
      if (draft.items.length > 0) {
        await tx.prepItem.createMany({
          data: draft.items.map((item, index) => ({
            id: undefined,
            prepListId: id,
            kind: item.kind ?? "ingredient",
            name: item.name,
            qty: item.qty,
            unit: item.unit,
            ingredientType: item.ingredientType,
            prepGroup: item.prepGroup,
            dish: item.dish,
            notes: item.notes,
            checked: item.checked ?? false,
            sortOrder: index,
            sourceMealIdsJson: serializeStringArray(item.sourceMealIds),
            sourceRecipeIdsJson: serializeStringArray(item.sourceRecipeIds),
            sourceLabelsJson: serializeStringArray(item.sourceLabels),
          })),
        });
      }
    });

    await publishCommittedChange("prepList", "bulk", id);
    return serializePrepList((await getListOrThrow(id)) as PrepListRecord);
  }

  async updatePrepList(id: string, input: UpdatePrepListInput) {
    await bootstrapDatabase();

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.date !== undefined) data.date = toDate(input.date);
    if (input.fromDate !== undefined) data.fromDate = toDate(input.fromDate);
    if (input.toDate !== undefined) data.toDate = toDate(input.toDate);
    if (input.sourceMode !== undefined) data.sourceMode = input.sourceMode;
    if (input.sourceLabel !== undefined) data.sourceLabel = input.sourceLabel;
    if (input.favourite !== undefined) data.favourite = input.favourite;
    if (input.sortMode !== undefined) data.sortMode = input.sortMode;
    if (input.groupBy !== undefined) data.groupBy = input.groupBy;
    if (input.includeIngredients !== undefined) data.includeIngredients = input.includeIngredients;
    if (input.includeTasks !== undefined) data.includeTasks = input.includeTasks;
    if (input.includeQuantities !== undefined) data.includeQuantities = input.includeQuantities;
    if (input.includeIngredientTypes !== undefined) {
      data.includeIngredientTypes = input.includeIngredientTypes;
    }
    if (input.includeSourceLabels !== undefined) {
      data.includeSourceLabels = input.includeSourceLabels;
    }
    if (input.excludePantryStaples !== undefined) {
      data.excludePantryStaples = input.excludePantryStaples;
    }

    const prepList = await prisma.prepList.update({
      where: { id },
      data,
      include: { items: true },
    });

    await publishCommittedChange("prepList", "update", id);
    return serializePrepList(prepList);
  }

  async deletePrepList(id: string) {
    await bootstrapDatabase();
    await prisma.prepList.delete({ where: { id } });
    await publishCommittedChange("prepList", "delete", id);
    return { id };
  }

  async createPrepItem(prepListId: string, input: CreatePrepItemInput) {
    await bootstrapDatabase();

    const maxOrder = await prisma.prepItem.aggregate({
      where: { prepListId },
      _max: { sortOrder: true },
    });

    const change = await prisma.$transaction(async (tx) => {
      await tx.prepItem.create({
        data: {
          prepListId,
          kind: input.kind ?? "ingredient",
          name: input.name,
          qty: input.qty,
          unit: input.unit,
          ingredientType: input.ingredientType,
          prepGroup: input.prepGroup,
          dish: input.dish,
          notes: input.notes,
          checked: input.checked ?? false,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          sourceMealIdsJson: serializeStringArray(input.sourceMealIds),
          sourceRecipeIdsJson: serializeStringArray(input.sourceRecipeIds),
          sourceLabelsJson: serializeStringArray(input.sourceLabels),
        },
      });
      return reserveCommittedChange(tx, "prepList", "update", prepListId);
    });

    emitCommittedChange(change);
    return serializePrepList(await getListOrThrow(prepListId));
  }

  async updatePrepItem(prepListId: string, itemId: string, input: UpdatePrepItemInput) {
    await bootstrapDatabase();

    const existing = await prisma.prepItem.findUnique({
      where: { id: itemId },
      select: { prepListId: true },
    });

    if (!existing || existing.prepListId !== prepListId) {
      throw new Error("Prep item not found");
    }

    await prisma.prepItem.update({
      where: { id: itemId },
      data: {
        kind: input.kind,
        name: input.name,
        qty: input.qty,
        unit: input.unit,
        ingredientType: input.ingredientType,
        prepGroup: input.prepGroup,
        dish: input.dish,
        notes: input.notes,
        checked: input.checked,
        sourceMealIdsJson:
          input.sourceMealIds === undefined
            ? undefined
            : serializeStringArray(input.sourceMealIds),
        sourceRecipeIdsJson:
          input.sourceRecipeIds === undefined
            ? undefined
            : serializeStringArray(input.sourceRecipeIds),
        sourceLabelsJson:
          input.sourceLabels === undefined
            ? undefined
            : serializeStringArray(input.sourceLabels),
      },
    });

    await publishCommittedChange("prepList", "update", prepListId);
    return serializePrepList(await getListOrThrow(prepListId));
  }

  async deletePrepItem(prepListId: string, itemId: string) {
    await bootstrapDatabase();

    const existing = await prisma.prepItem.findUnique({
      where: { id: itemId },
      select: { prepListId: true },
    });

    if (!existing || existing.prepListId !== prepListId) {
      throw new Error("Prep item not found");
    }

    await prisma.prepItem.delete({ where: { id: itemId } });
    await publishCommittedChange("prepList", "update", prepListId);
    return serializePrepList(await getListOrThrow(prepListId));
  }

  async reorderPrepItems(prepListId: string, itemIds: string[]) {
    await bootstrapDatabase();

    const existingItems = await prisma.prepItem.findMany({
      where: { prepListId, id: { in: itemIds } },
      select: { id: true },
    });

    if (existingItems.length !== itemIds.length) {
      throw new Error("Some prep items were not found");
    }

    const change = await prisma.$transaction(async (tx) => {
      for (const [index, itemId] of itemIds.entries()) {
        await tx.prepItem.update({
          where: { id: itemId },
          data: { sortOrder: index },
        });
      }
      return reserveCommittedChange(tx, "prepList", "update", prepListId);
    });

    emitCommittedChange(change);
    return serializePrepList(await getListOrThrow(prepListId));
  }

  private async buildGeneratedDraft(input: PrepListGenerateInput): Promise<GenerateDraft> {
    const includeIngredients = input.includeIngredients ?? true;
    const includeTasks = input.includeTasks ?? true;
    const includeQuantities = input.includeQuantities ?? true;
    const meals = await this.getSourceMeals(input);

    if (meals.length === 0) {
      throw new Error("No meals found for prep list generation");
    }

    const ingredientMap = new Map<string, GeneratedItem>();
    const taskItems: GeneratedItem[] = [];

    for (const meal of meals) {
      if (includeIngredients) {
        getMealIngredients(meal).forEach((ingredient) =>
          addGeneratedIngredient(ingredientMap, meal, ingredient, includeQuantities)
        );
      }
      if (includeTasks) {
        taskItems.push(...buildTaskItems(meal));
      }
    }

    const items = [...ingredientMap.values(), ...taskItems].map((item) => ({
      kind: item.kind,
      name: item.name,
      qty: includeQuantities ? item.qty ?? null : null,
      unit: item.unit ?? null,
      ingredientType:
        input.includeIngredientTypes === false ? null : item.ingredientType ?? null,
      prepGroup: item.prepGroup ?? null,
      dish: item.dish ?? null,
      notes: item.notes ?? null,
      checked: false,
      sourceMealIds: item.sourceMealIds,
      sourceRecipeIds: item.sourceRecipeIds,
      sourceLabels: input.includeSourceLabels === false ? [] : item.sourceLabels,
    }));

    const fromDate = input.fromDate ?? input.date ?? null;
    const toDate = input.toDate ?? input.date ?? null;

    return {
      date: input.date ?? fromDate,
      fromDate,
      toDate,
      sourceMode: input.sourceMode,
      sourceLabel: this.buildSourceLabel(input, meals),
      sourceMealIds: meals.map((meal) => meal.id),
      sourceRecipeIds: Array.from(
        new Set(meals.map(mealRecipeId).filter((id): id is string => Boolean(id)))
      ),
      favourite: input.favourite ?? false,
      sortMode: input.sortMode ?? DEFAULT_SORT_MODE,
      groupBy: input.groupBy ?? DEFAULT_GROUP_BY,
      includeIngredients,
      includeTasks,
      includeQuantities,
      includeIngredientTypes: input.includeIngredientTypes ?? true,
      includeSourceLabels: input.includeSourceLabels ?? true,
      excludePantryStaples: input.excludePantryStaples ?? false,
      items,
    };
  }

  private async getSourceMeals(input: PrepListGenerateInput) {
    if (input.mealIds && input.mealIds.length > 0) {
      const ids = input.mealIds ?? [];
      if (ids.length === 0) {
        throw new Error("mealIds are required");
      }

      const meals = await Promise.all(ids.map((id) => this.mealService.getMeal(id)));
      return meals.filter((meal): meal is MealPayload => Boolean(meal));
    }

    if (!input.fromDate || !input.toDate) {
      throw new Error("fromDate and toDate are required");
    }

    let meals = await this.mealService.listMealsInRange(input.fromDate, input.toDate);
    if (input.sourceMode === "meal-slot" && input.mealType) {
      meals = meals.filter((meal) => meal.mealType === input.mealType);
    }

    return meals;
  }

  private buildGeneratedName(input: PrepListGenerateInput, meals: MealPayload[]) {
    if (input.sourceMode === "single-meal" && meals.length === 1) {
      return `${meals[0].name} Prep`;
    }
    if (input.sourceMode === "historical") {
      return "Historical Prep Summary";
    }
    return "Generated Prep List";
  }

  private buildSourceLabel(input: PrepListGenerateInput, meals: MealPayload[]) {
    if (input.sourceMode === "single-meal") {
      return meals.map((meal) => meal.name).join(", ");
    }
    if (input.sourceMode === "meal-slot" && input.mealType) {
      return `${input.mealType} from ${input.fromDate} to ${input.toDate}`;
    }
    if (input.fromDate && input.toDate) {
      return `${input.fromDate} to ${input.toDate}`;
    }
    return null;
  }
}