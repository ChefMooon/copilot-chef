import { prisma } from "../lib/prisma";
import { bootstrapDatabase } from "../lib/bootstrap";

function serializeGroceryList(groceryList: {
  id: string;
  name: string;
  date: Date;
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
}) {
  const checkedCount = groceryList.items.filter((item) => item.checked).length;

  return {
    id: groceryList.id,
    name: groceryList.name,
    date: groceryList.date.toISOString(),
    favourite: groceryList.favourite,
    createdAt: groceryList.createdAt.toISOString(),
    updatedAt: groceryList.updatedAt.toISOString(),
    checkedCount,
    totalItems: groceryList.items.length,
    completionPercentage:
      groceryList.items.length === 0
        ? 0
        : Math.round((checkedCount / groceryList.items.length) * 100),
    items: groceryList.items
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => ({
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

type CreateListInput = {
  name: string;
  date?: string | Date;
  favourite?: boolean;
  items?: Array<{
    name: string;
    qty?: string;
    unit?: string;
    category?: string;
    notes?: string;
    meal?: string;
    checked?: boolean;
  }>;
};

type UpdateListInput = {
  name?: string;
  date?: string | Date;
  favourite?: boolean;
};

type CreateItemInput = {
  name: string;
  qty?: string;
  unit?: string;
  category?: string;
  notes?: string;
  meal?: string;
  checked?: boolean;
};

type UpdateItemInput = {
  name?: string;
  qty?: string | null;
  unit?: string | null;
  category?: string;
  notes?: string | null;
  meal?: string | null;
  checked?: boolean;
};

type GroceryListSnapshot = {
  id: string;
  name: string;
  date: string;
  favourite: boolean;
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

function toDate(value: string | Date | undefined) {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date provided");
  }

  return parsed;
}

async function getListOrThrow(id: string) {
  const groceryList = await prisma.groceryList.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });

  if (!groceryList) {
    throw new Error("Grocery list not found");
  }

  return groceryList;
}

export class GroceryService {
  async listGroceryLists() {
    await bootstrapDatabase();

    const groceryLists = await prisma.groceryList.findMany({
      include: {
        items: true,
      },
      orderBy: [{ date: "asc" }, { updatedAt: "desc" }],
    });

    return groceryLists.map(serializeGroceryList);
  }

  async getGroceryList(id: string) {
    await bootstrapDatabase();

    const groceryList = await prisma.groceryList.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    return groceryList ? serializeGroceryList(groceryList) : null;
  }

  async getCurrentGroceryList() {
    await bootstrapDatabase();

    const groceryList = await prisma.groceryList.findFirst({
      include: {
        items: true,
      },
      orderBy: [{ date: "asc" }, { updatedAt: "desc" }],
    });

    return groceryList ? serializeGroceryList(groceryList) : null;
  }

  async createGroceryList(input: CreateListInput) {
    await bootstrapDatabase();

    const groceryList = await prisma.groceryList.create({
      data: {
        name: input.name,
        date: toDate(input.date),
        favourite: input.favourite ?? false,
        items: {
          create: (input.items ?? []).map((item, index) => ({
            name: item.name,
            qty: item.qty,
            unit: item.unit,
            category: item.category ?? "Other",
            notes: item.notes,
            meal: item.meal,
            checked: item.checked ?? false,
            sortOrder: index,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return serializeGroceryList(groceryList);
  }

  async updateGroceryList(id: string, input: UpdateListInput) {
    await bootstrapDatabase();

    const data: {
      name?: string;
      date?: Date;
      favourite?: boolean;
    } = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.date !== undefined) {
      data.date = toDate(input.date);
    }
    if (input.favourite !== undefined) {
      data.favourite = input.favourite;
    }

    const groceryList = await prisma.groceryList.update({
      where: { id },
      data,
      include: {
        items: true,
      },
    });

    return serializeGroceryList(groceryList);
  }

  async deleteGroceryList(id: string) {
    await bootstrapDatabase();

    await prisma.groceryList.delete({
      where: { id },
    });

    return { id };
  }

  async createGroceryItem(groceryListId: string, input: CreateItemInput) {
    await bootstrapDatabase();

    const maxOrder = await prisma.groceryItem.aggregate({
      where: { groceryListId },
      _max: {
        sortOrder: true,
      },
    });

    await prisma.groceryItem.create({
      data: {
        groceryListId,
        name: input.name,
        qty: input.qty,
        unit: input.unit,
        category: input.category ?? "Other",
        notes: input.notes,
        meal: input.meal,
        checked: input.checked ?? false,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return serializeGroceryList(await getListOrThrow(groceryListId));
  }

  async updateGroceryItem(
    groceryListId: string,
    itemId: string,
    input: UpdateItemInput
  ) {
    await bootstrapDatabase();

    const existing = await prisma.groceryItem.findUnique({
      where: { id: itemId },
      select: { groceryListId: true },
    });

    if (!existing || existing.groceryListId !== groceryListId) {
      throw new Error("Grocery item not found");
    }

    await prisma.groceryItem.update({
      where: {
        id: itemId,
      },
      data: {
        name: input.name,
        qty: input.qty,
        unit: input.unit,
        category: input.category,
        notes: input.notes,
        meal: input.meal,
        checked: input.checked,
      },
    });

    return serializeGroceryList(await getListOrThrow(groceryListId));
  }

  async deleteGroceryItem(groceryListId: string, itemId: string) {
    await bootstrapDatabase();

    const existing = await prisma.groceryItem.findUnique({
      where: { id: itemId },
      select: { groceryListId: true },
    });

    if (!existing || existing.groceryListId !== groceryListId) {
      throw new Error("Grocery item not found");
    }

    await prisma.groceryItem.delete({
      where: {
        id: itemId,
      },
    });

    return serializeGroceryList(await getListOrThrow(groceryListId));
  }

  async reorderGroceryItems(groceryListId: string, itemIds: string[]) {
    await bootstrapDatabase();

    const existingItems = await prisma.groceryItem.findMany({
      where: {
        groceryListId,
        id: { in: itemIds },
      },
      select: {
        id: true,
      },
    });

    if (existingItems.length !== itemIds.length) {
      throw new Error("Some grocery items were not found");
    }

    await prisma.$transaction(
      itemIds.map((itemId, index) =>
        prisma.groceryItem.update({
          where: {
            id: itemId,
          },
          data: {
            sortOrder: index,
          },
        })
      )
    );

    return serializeGroceryList(await getListOrThrow(groceryListId));
  }

  async restoreGroceryListSnapshot(snapshot: GroceryListSnapshot) {
    await bootstrapDatabase();

    await prisma.$transaction(async (tx) => {
      await tx.groceryList.update({
        where: {
          id: snapshot.id,
        },
        data: {
          name: snapshot.name,
          date: new Date(snapshot.date),
          favourite: snapshot.favourite,
        },
      });

      await tx.groceryItem.deleteMany({
        where: {
          groceryListId: snapshot.id,
        },
      });

      if (snapshot.items.length > 0) {
        await tx.groceryItem.createMany({
          data: snapshot.items.map((item, index) => ({
            id: item.id,
            groceryListId: snapshot.id,
            name: item.name,
            qty: item.qty,
            unit: item.unit,
            category: item.category,
            notes: item.notes,
            meal: item.meal,
            checked: item.checked,
            sortOrder: item.sortOrder ?? index,
          })),
        });
      }
    });

    return serializeGroceryList(await getListOrThrow(snapshot.id));
  }

  async toggleItem(itemId: string, checked: boolean) {
    await bootstrapDatabase();

    const item = await prisma.groceryItem.update({
      where: {
        id: itemId,
      },
      data: {
        checked,
      },
      include: {
        groceryList: {
          include: {
            items: true,
          },
        },
      },
    });

    return serializeGroceryList({
      ...item.groceryList,
      items: item.groceryList.items,
    });
  }
}
