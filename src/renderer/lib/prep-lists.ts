import type {
  PrepItemPayload,
  PrepListGroupBy,
  PrepListPayload,
  PrepListSortMode,
} from "@shared/types";
import type { QuickFilterIconKey } from "@/lib/icon-registry";

export const PREP_QUICK_FILTERS = [
  { id: "today", label: "Today", icon: "calendar" },
  { id: "upcoming", label: "Next 7 Days", icon: "calendar-range" },
  { id: "ongoing", label: "Ongoing", icon: "receipt" },
  { id: "fav", label: "Favourites", icon: "star" },
  { id: "recent", label: "Recent", icon: "clock" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  icon: QuickFilterIconKey;
}>;

export type PrepQuickFilter = (typeof PREP_QUICK_FILTERS)[number]["id"];
export type PrepItem = PrepItemPayload;
export type PrepList = PrepListPayload;

export const PREP_GROUP_OPTIONS: Array<{ value: PrepListGroupBy; label: string }> = [
  { value: "dish", label: "Dish" },
  { value: "type", label: "Type" },
  { value: "prepGroup", label: "Prep Group" },
  { value: "kind", label: "Kind" },
  { value: "none", label: "None" },
];

export const PREP_SORT_OPTIONS: Array<{ value: PrepListSortMode; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "name", label: "Name" },
  { value: "dish", label: "Dish" },
  { value: "type", label: "Type" },
  { value: "kind", label: "Kind" },
  { value: "checked", label: "Checked" },
];

export const formatPrepDate = (value: string | Date | null) => {
  if (!value) {
    return "Ongoing";
  }

  return new Date(value).toLocaleDateString("default", {
    month: "short",
    day: "numeric",
  });
};

export const comparePrepLists = (left: PrepList, right: PrepList) => {
  const leftOngoing = left.date === null;
  const rightOngoing = right.date === null;

  if (leftOngoing && rightOngoing) {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  }
  if (leftOngoing) return -1;
  if (rightOngoing) return 1;

  const dateDiff =
    new Date(left.date as string).getTime() - new Date(right.date as string).getTime();
  return dateDiff !== 0
    ? dateDiff
    : new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
};

export const sortPrepLists = (lists: PrepList[]) => [...lists].sort(comparePrepLists);

export const isToday = (dt: string | Date | null) =>
  !!dt && new Date(dt).toDateString() === new Date().toDateString();

export const isUpcoming = (dt: string | Date | null, days = 7) => {
  if (!dt) {
    return false;
  }

  const diff = (new Date(dt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
};

export const derivePrepList = (
  list: PrepList,
  updatedAt = new Date().toISOString()
): PrepList => {
  const checkedCount = list.items.filter((item) => item.checked).length;
  const totalItems = list.items.length;

  return {
    ...list,
    checkedCount,
    totalItems,
    completionPercentage:
      totalItems === 0 ? 0 : Math.round((checkedCount / totalItems) * 100),
    updatedAt,
  };
};

export const upsertPrepList = (lists: PrepList[], nextList: PrepList) => {
  const index = lists.findIndex((list) => list.id === nextList.id);

  if (index === -1) {
    return sortPrepLists([...lists, derivePrepList(nextList, nextList.updatedAt)]);
  }

  return sortPrepLists(
    lists.map((list) =>
      list.id === nextList.id ? derivePrepList(nextList, nextList.updatedAt) : list
    )
  );
};

export const updatePrepListInCollection = (
  lists: PrepList[],
  listId: string,
  updater: (list: PrepList) => PrepList
) => sortPrepLists(lists.map((list) => (list.id === listId ? derivePrepList(updater(list)) : list)));

export const removePrepListFromCollection = (lists: PrepList[], listId: string) =>
  lists.filter((list) => list.id !== listId);

export const sortPrepItems = (items: PrepItem[], sortMode: PrepListSortMode) => {
  if (sortMode === "manual") {
    return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
  }

  return [...items].sort((left, right) => {
    if (sortMode === "checked" && left.checked !== right.checked) {
      return Number(left.checked) - Number(right.checked);
    }

    const leftValue =
      sortMode === "dish"
        ? left.dish ?? ""
        : sortMode === "type"
          ? left.ingredientType ?? left.prepGroup ?? ""
          : sortMode === "kind"
            ? left.kind
            : left.name;
    const rightValue =
      sortMode === "dish"
        ? right.dish ?? ""
        : sortMode === "type"
          ? right.ingredientType ?? right.prepGroup ?? ""
          : sortMode === "kind"
            ? right.kind
            : right.name;

    return leftValue.localeCompare(rightValue) || left.name.localeCompare(right.name);
  });
};

export const groupPrepItems = (items: PrepItem[], groupBy: PrepListGroupBy) => {
  const sorted = sortPrepItems(items, "manual");
  if (groupBy === "none") {
    return [["All Items", sorted]] as Array<[string, PrepItem[]]>;
  }

  const map = new Map<string, PrepItem[]>();
  sorted.forEach((item) => {
    const key =
      groupBy === "dish"
        ? item.dish || "General"
        : groupBy === "type"
          ? item.ingredientType || item.prepGroup || "General"
          : groupBy === "prepGroup"
            ? item.prepGroup || "General"
            : item.kind === "task"
              ? "Prep Tasks"
              : "Ingredients";

    map.set(key, [...(map.get(key) ?? []), item]);
  });

  return Array.from(map.entries());
};

export const moveItem = <T>(items: T[], fromIndex: number, toIndex: number) => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};