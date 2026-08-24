import { DEFAULT_MEAL_SUB_TYPE_TEMPLATES } from "@shared/api/constants";
import type {
  CreateMealSubTypeDefinitionInput,
  MealSubTypeDefinitionPayload,
  UpdateMealSubTypeDefinitionInput,
} from "@shared/types";

import { bootstrapDatabase } from "../lib/bootstrap";
import { prisma } from "../lib/prisma";
import { publishCommittedChange } from "./change-event-bus";

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
    throw new Error("Meal sub-type name must contain letters or numbers.");
  }

  return normalized;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function serializeMealSubType(definition: {
  id: string;
  name: string;
  slug: string;
  color: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): MealSubTypeDefinitionPayload {
  return {
    id: definition.id,
    name: definition.name,
    slug: definition.slug,
    color: definition.color,
    enabled: definition.enabled,
    sortOrder: definition.sortOrder,
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
  };
}

export class MealSubTypeService {
  private async ensureUniqueSlug(slug: string, excludeId?: string) {
    const definitions = await prisma.mealSubTypeDefinition.findMany({
      select: { id: true, slug: true },
    });

    const duplicate = definitions.find(
      (definition) => definition.id !== excludeId && definition.slug === slug
    );

    if (duplicate) {
      throw new Error("A meal sub-type with that name already exists.");
    }
  }

  private async ensureUniqueName(name: string, excludeId?: string) {
    const definitions = await prisma.mealSubTypeDefinition.findMany({
      select: { id: true, name: true },
    });

    const duplicate = definitions.find(
      (definition) =>
        definition.id !== excludeId &&
        normalizeText(definition.name) === normalizeText(name)
    );

    if (duplicate) {
      throw new Error("A meal sub-type with that name already exists.");
    }
  }

  async bootstrapDefaults() {
    const existingCount = await prisma.mealSubTypeDefinition.count();
    if (existingCount === 0) {
      await prisma.$transaction(
        DEFAULT_MEAL_SUB_TYPE_TEMPLATES.map((template) =>
          prisma.mealSubTypeDefinition.create({
            data: {
              name: template.name,
              slug: template.slug,
              color: template.color,
              enabled: template.enabled,
              sortOrder: template.sortOrder,
            },
          })
        )
      );

      return;
    }

    const existingDefinitions = await prisma.mealSubTypeDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { slug: true },
    });

    const existingSlugs = new Set(existingDefinitions.map((entry) => entry.slug));
    const missingTemplates = DEFAULT_MEAL_SUB_TYPE_TEMPLATES.filter(
      (template) => !existingSlugs.has(template.slug)
    );

    if (missingTemplates.length === 0) {
      return;
    }

    await prisma.$transaction(
      missingTemplates.map((template, index) =>
        prisma.mealSubTypeDefinition.create({
          data: {
            name: template.name,
            slug: template.slug,
            color: template.color,
            enabled: template.enabled,
            sortOrder: existingDefinitions.length + index,
          },
        })
      )
    );
  }

  async listDefinitions() {
    await bootstrapDatabase();

    const definitions = await prisma.mealSubTypeDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return definitions.map(serializeMealSubType);
  }

  async createDefinition(input: CreateMealSubTypeDefinitionInput) {
    await bootstrapDatabase();

    const name = input.name.trim();
    if (!name) {
      throw new Error("Meal sub-type name is required.");
    }

    const slug = normalizeSlug(name);
    const color = normalizeHexColor(input.color);

    await this.ensureUniqueName(name);
    await this.ensureUniqueSlug(slug);

    const sortOrder = await prisma.mealSubTypeDefinition.count();

    const definition = await prisma.mealSubTypeDefinition.create({
      data: {
        name,
        slug,
        color,
        enabled: input.enabled ?? true,
        sortOrder,
      },
    });

    await publishCommittedChange("mealSubType", "create", definition.id);
    return serializeMealSubType(definition);
  }

  async updateDefinition(
    id: string,
    input: UpdateMealSubTypeDefinitionInput
  ) {
    await bootstrapDatabase();

    const existing = await prisma.mealSubTypeDefinition.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Meal sub-type not found.");
    }

    const nextName = input.name !== undefined ? input.name.trim() : existing.name;

    if (!nextName) {
      throw new Error("Meal sub-type name is required.");
    }

    const nextSlug = normalizeSlug(nextName);

    await this.ensureUniqueName(nextName, id);
    await this.ensureUniqueSlug(nextSlug, id);

    const definition = await prisma.mealSubTypeDefinition.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: nextName, slug: nextSlug } : {}),
        ...(input.color !== undefined
          ? { color: normalizeHexColor(input.color) }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });

    await publishCommittedChange("mealSubType", "update", id);
    return serializeMealSubType(definition);
  }

  async deleteDefinition(id: string) {
    await bootstrapDatabase();

    await prisma.mealSubTypeDefinition.delete({ where: { id } });

    const remaining = await prisma.mealSubTypeDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    await prisma.$transaction(
      remaining.map((definition, index) =>
        prisma.mealSubTypeDefinition.update({
          where: { id: definition.id },
          data: { sortOrder: index },
        })
      )
    );

    await publishCommittedChange("mealSubType", "delete", id);
    return { id };
  }

  async reorderDefinitions(orderedIds: string[]) {
    await bootstrapDatabase();

    const definitions = await prisma.mealSubTypeDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    const knownIds = new Set(definitions.map((definition) => definition.id));
    const deduped = orderedIds.filter(
      (id, index) => knownIds.has(id) && orderedIds.indexOf(id) === index
    );

    const missing = definitions
      .map((definition) => definition.id)
      .filter((id) => !deduped.includes(id));

    const finalOrder = [...deduped, ...missing];

    await prisma.$transaction(
      finalOrder.map((id, index) =>
        prisma.mealSubTypeDefinition.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    await publishCommittedChange("mealSubType", "bulk");
    return this.listDefinitions();
  }
}
