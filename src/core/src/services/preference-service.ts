import { type Prisma, type UserPreference } from "@prisma/client";

import { bootstrapDatabase } from "../lib/bootstrap";
import { prisma } from "../lib/prisma";

const SINGLETON_ID = "default";

const csvFields = [
  "dietaryTags",
  "favoriteCuisines",
  "avoidCuisines",
  "nutritionTags",
] as const;
const orderedListFields = ["avoidIngredients", "pantryStaples"] as const;
const stringFields = [
  "cookingLength",
  "planningNotes",
  "skillLevel",
  "budgetRange",
  "chefPersona",
  "replyLength",
  "emojiUsage",
  "seasonalRegion",
  "defaultPlanLength",
  "groceryGrouping",
] as const;
const booleanFields = [
  "autoImproveChef",
  "contextAwareness",
  "seasonalAwareness",
  "proactiveTips",
  "autoGenerateGrocery",
  "consolidateIngredients",
  "saveChatHistory",
] as const;

export type PreferenceListField = (typeof orderedListFields)[number];

export type PreferencesPayload = {
  id: string;
  createdAt: string;
  updatedAt: string;
  householdSize: number;
  cookingLength: string;
  dietaryTags: string[];
  favoriteCuisines: string[];
  avoidCuisines: string[];
  avoidIngredients: string[];
  pantryStaples: string[];
  planningNotes: string;
  nutritionTags: string[];
  skillLevel: string;
  budgetRange: string;
  chefPersona: string;
  replyLength: string;
  emojiUsage: string;
  autoImproveChef: boolean;
  contextAwareness: boolean;
  seasonalAwareness: boolean;
  seasonalRegion: string;
  proactiveTips: boolean;
  autoGenerateGrocery: boolean;
  consolidateIngredients: boolean;
  defaultPlanLength: string;
  groceryGrouping: string;
  saveChatHistory: boolean;
};

export type PreferenceUpdateInput = Partial<
  Omit<PreferencesPayload, "id" | "createdAt" | "updatedAt">
>;

const DEFAULT_PREFERENCE_VALUES = {
  householdSize: 2,
  cookingLength: "weeknight",
  dietaryTags: "",
  favoriteCuisines: "",
  avoidCuisines: "",
  avoidIngredients: "[]",
  pantryStaples: "[]",
  planningNotes: "",
  nutritionTags: "",
  skillLevel: "home-cook",
  budgetRange: "moderate",
  chefPersona: "coach",
  replyLength: "balanced",
  emojiUsage: "occasional",
  autoImproveChef: true,
  contextAwareness: true,
  seasonalAwareness: true,
  seasonalRegion: "eastern-us",
  proactiveTips: false,
  autoGenerateGrocery: true,
  consolidateIngredients: true,
  defaultPlanLength: "7",
  groceryGrouping: "category",
  saveChatHistory: true,
} satisfies Prisma.UserPreferenceCreateInput;

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinCsv(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(",");
}

function normalizeStringArray(values: string[], field: string) {
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== "string")
  ) {
    throw new Error(`Expected ${field} to be an array of strings`);
  }

  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function parseOrderedList(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeStringArray(
      parsed.filter((item): item is string => typeof item === "string"),
      "list"
    );
  } catch {
    return [];
  }
}

function serializePreferences(preferences: UserPreference): PreferencesPayload {
  return {
    id: preferences.id,
    createdAt: preferences.createdAt.toISOString(),
    updatedAt: preferences.updatedAt.toISOString(),
    householdSize: preferences.householdSize,
    cookingLength: preferences.cookingLength,
    dietaryTags: splitCsv(preferences.dietaryTags),
    favoriteCuisines: splitCsv(preferences.favoriteCuisines),
    avoidCuisines: splitCsv(preferences.avoidCuisines),
    avoidIngredients: parseOrderedList(preferences.avoidIngredients),
    pantryStaples: parseOrderedList(preferences.pantryStaples),
    planningNotes: preferences.planningNotes,
    nutritionTags: splitCsv(preferences.nutritionTags),
    skillLevel: preferences.skillLevel,
    budgetRange: preferences.budgetRange,
    chefPersona: preferences.chefPersona,
    replyLength: preferences.replyLength,
    emojiUsage: preferences.emojiUsage,
    autoImproveChef: preferences.autoImproveChef,
    contextAwareness: preferences.contextAwareness,
    seasonalAwareness: preferences.seasonalAwareness,
    seasonalRegion: preferences.seasonalRegion,
    proactiveTips: preferences.proactiveTips,
    autoGenerateGrocery: preferences.autoGenerateGrocery,
    consolidateIngredients: preferences.consolidateIngredients,
    defaultPlanLength: preferences.defaultPlanLength,
    groceryGrouping: preferences.groceryGrouping,
    saveChatHistory: preferences.saveChatHistory,
  };
}

function hasOwn<T extends object>(value: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizePatch(
  input: PreferenceUpdateInput
): Prisma.UserPreferenceUpdateInput {
  const patch: Prisma.UserPreferenceUpdateInput = {};

  if (hasOwn(input, "householdSize")) {
    if (
      typeof input.householdSize !== "number" ||
      !Number.isInteger(input.householdSize)
    ) {
      throw new Error("Expected householdSize to be an integer");
    }
    patch.householdSize = input.householdSize;
  }

  for (const field of csvFields) {
    if (hasOwn(input, field)) {
      const value = input[field];
      if (value === undefined) {
        continue;
      }
      patch[field] = joinCsv(normalizeStringArray(value, field));
    }
  }

  for (const field of orderedListFields) {
    if (hasOwn(input, field)) {
      const value = input[field];
      if (value === undefined) {
        continue;
      }
      patch[field] = JSON.stringify(normalizeStringArray(value, field));
    }
  }

  for (const field of stringFields) {
    if (hasOwn(input, field)) {
      const value = input[field];
      if (typeof value !== "string") {
        throw new Error(`Expected ${field} to be a string`);
      }
      patch[field] = field === "planningNotes" ? value : value.trim();
    }
  }

  for (const field of booleanFields) {
    if (hasOwn(input, field)) {
      const value = input[field];
      if (typeof value !== "boolean") {
        throw new Error(`Expected ${field} to be a boolean`);
      }
      patch[field] = value;
    }
  }

  return patch;
}

export class PreferenceService {
  private async ensurePreferencesRecord() {
    return prisma.userPreference.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: {
        id: SINGLETON_ID,
        ...DEFAULT_PREFERENCE_VALUES,
      },
    });
  }

  private async writeOrderedList(field: PreferenceListField, values: string[]) {
    const preferences = await prisma.userPreference.update({
      where: { id: SINGLETON_ID },
      data: {
        [field]: JSON.stringify(normalizeStringArray(values, field)),
      },
    });

    return serializePreferences(preferences);
  }

  async getPreferences() {
    await bootstrapDatabase();
    const preferences = await this.ensurePreferencesRecord();
    return serializePreferences(preferences);
  }

  async updatePreferences(input: PreferenceUpdateInput) {
    await bootstrapDatabase();
    await this.ensurePreferencesRecord();

    const patch = normalizePatch(input);
    if (Object.keys(patch).length === 0) {
      return this.getPreferences();
    }

    const preferences = await prisma.userPreference.update({
      where: { id: SINGLETON_ID },
      data: patch,
    });

    return serializePreferences(preferences);
  }

  async resetPreferences() {
    await bootstrapDatabase();

    const preferences = await prisma.userPreference.upsert({
      where: { id: SINGLETON_ID },
      update: DEFAULT_PREFERENCE_VALUES,
      create: {
        id: SINGLETON_ID,
        ...DEFAULT_PREFERENCE_VALUES,
      },
    });

    return serializePreferences(preferences);
  }

  async addToList(field: PreferenceListField, value: string) {
    await bootstrapDatabase();
    const current = await this.getPreferences();
    const normalized = value.trim();
    if (!normalized) {
      return current;
    }

    const nextValues = [...current[field]];
    if (
      !nextValues.some(
        (item) => item.toLowerCase() === normalized.toLowerCase()
      )
    ) {
      nextValues.push(normalized);
    }

    return this.writeOrderedList(field, nextValues);
  }

  async removeFromList(field: PreferenceListField, value: string) {
    await bootstrapDatabase();
    const current = await this.getPreferences();
    const nextValues = current[field].filter(
      (item) => item.toLowerCase() !== value.trim().toLowerCase()
    );
    return this.writeOrderedList(field, nextValues);
  }

  async reorderList(field: PreferenceListField, orderedValues: string[]) {
    await bootstrapDatabase();
    await this.ensurePreferencesRecord();
    return this.writeOrderedList(field, orderedValues);
  }
}
