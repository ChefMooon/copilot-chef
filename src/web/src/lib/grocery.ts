export const CATEGORIES = [
  "Produce",
  "Meat & Fish",
  "Dairy & Eggs",
  "Bakery",
  "Pantry",
  "Frozen",
  "Drinks",
  "Other"
] as const;

export const UNITS = ["", "pcs", "g", "kg", "ml", "L", "cups", "tbsp", "tsp", "oz", "lb", "bunches", "cans", "bags", "boxes"] as const;

export const QUICK_FILTERS = [
  { id: "today", label: "Today", icon: "📅" },
  { id: "upcoming", label: "Next 7 Days", icon: "🗓️" },
  { id: "fav", label: "Favourites", icon: "⭐" },
  { id: "recent", label: "Recent", icon: "🕐" }
] as const;

export type QuickFilter = (typeof QUICK_FILTERS)[number]["id"];

export type GroceryItem = {
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

export type GroceryList = {
  id: string;
  name: string;
  date: string;
  favourite: boolean;
  mealPlanId: string | null;
  mealPlan: string | null;
  createdAt: string;
  updatedAt: string;
  checkedCount: number;
  totalItems: number;
  completionPercentage: number;
  items: GroceryItem[];
};

export const formatListDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("default", { month: "short", day: "numeric" });

export const isToday = (dt: string | Date) =>
  new Date(dt).toDateString() === new Date().toDateString();

export const isUpcoming = (dt: string | Date, days = 7) => {
  const diff = (new Date(dt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
};

export const listProgress = (items: GroceryItem[]) => {
  if (!items.length) {
    return 0;
  }

  return Math.round((items.filter((item) => item.checked).length / items.length) * 100);
};

export const groupByCategory = (items: GroceryItem[]) => {
  const map: Record<string, GroceryItem[]> = {};
  CATEGORIES.forEach((category) => {
    map[category] = [];
  });

  items.forEach((item) => {
    if (!map[item.category]) {
      map[item.category] = [];
    }
    map[item.category].push(item);
  });

  return Object.entries(map).filter(([, value]) => value.length > 0);
};

export const deriveGroceryList = (list: GroceryList, updatedAt = new Date().toISOString()): GroceryList => {
  const checkedCount = list.items.filter((item) => item.checked).length;
  const totalItems = list.items.length;

  return {
    ...list,
    checkedCount,
    totalItems,
    completionPercentage: totalItems === 0 ? 0 : Math.round((checkedCount / totalItems) * 100),
    updatedAt
  };
};

export const upsertGroceryList = (lists: GroceryList[], nextList: GroceryList) => {
  const index = lists.findIndex((list) => list.id === nextList.id);

  if (index === -1) {
    return [...lists, deriveGroceryList(nextList, nextList.updatedAt)];
  }

  return lists.map((list) => (list.id === nextList.id ? deriveGroceryList(nextList, nextList.updatedAt) : list));
};

export const updateGroceryListInCollection = (
  lists: GroceryList[],
  listId: string,
  updater: (list: GroceryList) => GroceryList
) => lists.map((list) => (list.id === listId ? deriveGroceryList(updater(list)) : list));

export const removeGroceryListFromCollection = (lists: GroceryList[], listId: string) =>
  lists.filter((list) => list.id !== listId);

export const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};
