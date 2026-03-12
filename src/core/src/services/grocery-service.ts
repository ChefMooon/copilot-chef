import { prisma } from "../lib/prisma";
import { bootstrapDatabase } from "../lib/bootstrap";

function serializeGroceryList(groceryList: {
  id: string;
  name: string;
  createdAt: Date;
  mealPlanId: string | null;
  items: Array<{
    id: string;
    name: string;
    category: string | null;
    checked: boolean;
    quantity: number | null;
    unit: string | null;
    sortOrder: number;
  }>;
}) {
  const checkedCount = groceryList.items.filter((item) => item.checked).length;

  return {
    id: groceryList.id,
    name: groceryList.name,
    createdAt: groceryList.createdAt.toISOString(),
    mealPlanId: groceryList.mealPlanId,
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
        category: item.category,
        checked: item.checked,
        quantity: item.quantity,
        unit: item.unit
      }))
  };
}

export class GroceryService {
  async listGroceryLists() {
    await bootstrapDatabase();

    const groceryLists = await prisma.groceryList.findMany({
      include: {
        items: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return groceryLists.map(serializeGroceryList);
  }

  async getGroceryList(id: string) {
    await bootstrapDatabase();

    const groceryList = await prisma.groceryList.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    return groceryList ? serializeGroceryList(groceryList) : null;
  }

  async getCurrentGroceryList() {
    await bootstrapDatabase();

    const groceryList = await prisma.groceryList.findFirst({
      include: {
        items: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return groceryList ? serializeGroceryList(groceryList) : null;
  }

  async createGroceryList(input: {
    name: string;
    mealPlanId?: string;
    items?: Array<{
      name: string;
      category?: string;
      quantity?: number;
      unit?: string;
      checked?: boolean;
    }>;
  }) {
    await bootstrapDatabase();

    const groceryList = await prisma.groceryList.create({
      data: {
        name: input.name,
        mealPlanId: input.mealPlanId,
        items: {
          create: (input.items ?? []).map((item, index) => ({
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            checked: item.checked ?? false,
            sortOrder: index
          }))
        }
      },
      include: {
        items: true
      }
    });

    return serializeGroceryList(groceryList);
  }

  async toggleItem(itemId: string, checked: boolean) {
    await bootstrapDatabase();

    const item = await prisma.groceryItem.update({
      where: {
        id: itemId
      },
      data: {
        checked
      },
      include: {
        groceryList: {
          include: {
            items: true
          }
        }
      }
    });

    return serializeGroceryList({
      ...item.groceryList,
      items: item.groceryList.items
    });
  }
}
