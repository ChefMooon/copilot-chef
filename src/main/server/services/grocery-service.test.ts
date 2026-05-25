import { beforeEach, describe, expect, it, vi } from "vitest";

const { bootstrapDatabaseMock, prismaMock } = vi.hoisted(() => ({
  bootstrapDatabaseMock: vi.fn().mockResolvedValue(undefined),
  prismaMock: {
    groceryList: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../lib/bootstrap", () => ({
  bootstrapDatabase: bootstrapDatabaseMock,
}));

vi.mock("../lib/prisma", () => ({
  prisma: prismaMock,
}));

import { GroceryService } from "./grocery-service";

type GroceryListRow = {
  id: string;
  name: string;
  date: Date | null;
  favourite: boolean;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    name: string;
    qty: string | null;
    unit: string | null;
    category: string;
    notes: string | null;
    meal: string | null;
    checked: boolean;
    sortOrder: number;
  }>;
};

function createListRow(input: {
  id: string;
  date: string | null;
  createdAt: string;
}): GroceryListRow {
  return {
    id: input.id,
    name: `List ${input.id}`,
    date: input.date ? new Date(input.date) : null,
    favourite: false,
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.createdAt),
    items: [],
  };
}

describe("GroceryService", () => {
  beforeEach(() => {
    bootstrapDatabaseMock.mockClear();
    prismaMock.groceryList.findMany.mockReset();
    prismaMock.groceryList.create.mockReset();
    prismaMock.groceryList.update.mockReset();
  });

  it("sorts ongoing lists first by newest createdAt, then dated lists by date", async () => {
    const service = new GroceryService();
    prismaMock.groceryList.findMany.mockResolvedValue([
      createListRow({
        id: "dated-later",
        date: "2026-06-10T12:00:00.000Z",
        createdAt: "2026-05-01T12:00:00.000Z",
      }),
      createListRow({
        id: "ongoing-older",
        date: null,
        createdAt: "2026-05-01T12:00:00.000Z",
      }),
      createListRow({
        id: "dated-earlier",
        date: "2026-05-28T12:00:00.000Z",
        createdAt: "2026-05-02T12:00:00.000Z",
      }),
      createListRow({
        id: "ongoing-newer",
        date: null,
        createdAt: "2026-05-03T12:00:00.000Z",
      }),
    ]);

    const result = await service.listGroceryLists();

    expect(bootstrapDatabaseMock).toHaveBeenCalled();
    expect(result.map((list) => list.id)).toEqual([
      "ongoing-newer",
      "ongoing-older",
      "dated-earlier",
      "dated-later",
    ]);
    expect(result[0].date).toBeNull();
  });

  it("passes null date through on create for ongoing lists", async () => {
    const service = new GroceryService();
    prismaMock.groceryList.create.mockResolvedValue(
      createListRow({
        id: "ongoing",
        date: null,
        createdAt: "2026-05-03T12:00:00.000Z",
      })
    );

    await service.createGroceryList({
      name: "Ongoing",
      date: null,
    });

    expect(prismaMock.groceryList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          date: null,
        }),
      })
    );
  });

  it("allows clearing an existing date on update", async () => {
    const service = new GroceryService();
    prismaMock.groceryList.update.mockResolvedValue(
      createListRow({
        id: "list-1",
        date: null,
        createdAt: "2026-05-03T12:00:00.000Z",
      })
    );

    await service.updateGroceryList("list-1", { date: null });

    expect(prismaMock.groceryList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "list-1" },
        data: expect.objectContaining({ date: null }),
      })
    );
  });
});
