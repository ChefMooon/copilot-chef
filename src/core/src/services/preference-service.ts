import { prisma } from "../lib/prisma";
import { bootstrapDatabase } from "../lib/bootstrap";

function splitCsv(value: string | null) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function joinCsv(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean).join(",");
}

function serializePreferences(preferences: {
  dietaryRestrictions: string | null;
  householdSize: number;
  cuisinePreferences: string | null;
  avoidIngredients: string | null;
  notes: string | null;
  updatedAt: Date;
}) {
  return {
    dietaryRestrictions: splitCsv(preferences.dietaryRestrictions),
    householdSize: preferences.householdSize,
    cuisinePreferences: splitCsv(preferences.cuisinePreferences),
    avoidIngredients: splitCsv(preferences.avoidIngredients),
    notes: preferences.notes ?? "",
    updatedAt: preferences.updatedAt.toISOString()
  };
}

export class PreferenceService {
  async getPreferences() {
    await bootstrapDatabase();

    const preferences = await prisma.userPreference.findUnique({
      where: {
        id: "default"
      }
    });

    if (!preferences) {
      return null;
    }

    return serializePreferences(preferences);
  }

  async updatePreferences(input: {
    dietaryRestrictions: string[];
    householdSize: number;
    cuisinePreferences: string[];
    avoidIngredients: string[];
    notes?: string;
  }) {
    await bootstrapDatabase();

    const preferences = await prisma.userPreference.upsert({
      where: {
        id: "default"
      },
      update: {
        dietaryRestrictions: joinCsv(input.dietaryRestrictions),
        householdSize: input.householdSize,
        cuisinePreferences: joinCsv(input.cuisinePreferences),
        avoidIngredients: joinCsv(input.avoidIngredients),
        notes: input.notes ?? ""
      },
      create: {
        id: "default",
        dietaryRestrictions: joinCsv(input.dietaryRestrictions),
        householdSize: input.householdSize,
        cuisinePreferences: joinCsv(input.cuisinePreferences),
        avoidIngredients: joinCsv(input.avoidIngredients),
        notes: input.notes ?? ""
      }
    });

    return serializePreferences(preferences);
  }
}
