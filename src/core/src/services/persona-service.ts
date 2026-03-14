import { bootstrapDatabase } from "../lib/bootstrap";
import { prisma } from "../lib/prisma";

export type CustomPersonaPayload = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatePersonaInput = {
  emoji: string;
  title: string;
  description: string;
  prompt: string;
};

export type UpdatePersonaInput = Partial<CreatePersonaInput>;

function serializePersona(record: {
  id: string;
  emoji: string;
  title: string;
  description: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
}): CustomPersonaPayload {
  return {
    id: record.id,
    emoji: record.emoji,
    title: record.title,
    description: record.description,
    prompt: record.prompt,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class PersonaService {
  async list(): Promise<CustomPersonaPayload[]> {
    await bootstrapDatabase();
    const records = await prisma.customPersona.findMany({ orderBy: { createdAt: "asc" } });
    return records.map(serializePersona);
  }

  async findById(id: string): Promise<CustomPersonaPayload | null> {
    await bootstrapDatabase();
    const record = await prisma.customPersona.findUnique({ where: { id } });
    return record ? serializePersona(record) : null;
  }

  async create(input: CreatePersonaInput): Promise<CustomPersonaPayload> {
    await bootstrapDatabase();

    const fields = ["emoji", "title", "description", "prompt"] as const;
    for (const field of fields) {
      if (!input[field]?.trim()) {
        throw new Error(`Field "${field}" is required and cannot be blank.`);
      }
    }

    const record = await prisma.customPersona.create({
      data: {
        emoji: input.emoji.trim(),
        title: input.title.trim(),
        description: input.description.trim(),
        prompt: input.prompt.trim(),
      },
    });

    return serializePersona(record);
  }

  async update(id: string, input: UpdatePersonaInput): Promise<CustomPersonaPayload> {
    await bootstrapDatabase();

    try {
      const record = await prisma.customPersona.update({
        where: { id },
        data: {
          ...(input.emoji !== undefined ? { emoji: input.emoji.trim() } : {}),
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          ...(input.prompt !== undefined ? { prompt: input.prompt.trim() } : {}),
        },
      });
      return serializePersona(record);
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2025") {
        throw new Error(`Persona with id "${id}" not found.`);
      }
      throw err;
    }
  }

  async delete(id: string): Promise<{ id: string }> {
    await bootstrapDatabase();

    try {
      await prisma.customPersona.delete({ where: { id } });
      return { id };
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2025") {
        throw new Error(`Persona with id "${id}" not found.`);
      }
      throw err;
    }
  }
}
