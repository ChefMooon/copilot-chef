import { DEFAULT_MEAL_TYPE_TEMPLATES } from "@shared/api/constants";
import type {
  CreateMealTypeDefinitionInput,
  CreateMealTypeProfileInput,
  MealTypeDefinitionPayload,
  MealTypeProfilePayload,
  UpdateMealTypeDefinitionInput,
  UpdateMealTypeProfileInput,
} from "@shared/types";

import { bootstrapDatabase } from "../lib/bootstrap";
import { prisma } from "../lib/prisma";

type MealTypeProfileRecord = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  isDefault: boolean;
  priority: number;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  mealTypes: Array<{
    id: string;
    profileId: string;
    name: string;
    slug: string;
    color: string;
    enabled: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

function getDateOnlyParts(value: string | Date) {
  if (typeof value === "string") {
    const match = DATE_ONLY_PATTERN.exec(value);

    if (match) {
      return {
        year: Number.parseInt(match[1], 10),
        month: Number.parseInt(match[2], 10),
        day: Number.parseInt(match[3], 10),
      };
    }
  }

  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function formatDateOnly(value: Date | null) {
  if (!value) {
    return null;
  }

  const { year, month, day } = getDateOnlyParts(value);

  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function toCalendarDayValue(value: string | Date | null | undefined) {
  if (value == null) {
    return null;
  }

  const { year, month, day } = getDateOnlyParts(value);
  return Date.UTC(year, month - 1, day);
}

function normalizeDateInput(value: string | Date | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    const match = DATE_ONLY_PATTERN.exec(value);

    if (match) {
      return new Date(
        Date.UTC(
          Number.parseInt(match[1], 10),
          Number.parseInt(match[2], 10) - 1,
          Number.parseInt(match[3], 10),
          12,
          0,
          0,
          0
        )
      );
    }
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }

  return parsed;
}

function normalizeHexColor(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    throw new Error("Color must be a valid 6-digit hex value.");
  }

  return normalized;
}

function normalizeSlug(value: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();

  if (!normalized) {
    throw new Error("Meal type name must contain letters or numbers.");
  }

  return normalized;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function humanizeSlug(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .join(" ");
}

const LEGACY_BASE_TEMPLATE_COLORS: Record<string, string> = {
  DINNER: "#3B5E45",
};

function serializeDefinition(definition: MealTypeProfileRecord["mealTypes"][number]): MealTypeDefinitionPayload {
  return {
    id: definition.id,
    profileId: definition.profileId,
    name: definition.name,
    slug: definition.slug,
    color: definition.color,
    enabled: definition.enabled,
    sortOrder: definition.sortOrder,
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
  };
}

function serializeProfile(profile: MealTypeProfileRecord): MealTypeProfilePayload {
  return {
    id: profile.id,
    name: profile.name,
    color: profile.color,
    description: profile.description,
    isDefault: profile.isDefault,
    priority: profile.priority,
    startDate: formatDateOnly(profile.startDate),
    endDate: formatDateOnly(profile.endDate),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    mealTypes: profile.mealTypes
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(serializeDefinition),
  };
}

function inDateRange(date: Date, startDate: Date | null, endDate: Date | null) {
  const value = toCalendarDayValue(date);
  const start = toCalendarDayValue(startDate);
  const end = toCalendarDayValue(endDate);

  if (start !== undefined && value < start) {
    return false;
  }

  if (end !== undefined && value > end) {
    return false;
  }

  return true;
}

export class MealTypeService {
  private profileInclude = {
    mealTypes: {
      orderBy: { sortOrder: "asc" as const },
    },
  };

  private async getProfileRecord(id: string) {
    return prisma.mealTypeProfile.findUnique({
      where: { id },
      include: this.profileInclude,
    });
  }

  private async ensureUniqueProfileName(name: string, excludeId?: string) {
    const profiles = await prisma.mealTypeProfile.findMany({
      select: { id: true, name: true },
    });

    const duplicate = profiles.find(
      (profile) =>
        profile.id !== excludeId && normalizeText(profile.name) === normalizeText(name)
    );

    if (duplicate) {
      throw new Error(`A meal type profile named "${name}" already exists.`);
    }
  }

  private async ensureUniqueDefinitionSlug(
    profileId: string,
    slug: string,
    excludeId?: string
  ) {
    const definitions = await prisma.mealTypeDefinition.findMany({
      where: { profileId },
      select: { id: true, slug: true },
    });

    const duplicate = definitions.find(
      (definition) => definition.id !== excludeId && definition.slug === slug
    );

    if (duplicate) {
      throw new Error("A meal type with that name already exists in this profile.");
    }
  }

  private async ensureProfileDateRange(
    input: Pick<CreateMealTypeProfileInput, "startDate" | "endDate"> | Pick<UpdateMealTypeProfileInput, "startDate" | "endDate">
  ) {
    const startDate = normalizeDateInput(input.startDate);
    const endDate = normalizeDateInput(input.endDate);

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      throw new Error("Profile start date must be on or before the end date.");
    }
  }

  async bootstrapDefaults() {
    const existingCount = await prisma.mealTypeProfile.count();
    if (existingCount > 0) {
      const defaultProfile = await prisma.mealTypeProfile.findFirst({
        where: { isDefault: true },
        include: this.profileInclude,
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });

      if (!defaultProfile) {
        return;
      }

      for (const template of DEFAULT_MEAL_TYPE_TEMPLATES) {
        const definition = defaultProfile.mealTypes.find(
          (entry) => entry.slug === template.slug
        );

        if (!definition) {
          continue;
        }

        const legacyColor = LEGACY_BASE_TEMPLATE_COLORS[template.slug];
        if (legacyColor && definition.color === legacyColor) {
          await prisma.mealTypeDefinition.update({
            where: { id: definition.id },
            data: { color: template.color },
          });
        }
      }

      return;
    }

    await prisma.mealTypeProfile.create({
      data: {
        name: "Default",
        color: "#3B5E45",
        description: "Default meal types for everyday planning.",
        isDefault: true,
        priority: 0,
        mealTypes: {
          create: DEFAULT_MEAL_TYPE_TEMPLATES.map((template) => ({
            name: template.name,
            slug: template.slug,
            color: template.color,
            enabled: template.enabled,
            sortOrder: template.sortOrder,
          })),
        },
      },
    });
  }

  async migrateExistingMeals() {
    const defaultProfile = await prisma.mealTypeProfile.findFirst({
      where: { isDefault: true },
      include: this.profileInclude,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    if (!defaultProfile) {
      return;
    }

    const aliasMap = new Map<string, { id: string; slug: string }>();
    for (const definition of defaultProfile.mealTypes) {
      aliasMap.set(definition.slug, { id: definition.id, slug: definition.slug });
      aliasMap.set(definition.slug.toLowerCase(), {
        id: definition.id,
        slug: definition.slug,
      });
      aliasMap.set(definition.name.toLowerCase(), {
        id: definition.id,
        slug: definition.slug,
      });
    }

    for (const template of DEFAULT_MEAL_TYPE_TEMPLATES) {
      const match = defaultProfile.mealTypes.find(
        (definition) => definition.slug === template.slug
      );
      if (!match) {
        continue;
      }

      aliasMap.set(template.slug, { id: match.id, slug: match.slug });
      for (const alias of template.aliases) {
        aliasMap.set(alias.toLowerCase(), { id: match.id, slug: match.slug });
      }
    }

    const meals = await prisma.meal.findMany({
      where: { mealTypeDefinitionId: null },
      select: { id: true, mealType: true },
    });

    for (const meal of meals) {
      const normalized = normalizeSlug(meal.mealType.replace(/_/g, " "));
      const alias = aliasMap.get(meal.mealType) ?? aliasMap.get(normalized) ?? aliasMap.get(meal.mealType.toLowerCase());
      if (!alias) {
        continue;
      }

      await prisma.meal.update({
        where: { id: meal.id },
        data: {
          mealType: alias.slug,
          mealTypeDefinitionId: alias.id,
        },
      });
    }
  }

  async listProfiles() {
    await bootstrapDatabase();

    const profiles = await prisma.mealTypeProfile.findMany({
      include: this.profileInclude,
      orderBy: [{ isDefault: "desc" }, { priority: "desc" }, { createdAt: "asc" }],
    });

    return profiles.map((profile) => serializeProfile(profile as MealTypeProfileRecord));
  }

  async getProfile(id: string) {
    await bootstrapDatabase();
    const profile = await this.getProfileRecord(id);
    return profile ? serializeProfile(profile as MealTypeProfileRecord) : null;
  }

  async getActiveProfile(dateInput: string | Date) {
    await bootstrapDatabase();

    const date = normalizeDateInput(dateInput)!;
    const profiles = await prisma.mealTypeProfile.findMany({
      include: this.profileInclude,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    const matchingProfile = profiles.find(
      (profile) => !profile.isDefault && inDateRange(date, profile.startDate, profile.endDate)
    );
    const fallbackProfile = profiles.find((profile) => profile.isDefault);
    const resolved = matchingProfile ?? fallbackProfile ?? profiles[0] ?? null;

    return resolved ? serializeProfile(resolved as MealTypeProfileRecord) : null;
  }

  async resolveMealTypeForDate(dateInput: string | Date, rawMealType: string) {
    await bootstrapDatabase();

    const normalizedSlug = normalizeSlug(rawMealType);
    const profile = await this.getActiveProfile(dateInput);
    const definitions = profile?.mealTypes ?? [];
    const normalizedText = normalizeText(rawMealType);

    const matchedDefinition = definitions.find((definition) => {
      if (definition.slug === normalizedSlug) {
        return true;
      }

      return [definition.name, definition.slug, humanizeSlug(definition.slug)].some(
        (value) => normalizeText(value) === normalizedText
      );
    });

    return {
      mealType: matchedDefinition?.slug ?? normalizedSlug,
      mealTypeDefinitionId: matchedDefinition?.id ?? null,
      definition: matchedDefinition ?? null,
      profile,
    };
  }

  async getActiveMealTypeSummary(dateInput: string | Date) {
    const profile = await this.getActiveProfile(dateInput);

    return {
      profile,
      activeMealTypes:
        profile?.mealTypes
          .filter((definition) => definition.enabled)
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((definition) => ({
            id: definition.id,
            name: definition.name,
            slug: definition.slug,
            color: definition.color,
          })) ?? [],
    };
  }

  async getSuggestedPlanningMealType(dateInput: string | Date) {
    const { activeMealTypes } = await this.getActiveMealTypeSummary(dateInput);

    const preferred =
      activeMealTypes.find((definition) => definition.slug === "DINNER") ??
      activeMealTypes.find((definition) =>
        /(dinner|supper|iftar)/i.test(`${definition.name} ${definition.slug}`)
      ) ??
      activeMealTypes[0];

    return preferred ?? null;
  }

  async createProfile(input: CreateMealTypeProfileInput) {
    await bootstrapDatabase();

    const name = input.name.trim();
    if (!name) {
      throw new Error("Profile name is required.");
    }

    await this.ensureUniqueProfileName(name);
    await this.ensureProfileDateRange(input);

    const created = await prisma.mealTypeProfile.create({
      data: {
        name,
        color: normalizeHexColor(input.color),
        description: input.description?.trim() || null,
        priority: input.priority ?? 0,
        startDate: normalizeDateInput(input.startDate) ?? null,
        endDate: normalizeDateInput(input.endDate) ?? null,
      },
      include: this.profileInclude,
    });

    return serializeProfile(created as MealTypeProfileRecord);
  }

  async updateProfile(id: string, input: UpdateMealTypeProfileInput) {
    await bootstrapDatabase();

    const existing = await prisma.mealTypeProfile.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Meal type profile with id "${id}" not found.`);
    }

    if (input.name !== undefined) {
      const nextName = input.name.trim();
      if (!nextName) {
        throw new Error("Profile name is required.");
      }
      await this.ensureUniqueProfileName(nextName, id);
    }

    const nextStart = input.startDate !== undefined ? input.startDate : existing.startDate?.toISOString() ?? null;
    const nextEnd = input.endDate !== undefined ? input.endDate : existing.endDate?.toISOString() ?? null;
    await this.ensureProfileDateRange({ startDate: nextStart, endDate: nextEnd });

    if (existing.isDefault && (input.startDate !== undefined || input.endDate !== undefined)) {
      throw new Error("The default profile cannot have a date range.");
    }

    const updated = await prisma.mealTypeProfile.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.color !== undefined ? { color: normalizeHexColor(input.color) } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.startDate !== undefined
          ? { startDate: normalizeDateInput(input.startDate) }
          : {}),
        ...(input.endDate !== undefined
          ? { endDate: normalizeDateInput(input.endDate) }
          : {}),
      },
      include: this.profileInclude,
    });

    return serializeProfile(updated as MealTypeProfileRecord);
  }

  async deleteProfile(id: string) {
    await bootstrapDatabase();

    const profile = await prisma.mealTypeProfile.findUnique({ where: { id } });
    if (!profile) {
      throw new Error(`Meal type profile with id "${id}" not found.`);
    }

    if (profile.isDefault) {
      throw new Error("The default meal type profile cannot be deleted.");
    }

    await prisma.mealTypeProfile.delete({ where: { id } });
    return { id };
  }

  async duplicateProfile(id: string) {
    await bootstrapDatabase();

    const profile = await this.getProfileRecord(id);
    if (!profile) {
      throw new Error(`Meal type profile with id "${id}" not found.`);
    }

    let name = `${profile.name} (Copy)`;
    let suffix = 1;
    const existingNames = new Set(
      (await prisma.mealTypeProfile.findMany({ select: { name: true } })).map(
        (record) => normalizeText(record.name)
      )
    );

    while (existingNames.has(normalizeText(name))) {
      suffix += 1;
      name = `${profile.name} (Copy ${suffix})`;
    }

    const duplicated = await prisma.mealTypeProfile.create({
      data: {
        name,
        color: profile.color,
        description: profile.description,
        priority: profile.priority,
        startDate: profile.startDate,
        endDate: profile.endDate,
        mealTypes: {
          create: profile.mealTypes.map((definition) => ({
            name: definition.name,
            slug: definition.slug,
            color: definition.color,
            enabled: definition.enabled,
            sortOrder: definition.sortOrder,
          })),
        },
      },
      include: this.profileInclude,
    });

    return serializeProfile(duplicated as MealTypeProfileRecord);
  }

  async createDefinition(profileId: string, input: CreateMealTypeDefinitionInput) {
    await bootstrapDatabase();

    const profile = await this.getProfileRecord(profileId);
    if (!profile) {
      throw new Error(`Meal type profile with id "${profileId}" not found.`);
    }

    const name = input.name.trim();
    if (!name) {
      throw new Error("Meal type name is required.");
    }

    const slug = normalizeSlug(name);
    await this.ensureUniqueDefinitionSlug(profileId, slug);

    const nextSortOrder =
      profile.mealTypes.reduce(
        (highest, definition) => Math.max(highest, definition.sortOrder),
        -1
      ) + 1;

    const definition = await prisma.mealTypeDefinition.create({
      data: {
        profileId,
        name,
        slug,
        color: normalizeHexColor(input.color),
        enabled: input.enabled ?? true,
        sortOrder: nextSortOrder,
      },
    });

    return serializeDefinition(definition);
  }

  async updateDefinition(
    profileId: string,
    id: string,
    input: UpdateMealTypeDefinitionInput
  ) {
    await bootstrapDatabase();

    const definition = await prisma.mealTypeDefinition.findFirst({
      where: { id, profileId },
    });
    if (!definition) {
      throw new Error(`Meal type definition with id "${id}" not found.`);
    }

    let nextSlug = definition.slug;
    if (input.name !== undefined) {
      const nextName = input.name.trim();
      if (!nextName) {
        throw new Error("Meal type name is required.");
      }
      nextSlug = normalizeSlug(nextName);
      await this.ensureUniqueDefinitionSlug(profileId, nextSlug, id);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.mealTypeDefinition.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim(), slug: nextSlug } : {}),
          ...(input.color !== undefined
            ? { color: normalizeHexColor(input.color) }
            : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        },
      });

      if (nextSlug !== definition.slug) {
        await tx.meal.updateMany({
          where: { mealTypeDefinitionId: id },
          data: { mealType: nextSlug },
        });
      }

      return next;
    });

    return serializeDefinition(updated);
  }

  async deleteDefinition(profileId: string, id: string) {
    await bootstrapDatabase();

    const definitions = await prisma.mealTypeDefinition.findMany({
      where: { profileId },
      orderBy: { sortOrder: "asc" },
    });
    const definition = definitions.find((entry) => entry.id === id);

    if (!definition) {
      throw new Error(`Meal type definition with id "${id}" not found.`);
    }

    const enabledCount = definitions.filter((entry) => entry.enabled).length;
    if (definition.enabled && enabledCount <= 1) {
      throw new Error("Each profile must keep at least one enabled meal type.");
    }

    await prisma.mealTypeDefinition.delete({ where: { id } });
    return { id };
  }

  async reorderDefinitions(profileId: string, orderedIds: string[]) {
    await bootstrapDatabase();

    const definitions = await prisma.mealTypeDefinition.findMany({
      where: { profileId },
      orderBy: { sortOrder: "asc" },
    });
    if (definitions.length !== orderedIds.length) {
      throw new Error("The reorder payload must include every meal type in the profile.");
    }

    const definitionIds = new Set(definitions.map((definition) => definition.id));
    if (orderedIds.some((id) => !definitionIds.has(id))) {
      throw new Error("The reorder payload includes an unknown meal type definition.");
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.mealTypeDefinition.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Meal type profile with id "${profileId}" not found.`);
    }

    return profile.mealTypes;
  }
}