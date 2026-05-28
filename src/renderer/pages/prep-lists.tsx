import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MealPayload, PrepListGenerateInput } from "@shared/types";

import { fetchJson, isApiError } from "@/lib/api";
import { isServerConfigReady } from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import {
  PREP_GROUP_OPTIONS,
  PREP_QUICK_FILTERS,
  PREP_SORT_OPTIONS,
  derivePrepList,
  formatPrepDate,
  isToday,
  isUpcoming,
  moveItem,
  removePrepListFromCollection,
  sortPrepItems,
  sortPrepLists,
  type PrepItem,
  type PrepList,
  type PrepQuickFilter,
  updatePrepListInCollection,
  upsertPrepList,
} from "@/lib/prep-lists";

import styles from "@/components/grocery-list/grocery-list.module.css";

type DraftMode = "manual" | "generated";
type GeneratedMode = PrepListGenerateInput["sourceMode"];

const PREP_SOURCE_MODE_LABELS: Record<PrepList["sourceMode"], string> = {
  manual: "Manual",
  "single-meal": "Single Meal",
  "meal-slot": "Meal Slot",
  day: "Day",
  week: "Week",
  month: "Month",
  "date-range": "Date Range",
  historical: "Historical",
};

function toLocalDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalNoonIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

function toLocalStartIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function toLocalEndIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = (day + 6) % 7;
  next.setDate(next.getDate() - diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function computeRange(mode: GeneratedMode, anchor: string, from: string, to: string) {
  const anchorDate = new Date(toLocalNoonIso(anchor));

  if (mode === "day" || mode === "meal-slot") {
    return {
      fromDate: toLocalStartIso(anchor),
      toDate: toLocalEndIso(anchor),
      date: toLocalNoonIso(anchor),
    };
  }
  if (mode === "week") {
    return {
      fromDate: startOfWeek(anchorDate).toISOString(),
      toDate: endOfWeek(anchorDate).toISOString(),
      date: toLocalNoonIso(anchor),
    };
  }
  if (mode === "month") {
    return {
      fromDate: startOfMonth(anchorDate).toISOString(),
      toDate: endOfMonth(anchorDate).toISOString(),
      date: toLocalNoonIso(anchor),
    };
  }

  return {
    fromDate: from ? toLocalStartIso(from) : null,
    toDate: to ? toLocalEndIso(to) : null,
    date: from ? toLocalNoonIso(from) : null,
  };
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isDateLikeSourceLabel(value: string) {
  return /\d{4}-\d{2}-\d{2}/.test(value);
}

function formatPrepSourceRange(list: PrepList) {
  if (list.fromDate && list.toDate) {
    const formattedFrom = formatPrepDate(list.fromDate);
    const formattedTo = formatPrepDate(list.toDate);
    return formattedFrom === formattedTo ? formattedFrom : `${formattedFrom} - ${formattedTo}`;
  }

  if (list.fromDate) {
    return formatPrepDate(list.fromDate);
  }

  if (list.toDate) {
    return formatPrepDate(list.toDate);
  }

  if (list.date) {
    return formatPrepDate(list.date);
  }

  return null;
}

function formatPrepSourceSummary(list: PrepList) {
  const parts = [PREP_SOURCE_MODE_LABELS[list.sourceMode]];
  const sourceLabel = list.sourceLabel?.trim();
  const sourceRange = formatPrepSourceRange(list);

  if (sourceLabel && !sourceRange && !parts.includes(sourceLabel)) {
    parts.push(sourceLabel);
  }

  if (
    sourceLabel &&
    sourceRange &&
    !isDateLikeSourceLabel(sourceLabel) &&
    !parts.includes(sourceLabel)
  ) {
    parts.push(sourceLabel);
  }

  if (sourceRange && !parts.includes(sourceRange)) {
    parts.push(sourceRange);
  }

  return parts.join(" · ");
}

function formatPrepSourceTooltip(list: PrepList) {
  const details: string[] = [];

  if (list.fromDate) {
    details.push(`Start: ${new Date(list.fromDate).toLocaleString()}`);
  }

  if (list.toDate) {
    details.push(`End: ${new Date(list.toDate).toLocaleString()}`);
  }

  if (!list.fromDate && !list.toDate && list.date) {
    details.push(`Date: ${new Date(list.date).toLocaleString()}`);
  }

  return details.join("\n");
}

function normalizeListNotes(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.trim().length > 0 ? value : null;
}

export default function PrepListsPage() {
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const listsQueryKey = ["prep-lists"] as const;
  const today = toLocalDateInput(new Date());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<PrepQuickFilter>("today");
  const [upcomingDays, setUpcomingDays] = useState(7);
  const [showModal, setShowModal] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);
  const [draftMode, setDraftMode] = useState<DraftMode>("generated");
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(today);
  const [newOngoing, setNewOngoing] = useState(false);
  const [generatedMode, setGeneratedMode] = useState<GeneratedMode>("week");
  const [rangeAnchor, setRangeAnchor] = useState(today);
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);
  const [mealType, setMealType] = useState("DINNER");
  const [selectedMealId, setSelectedMealId] = useState<string>("");
  const [mealSearch, setMealSearch] = useState("");
  const [includeTasks, setIncludeTasks] = useState(true);
  const [includeIngredients, setIncludeIngredients] = useState(true);
  const [includeQuantities, setIncludeQuantities] = useState(true);
  const [includeTypes, setIncludeTypes] = useState(true);
  const [includeSourceLabels, setIncludeSourceLabels] = useState(true);
  const [excludePantryStaples, setExcludePantryStaples] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemKind, setNewItemKind] = useState<PrepItem["kind"]>("ingredient");
  const [notesDraft, setNotesDraft] = useState("");
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverState, setDragOverState] = useState<{
    itemId: string;
    position: "before" | "after";
  } | null>(null);
  const notesSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNotesSaveRef = useRef<{ listId: string; notes: string | null } | null>(null);

  const listsQuery = useQuery({
    queryKey: listsQueryKey,
    enabled: apiReady,
    queryFn: () =>
      fetchJson<{ data: PrepList[] }>("/api/prep-lists").then((response) => response.data),
  });

  const mealOptionsQuery = useQuery({
    queryKey: ["prep-generator-meals", rangeAnchor],
    enabled: apiReady && showModal,
    queryFn: () => {
      const from = new Date(toLocalStartIso(rangeAnchor));
      from.setDate(from.getDate() - 14);
      const to = new Date(toLocalEndIso(rangeAnchor));
      to.setDate(to.getDate() + 14);
      return fetchJson<{ data: MealPayload[] }>(
        `/api/meals?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
      ).then((response) => response.data);
    },
  });

  const lists = useMemo(() => sortPrepLists(listsQuery.data ?? []), [listsQuery.data]);

  const nearbyMeals = useMemo(() => mealOptionsQuery.data ?? [], [mealOptionsQuery.data]);
  const filteredMeals = useMemo(() => {
    const query = mealSearch.trim().toLowerCase();
    return nearbyMeals.filter((meal) => {
      if (!query) {
        return true;
      }
      return [meal.name, meal.mealType, meal.date ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [mealSearch, nearbyMeals]);

  const selectedSingleMeal = useMemo(
    () => nearbyMeals.find((meal) => meal.id === selectedMealId) ?? null,
    [nearbyMeals, selectedMealId]
  );

  const slotPreviewMeals = useMemo(() => {
    const slotDate = computeRange("meal-slot", rangeAnchor, rangeFrom, rangeTo);
    return nearbyMeals.filter(
      (meal) => meal.date && meal.mealType === mealType && meal.date >= slotDate.fromDate! && meal.date <= slotDate.toDate!
    );
  }, [mealType, nearbyMeals, rangeAnchor, rangeFrom, rangeTo]);

  const duplicateSourceLists = useMemo(() => {
    if (draftMode !== "generated") {
      return [] as PrepList[];
    }

    const range = computeRange(generatedMode, rangeAnchor, rangeFrom, rangeTo);
    const nextMealIds = generatedMode === "single-meal" && selectedMealId ? [selectedMealId] : [];

    return lists.filter((list) => {
      if (list.sourceMode !== generatedMode) {
        return false;
      }
      if (generatedMode === "single-meal") {
        return arraysEqual(list.sourceMealIds, nextMealIds);
      }
      if (generatedMode === "meal-slot") {
        return (
          list.fromDate === range.fromDate &&
          list.toDate === range.toDate &&
          list.sourceLabel?.startsWith(mealType)
        );
      }
      return list.fromDate === range.fromDate && list.toDate === range.toDate;
    });
  }, [draftMode, generatedMode, lists, mealType, rangeAnchor, rangeFrom, rangeTo, selectedMealId]);

  const selectedList = useMemo(() => {
    if (selectedId) {
      const match = lists.find((list) => list.id === selectedId);
      if (match) {
        return match;
      }
    }
    return lists[0] ?? null;
  }, [lists, selectedId]);

  const deleteCandidate = useMemo(
    () => lists.find((list) => list.id === deleteCandidateId) ?? null,
    [deleteCandidateId, lists]
  );

  const filteredQuick = useMemo(() => {
    if (activeFilter === "today") {
      return sortPrepLists(lists.filter((list) => isToday(list.date)));
    }
    if (activeFilter === "upcoming") {
      return sortPrepLists(lists.filter((list) => isUpcoming(list.date, upcomingDays)));
    }
    if (activeFilter === "ongoing") {
      return sortPrepLists(lists.filter((list) => list.date === null));
    }
    if (activeFilter === "fav") {
      return sortPrepLists(lists.filter((list) => list.favourite));
    }
    if (activeFilter === "recent") {
      return sortPrepLists(lists).slice(0, 5);
    }
    return sortPrepLists(lists);
  }, [activeFilter, lists, upcomingDays]);

  const orderedItems = useMemo(() => {
    if (!selectedList) {
      return [];
    }
    return sortPrepItems(selectedList.items, selectedList.sortMode);
  }, [selectedList]);

  const isManualSort = selectedList?.sortMode === "manual";

  const setListsCache = (updater: (current: PrepList[]) => PrepList[]) => {
    queryClient.setQueryData<PrepList[]>(listsQueryKey, (current) =>
      sortPrepLists(updater(current ?? []))
    );
  };

  const setListCache = (listId: string, updater: (current: PrepList) => PrepList) => {
    queryClient.setQueryData<PrepList | undefined>(["prep-list", listId], (current) =>
      current ? derivePrepList(updater(current)) : current
    );
  };

  const applyItemOrder = (list: PrepList, itemIds: string[]) => ({
    ...list,
    items: itemIds
      .map((itemId, index) => {
        const item = list.items.find((entry) => entry.id === itemId);
        return item ? { ...item, sortOrder: index } : null;
      })
      .filter((item): item is PrepItem => item !== null),
  });

  const syncList = (nextList: PrepList, previousId?: string) => {
    if (previousId && previousId !== nextList.id) {
      setListsCache((current) => removePrepListFromCollection(current, previousId));
      queryClient.removeQueries({ queryKey: ["prep-list", previousId], exact: true });
    }

    setListsCache((current) => upsertPrepList(current, nextList));
    queryClient.setQueryData(["prep-list", nextList.id], derivePrepList(nextList, nextList.updatedAt));
  };

  const rollback = (
    previousLists: PrepList[] | undefined,
    previousList: PrepList | undefined,
    listId: string,
    clearList = false
  ) => {
    queryClient.setQueryData(listsQueryKey, previousLists);
    if (clearList) {
      queryClient.removeQueries({ queryKey: ["prep-list", listId], exact: true });
      return;
    }
    queryClient.setQueryData(["prep-list", listId], previousList);
  };

  const patchList = async (id: string, payload: Partial<PrepList>) => {
    const previousLists = queryClient.getQueryData<PrepList[]>(listsQueryKey);
    const previousList = queryClient.getQueryData<PrepList>(["prep-list", id]);

    setListsCache((current) =>
      updatePrepListInCollection(current, id, (list) => ({ ...list, ...payload }))
    );
    setListCache(id, (list) => ({ ...list, ...payload }));

    try {
      const response = await fetchJson<{ data: PrepList }>(`/api/prep-lists/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      syncList(response.data);
    } catch (error) {
      rollback(previousLists, previousList, id);
      throw error;
    }
  };

  const saveListNotes = async (listId: string, notes: string | null) => {
    try {
      await patchList(listId, { notes });
    } catch (error) {
      const description = isApiError(error) ? error.message : "Unable to save notes";
      toast({ title: "Notes save failed", description, variant: "destructive" });
    }
  };

  const flushPendingListNotes = () => {
    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current);
      notesSaveTimeoutRef.current = null;
    }

    const pending = pendingNotesSaveRef.current;
    pendingNotesSaveRef.current = null;

    if (!pending) {
      return;
    }

    void saveListNotes(pending.listId, pending.notes);
  };

  const scheduleListNotesSave = (listId: string, nextValue: string) => {
    const normalizedNext = normalizeListNotes(nextValue);
    const currentList = lists.find((list) => list.id === listId);
    const normalizedCurrent = normalizeListNotes(currentList?.notes ?? null);

    if (normalizedNext === normalizedCurrent) {
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current);
        notesSaveTimeoutRef.current = null;
      }
      pendingNotesSaveRef.current = null;
      return;
    }

    if (pendingNotesSaveRef.current && pendingNotesSaveRef.current.listId !== listId) {
      flushPendingListNotes();
    }

    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current);
    }

    pendingNotesSaveRef.current = { listId, notes: normalizedNext };
    notesSaveTimeoutRef.current = setTimeout(() => {
      notesSaveTimeoutRef.current = null;
      const pending = pendingNotesSaveRef.current;
      pendingNotesSaveRef.current = null;

      if (!pending) {
        return;
      }

      void saveListNotes(pending.listId, pending.notes);
    }, 500);
  };

  const selectList = (listId: string | null) => {
    flushPendingListNotes();
    setSelectedId(listId);
  };

  const closeNotesModal = () => {
    flushPendingListNotes();
    setShowNotesModal(false);
  };

  const patchItem = async (listId: string, itemId: string, payload: Partial<PrepItem>) => {
    const previousLists = queryClient.getQueryData<PrepList[]>(listsQueryKey);
    const previousList = queryClient.getQueryData<PrepList>(["prep-list", listId]);
    const applyItemUpdate = (list: PrepList) => ({
      ...list,
      items: list.items.map((item) => (item.id === itemId ? { ...item, ...payload } : item)),
    });

    setListsCache((current) => updatePrepListInCollection(current, listId, applyItemUpdate));
    setListCache(listId, applyItemUpdate);

    try {
      const response = await fetchJson<{ data: PrepList }>(
        `/api/prep-lists/${listId}/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );
      syncList(response.data);
    } catch (error) {
      rollback(previousLists, previousList, listId);
      throw error;
    }
  };

  const clearDragState = () => {
    setDraggedItemId(null);
    setDragOverState(null);
  };

  const reorderSelectedItems = async (itemIds: string[]) => {
    if (!selectedList || !isManualSort) {
      return;
    }

    const previousLists = queryClient.getQueryData<PrepList[]>(listsQueryKey);
    const previousList = queryClient.getQueryData<PrepList>(["prep-list", selectedList.id]);
    const applyReorder = (list: PrepList) => applyItemOrder(list, itemIds);

    setListsCache((current) => updatePrepListInCollection(current, selectedList.id, applyReorder));
    setListCache(selectedList.id, applyReorder);

    try {
      const response = await fetchJson<{ data: PrepList }>(
        `/api/prep-lists/${selectedList.id}/reorder`,
        {
          method: "POST",
          body: JSON.stringify({ itemIds }),
        }
      );
      syncList(response.data);
    } catch (error) {
      rollback(previousLists, previousList, selectedList.id);
      throw error;
    }
  };

  const movePrepItem = async (itemId: string, delta: -1 | 1) => {
    if (!selectedList || !isManualSort) {
      return;
    }

    const currentItems = orderedItems;
    const index = currentItems.findIndex((item) => item.id === itemId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= currentItems.length) {
      return;
    }

    const next = moveItem(currentItems, index, target);
    await reorderSelectedItems(next.map((item) => item.id));
  };

  const getDropPosition = (event: DragEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  };

  const dropPrepItem = async (targetItemId: string, position: "before" | "after") => {
    if (!selectedList || !isManualSort || !draggedItemId || draggedItemId === targetItemId) {
      clearDragState();
      return;
    }

    const draggedItem = orderedItems.find((item) => item.id === draggedItemId);
    if (!draggedItem) {
      clearDragState();
      return;
    }

    const remaining = orderedItems.filter((item) => item.id !== draggedItemId);
    const targetIndex = remaining.findIndex((item) => item.id === targetItemId);

    if (targetIndex === -1) {
      clearDragState();
      return;
    }

    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    const next = [...remaining];
    next.splice(insertIndex, 0, draggedItem);

    if (next.every((item, index) => item.id === orderedItems[index]?.id)) {
      clearDragState();
      return;
    }

    clearDragState();
    await reorderSelectedItems(next.map((item) => item.id));
  };

  const createManualList = async () => {
    const response = await fetchJson<{ data: PrepList }>("/api/prep-lists", {
      method: "POST",
      body: JSON.stringify({
        name: newName.trim() || "New Prep List",
        date: newOngoing ? null : toLocalNoonIso(newDate),
      }),
    });
    syncList(response.data);
    selectList(response.data.id);
  };

  const generateList = async () => {
    const range = computeRange(generatedMode, rangeAnchor, rangeFrom, rangeTo);
    const payload: PrepListGenerateInput = {
      name: newName.trim() || undefined,
      sourceMode: generatedMode,
      mealIds: generatedMode === "single-meal" && selectedMealId ? [selectedMealId] : undefined,
      mealType: generatedMode === "meal-slot" ? mealType : undefined,
      fromDate: range.fromDate,
      toDate: range.toDate,
      date: range.date,
      includeIngredients,
      includeTasks,
      includeQuantities,
      includeIngredientTypes: includeTypes,
      includeSourceLabels,
      excludePantryStaples,
    };

    const response = await fetchJson<{ data: PrepList }>("/api/prep-lists/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    syncList(response.data);
    selectList(response.data.id);
  };

  const submitNewList = async () => {
    try {
      if (draftMode === "generated" && duplicateSourceLists.length > 0) {
        const confirmed = window.confirm(
          `A prep list for this source already exists (${duplicateSourceLists
            .map((list) => list.name)
            .join(", ")}). Create another one?`
        );
        if (!confirmed) {
          return;
        }
      }

      if (draftMode === "manual") {
        await createManualList();
      } else {
        await generateList();
      }
      setShowModal(false);
      setNewName("");
      toast({ title: "Prep list ready" });
    } catch (error) {
      const description = isApiError(error) ? error.message : "Unable to save prep list";
      toast({ title: "Prep list failed", description, variant: "destructive" });
    }
  };

  const deleteList = async (listId: string) => {
    const previousLists = queryClient.getQueryData<PrepList[]>(listsQueryKey);
    setListsCache((current) => removePrepListFromCollection(current, listId));
    if (selectedId === listId) {
      selectList(null);
    }

    try {
      await fetchJson<{ data: { id: string } }>(`/api/prep-lists/${listId}`, { method: "DELETE" });
      queryClient.removeQueries({ queryKey: ["prep-list", listId], exact: true });
    } catch (error) {
      queryClient.setQueryData(listsQueryKey, previousLists);
      throw error;
    }
  };

  const confirmDeleteList = async () => {
    if (!deleteCandidate) {
      return;
    }

    setIsDeletingList(true);
    try {
      await deleteList(deleteCandidate.id);
      setDeleteCandidateId(null);
    } catch (error) {
      const description = isApiError(error) ? error.message : "Unable to delete prep list";
      toast({ title: "Delete failed", description, variant: "destructive" });
    } finally {
      setIsDeletingList(false);
    }
  };

  const createItem = async () => {
    if (!selectedList || !newItemName.trim()) {
      return;
    }

    const response = await fetchJson<{ data: PrepList }>(`/api/prep-lists/${selectedList.id}/items`, {
      method: "POST",
      body: JSON.stringify({
        name: newItemName.trim(),
        kind: newItemKind,
      }),
    });

    syncList(response.data);
    setNewItemName("");
    setNewItemKind("ingredient");
  };

  const deleteItem = async (listId: string, itemId: string) => {
    const response = await fetchJson<{ data: PrepList }>(`/api/prep-lists/${listId}/items/${itemId}`, {
      method: "DELETE",
    });
    syncList(response.data);
  };

  const regenerateSelectedList = async () => {
    if (!selectedList || selectedList.sourceMode === "manual") {
      return;
    }

    try {
      const response = await fetchJson<{ data: PrepList }>(
        `/api/prep-lists/${selectedList.id}/regenerate`,
        { method: "POST" }
      );
      syncList(response.data);
      toast({ title: "Prep list regenerated" });
    } catch (error) {
      const description = isApiError(error) ? error.message : "Unable to regenerate prep list";
      toast({ title: "Regeneration failed", description, variant: "destructive" });
    }
  };

  useEffect(() => {
    setNotesDraft(selectedList?.notes ?? "");
    setShowNotesModal(false);
  }, [selectedList?.id]);

  useEffect(() => {
    return () => {
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>Prep Lists</div>
          <h1 className={styles.pageTitle}>Prep Workflows</h1>
          <p className={styles.pageSub}>
            {listsQuery.isLoading && !listsQuery.data
              ? "Loading prep lists..."
              : `${lists.length} list${lists.length === 1 ? "" : "s"} · ingredients and prep tasks in one place`}
          </p>
        </div>
        <div className="flex gap-2">
          <button className={styles.btnNewList} onClick={() => setShowModal(true)} type="button">
            + New Prep List
          </button>
        </div>
      </div>

      <div className={styles.sectionLabel}>Quick Reference</div>
      <div className={styles.filterTabs}>
        {PREP_QUICK_FILTERS.map((filter) => (
          <button
            className={`${styles.filterTab} ${activeFilter === filter.id ? styles.filterTabActive : ""}`}
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            type="button"
          >
            <span>{filter.icon}</span>
            <span>{filter.label}</span>
          </button>
        ))}
        {activeFilter === "upcoming" ? (
          <label className={styles.upcomingControl}>
            Days:
            <input
              aria-label="Upcoming filter days"
              className={styles.upcomingInput}
              max={60}
              min={1}
              onChange={(event) => setUpcomingDays(Number(event.target.value) || 1)}
              type="number"
              value={upcomingDays}
            />
          </label>
        ) : null}
      </div>
      <div className={styles.carouselWrap}>
        <div className={styles.carousel}>
          {filteredQuick.length === 0 ? (
            <div className={styles.quickEmpty}>No prep lists match this filter.</div>
          ) : null}
          {filteredQuick.map((list) => (
            <div
              className={`${styles.quickCard} ${selectedList?.id === list.id ? styles.quickCardSelected : ""}`}
              key={list.id}
            >
              <button
                className={`${styles.quickCardFav} ${list.favourite ? styles.quickCardFavActive : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void patchList(list.id, { favourite: !list.favourite });
                }}
                type="button"
              >
                {list.favourite ? "⭐" : "☆"}
              </button>
              <button
                className={styles.quickCardAction}
                onClick={() => selectList(list.id)}
                type="button"
              >
                <div className={styles.quickCardName}>{list.name}</div>
                <div className={styles.quickCardDate}>
                  {formatPrepDate(list.date)} · {list.totalItems} items
                </div>
                <div className={styles.quickCardMeta}>{list.sourceMode}</div>
                <div className={styles.quickCardProgress}>
                  <div
                    className={styles.quickCardFill}
                    style={{ width: `${list.completionPercentage}%` }}
                  />
                </div>
                <div className={styles.quickCardPct}>{list.completionPercentage}% complete</div>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.mainCols}>
        <div className={styles.listsSidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}>All Prep Lists</div>
            <div className={styles.sidebarCount}>{lists.length}</div>
          </div>
          {lists.map((list) => (
            <div
              className={`${styles.listRow} ${selectedList?.id === list.id ? styles.listRowSelected : ""}`}
              key={list.id}
              onClick={() => selectList(list.id)}
              role="button"
              tabIndex={0}
            >
              <div className={styles.listRowInfo}>
                <div className={styles.listRowName}>{list.name}</div>
                <div className={styles.listRowMeta}>
                  {formatPrepDate(list.date)} · {list.sourceMode}
                </div>
              </div>
              <button
                className={`${styles.listRowFav} ${list.favourite ? styles.listRowFavOn : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void patchList(list.id, { favourite: !list.favourite });
                }}
                type="button"
              >
                {list.favourite ? "⭐" : "☆"}
              </button>
              <div className={styles.listRowPct}>{list.completionPercentage}%</div>
            </div>
          ))}
        </div>

        {selectedList ? (
          <div className={styles.editorPanel} key={selectedList.id}>
            <div className={styles.editorHeader}>
              <div className={styles.editorTitleRow}>
                <input
                  aria-label="Prep list name"
                  className={styles.editorNameInput}
                  onBlur={(event) => {
                    if (event.target.value.trim() && event.target.value.trim() !== selectedList.name) {
                      void patchList(selectedList.id, { name: event.target.value.trim() });
                    }
                  }}
                  defaultValue={selectedList.name}
                />
                <div className={styles.editorHeaderMeta}>
                  <span className={styles.editorMetaChip} title={formatPrepSourceTooltip(selectedList) || undefined}>
                    <span className={styles.editorMetaChipLabel}>Source</span>
                    <span>{formatPrepSourceSummary(selectedList)}</span>
                  </span>
                  <span className={styles.editorMetaChip}>
                    <span className={styles.editorMetaChipLabel}>Created</span>
                    <span>{formatPrepDate(selectedList.createdAt)}</span>
                  </span>
                </div>
              </div>

              <div className={styles.editorHeaderActions}>
                <button
                  className={styles.btnShop}
                  onClick={() => {
                    flushPendingListNotes();
                    navigate(`/prep-lists/prep/${selectedList.id}`);
                  }}
                  type="button"
                >
                  Prep
                </button>
                {selectedList.sourceMode !== "manual" ? (
                  <button className={styles.btnGhost} onClick={() => void regenerateSelectedList()} type="button">
                    Regenerate
                  </button>
                ) : null}
                <div className={styles.selectStack}>
                  <label className={styles.compactSelectField}>
                    <span className={styles.compactSelectLabel}>Sort</span>
                    <select
                      aria-label="Sort prep items"
                      className={`${styles.itemCatSelect} ${styles.sortSelect}`}
                      onChange={(event) => void patchList(selectedList.id, { sortMode: event.target.value as PrepList["sortMode"] })}
                      value={selectedList.sortMode}
                    >
                      {PREP_SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.compactSelectField}>
                    <span className={styles.compactSelectLabel}>Group</span>
                    <select
                      aria-label="Group prep items"
                      className={`${styles.itemCatSelect} ${styles.groupSelect}`}
                      onChange={(event) => void patchList(selectedList.id, { groupBy: event.target.value as PrepList["groupBy"] })}
                      value={selectedList.groupBy}
                    >
                      {PREP_GROUP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button className={styles.btnDeleteList} onClick={() => setDeleteCandidateId(selectedList.id)} type="button">
                  🗑
                </button>
              </div>
            </div>

            <div className={styles.editorProgress}>
              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${selectedList.completionPercentage}%` }}
                />
              </div>
              <span className={styles.progressLabel}>
                {selectedList.checkedCount} of {selectedList.totalItems} complete · {selectedList.completionPercentage}%
              </span>
            </div>

            <div className={styles.listNotesSection}>
              <div className={styles.listNotesHeader}>
                <span className={styles.listNotesLabel}>List Notes</span>
                <button className={styles.btnGhost} onClick={() => setShowNotesModal(true)} type="button">
                  Expand
                </button>
              </div>
              <textarea
                aria-label="List notes"
                className={styles.listNotesInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setNotesDraft(nextValue);
                  scheduleListNotesSave(selectedList.id, nextValue);
                }}
                placeholder="Add notes for this prep list..."
                rows={2}
                value={notesDraft}
              />
            </div>

            <div className={styles.editorItems}>
              {orderedItems.map((item, index) => (
                <div
                  className={`${styles.itemRow} ${draggedItemId === item.id ? styles.itemRowDragging : ""} ${dragOverState?.itemId === item.id && dragOverState.position === "before" ? styles.itemRowDropBefore : ""} ${dragOverState?.itemId === item.id && dragOverState.position === "after" ? styles.itemRowDropAfter : ""}`}
                  data-prep-list-drag-source="prep-item"
                  draggable={isManualSort}
                  key={item.id}
                  onDragEnd={clearDragState}
                  onDragOver={(event) => {
                    if (!isManualSort || !draggedItemId) {
                      return;
                    }
                    event.preventDefault();
                    setDragOverState({ itemId: item.id, position: getDropPosition(event) });
                  }}
                  onDragStart={(event) => {
                    if (!isManualSort) {
                      return;
                    }
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.id);
                    setDraggedItemId(item.id);
                  }}
                  onDrop={(event) => {
                    if (!isManualSort) {
                      return;
                    }
                    event.preventDefault();
                    void dropPrepItem(item.id, getDropPosition(event));
                  }}
                >
                  <div className={styles.itemRowMain}>
                    <span
                      className={styles.dragHandle}
                      style={{ cursor: isManualSort ? "grab" : "not-allowed", opacity: isManualSort ? 1 : 0.4 }}
                      title={isManualSort ? "Drag to reorder" : "Switch sort mode to Manual to reorder"}
                    >
                      ⠿
                    </span>
                    <input
                      aria-label={`Mark ${item.name} complete`}
                      checked={item.checked}
                      className={styles.itemCheck}
                      onChange={(event) => void patchItem(selectedList.id, item.id, { checked: event.target.checked })}
                      type="checkbox"
                    />
                    <input
                      aria-label="Prep item name"
                      className={`${styles.itemNameInput} ${item.checked ? styles.itemDone : ""}`}
                      defaultValue={item.name}
                      onBlur={(event) => {
                        const nextName = event.target.value.trim();
                        if (nextName && nextName !== item.name) {
                          void patchItem(selectedList.id, item.id, { name: nextName });
                        }
                      }}
                    />
                    <div className={styles.itemQtyRow}>
                      <input
                        aria-label={`Quantity for ${item.name}`}
                        className={styles.itemQtyInput}
                        defaultValue={item.qty ?? ""}
                        onBlur={(event) =>
                          void patchItem(selectedList.id, item.id, { qty: event.target.value || null })
                        }
                        placeholder="qty"
                      />
                      <input
                        aria-label={`Unit for ${item.name}`}
                        className={styles.itemUnitSelect}
                        defaultValue={item.unit ?? ""}
                        onBlur={(event) =>
                          void patchItem(selectedList.id, item.id, { unit: event.target.value || null })
                        }
                        placeholder="unit"
                      />
                    </div>
                    <div className={styles.itemRowActions}>
                      <button
                        className={styles.iconBtn}
                        disabled={!isManualSort || index === 0}
                        onClick={() => void movePrepItem(item.id, -1)}
                        title={isManualSort ? "Move up" : "Reorder only in Manual sort"}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        className={styles.iconBtn}
                        disabled={!isManualSort || index === orderedItems.length - 1}
                        onClick={() => void movePrepItem(item.id, 1)}
                        title={isManualSort ? "Move down" : "Reorder only in Manual sort"}
                        type="button"
                      >
                        ↓
                      </button>
                      <button className={`${styles.iconBtn} ${styles.itemDeleteBtn}`} onClick={() => void deleteItem(selectedList.id, item.id)} type="button">
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className={styles.itemRowExtra}>
                    <div className={styles.itemExtraField}>
                      <span className={styles.itemExtraLabel}>Type</span>
                      <select
                        aria-label={`Type for ${item.name}`}
                        className={styles.itemCatSelect}
                        onChange={(event) =>
                          void patchItem(selectedList.id, item.id, { kind: event.target.value as PrepItem["kind"] })
                        }
                        value={item.kind}
                      >
                        <option value="ingredient">Ingredient</option>
                        <option value="task">Task</option>
                      </select>
                    </div>
                    <div className={styles.itemExtraField}>
                      <span className={styles.itemExtraLabel}>Dish</span>
                      <input
                        aria-label={`Dish for ${item.name}`}
                        className={styles.itemExtraInput}
                        defaultValue={item.dish ?? ""}
                        onBlur={(event) =>
                          void patchItem(selectedList.id, item.id, { dish: event.target.value || null })
                        }
                        placeholder="Dish"
                      />
                    </div>
                    <div className={styles.itemExtraField}>
                      <span className={styles.itemExtraLabel}>Ingredient Type</span>
                      <input
                        aria-label={`Ingredient type for ${item.name}`}
                        className={styles.itemExtraInput}
                        defaultValue={item.ingredientType ?? item.prepGroup ?? ""}
                        onBlur={(event) =>
                          void patchItem(selectedList.id, item.id, { ingredientType: event.target.value || null })
                        }
                        placeholder="Type"
                      />
                    </div>
                    <div className={styles.itemExtraField}>
                      <span className={styles.itemExtraLabel}>Notes</span>
                      <input
                        aria-label={`Notes for ${item.name}`}
                        className={styles.itemExtraInput}
                        defaultValue={item.notes ?? ""}
                        onBlur={(event) =>
                          void patchItem(selectedList.id, item.id, { notes: event.target.value || null })
                        }
                        placeholder="Notes"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.editorAddRow}>
              <select
                aria-label="New prep item kind"
                className={styles.itemCatSelect}
                onChange={(event) => setNewItemKind(event.target.value as PrepItem["kind"])}
                value={newItemKind}
              >
                <option value="ingredient">Ingredient</option>
                <option value="task">Task</option>
              </select>
              <input
                aria-label="Add prep item"
                className={styles.editorAddInput}
                onChange={(event) => setNewItemName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void createItem();
                  }
                }}
                placeholder="Add a prep item..."
                value={newItemName}
              />
              <button className={styles.btnAddItem} onClick={() => void createItem()} type="button">
                + Add
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.editorPlaceholder}>
            <div className={styles.editorPlaceholderIcon}>🥣</div>
            <p className={styles.editorPlaceholderText}>Select a prep list to edit it.</p>
          </div>
        )}
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !isDeletingList) {
            setDeleteCandidateId(null);
          }
        }}
        open={Boolean(deleteCandidate)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete List</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate
                ? `Are you sure you want to delete ${deleteCandidate.name}? This cannot be undone.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button disabled={isDeletingList} type="button" variant="outline">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                disabled={isDeletingList || !deleteCandidate}
                onClick={() => void confirmDeleteList()}
                type="button"
                variant="accent"
              >
                {isDeletingList ? "Deleting..." : "Delete"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showModal ? (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.newListModal}>
            <div className={styles.newListHeader}>
              <h3 className={styles.newListTitle}>Create Prep List</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowModal(false)} type="button">
                ✕
              </button>
            </div>
            <div className={styles.newListBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Mode</label>
                <div className={styles.inlineActionRow}>
                  <button className={draftMode === "generated" ? styles.btnShop : styles.btnGhost} onClick={() => setDraftMode("generated")} type="button">
                    Generate
                  </button>
                  <button className={draftMode === "manual" ? styles.btnShop : styles.btnGhost} onClick={() => setDraftMode("manual")} type="button">
                    Manual
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Name</label>
                <input aria-label="Prep list name" className={styles.formInput} onChange={(event) => setNewName(event.target.value)} value={newName} />
              </div>

              {draftMode === "manual" ? (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Date</label>
                  <label className={styles.formCheckboxRow}>
                    <input aria-label="Ongoing prep list" checked={newOngoing} className={styles.formCheckbox} onChange={(event) => setNewOngoing(event.target.checked)} type="checkbox" />
                    Ongoing list (no date)
                  </label>
                  <input aria-label="Prep list date" className={styles.formInput} disabled={newOngoing} onChange={(event) => setNewDate(event.target.value)} type="date" value={newDate} />
                </div>
              ) : (
                <>
                  {duplicateSourceLists.length > 0 ? (
                    <div className={styles.warningCard}>
                      <div className={styles.warningTitle}>Duplicate Source Warning</div>
                      <div className={styles.warningText}>
                        A prep list already exists for this source: {duplicateSourceLists.map((list) => list.name).join(", ")}.
                        You can still create another one, or regenerate the existing list from its editor.
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Source</label>
                    <select aria-label="Prep source" className={styles.formInput} onChange={(event) => setGeneratedMode(event.target.value as GeneratedMode)} value={generatedMode}>
                      <option value="single-meal">Single meal</option>
                      <option value="meal-slot">Meal slot</option>
                      <option value="day">Entire day</option>
                      <option value="week">Entire week</option>
                      <option value="month">Entire month</option>
                      <option value="date-range">Date range</option>
                      <option value="historical">Historical range</option>
                    </select>
                  </div>

                  {(generatedMode === "day" || generatedMode === "week" || generatedMode === "month" || generatedMode === "meal-slot") ? (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Anchor date</label>
                      <input aria-label="Anchor date" className={styles.formInput} onChange={(event) => setRangeAnchor(event.target.value)} type="date" value={rangeAnchor} />
                    </div>
                  ) : null}

                  {(generatedMode === "date-range" || generatedMode === "historical") ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>From</label>
                        <input aria-label="Range start" className={styles.formInput} onChange={(event) => setRangeFrom(event.target.value)} type="date" value={rangeFrom} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>To</label>
                        <input aria-label="Range end" className={styles.formInput} onChange={(event) => setRangeTo(event.target.value)} type="date" value={rangeTo} />
                      </div>
                    </div>
                  ) : null}

                  {generatedMode === "single-meal" ? (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Meal</label>
                      <input
                        aria-label="Search nearby meals"
                        className={styles.formInput}
                        onChange={(event) => setMealSearch(event.target.value)}
                        placeholder="Search nearby meals"
                        value={mealSearch}
                      />
                      <div className={styles.pickerGrid}>
                        {filteredMeals.map((meal) => (
                          <button
                            className={`${styles.pickerCard} ${selectedMealId === meal.id ? styles.pickerCardSelected : ""}`}
                            key={meal.id}
                            onClick={() => setSelectedMealId(meal.id)}
                            type="button"
                          >
                            <div className={styles.pickerTitle}>{meal.name}</div>
                            <div className={styles.pickerMeta}>
                              {meal.mealType} · {meal.date ? formatPrepDate(meal.date) : "Unscheduled"}
                            </div>
                          </button>
                        ))}
                      </div>
                      {selectedSingleMeal ? (
                        <div className={styles.warningCard}>
                          <div className={styles.warningTitle}>Selected Meal</div>
                          <div className={styles.warningText}>
                            {selectedSingleMeal.name} · {selectedSingleMeal.mealType} · {selectedSingleMeal.date ? formatPrepDate(selectedSingleMeal.date) : "Unscheduled"}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {generatedMode === "meal-slot" ? (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Meal slot</label>
                      <select aria-label="Meal slot" className={styles.formInput} onChange={(event) => setMealType(event.target.value)} value={mealType}>
                        <option value="BREAKFAST">Breakfast</option>
                        <option value="LUNCH">Lunch</option>
                        <option value="DINNER">Dinner</option>
                        <option value="SNACK">Snack</option>
                      </select>
                      <div className={styles.warningCard}>
                        <div className={styles.warningTitle}>Slot Preview</div>
                        <div className={styles.warningText}>
                          {slotPreviewMeals.length > 0
                            ? slotPreviewMeals.map((meal) => meal.name).join(", ")
                            : `No meals found in ${mealType} for ${rangeAnchor}`}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className={styles.formCheckboxRow}>
                      <input checked={includeIngredients} className={styles.formCheckbox} onChange={(event) => setIncludeIngredients(event.target.checked)} type="checkbox" />
                      Include ingredients
                    </label>
                    <label className={styles.formCheckboxRow}>
                      <input checked={includeTasks} className={styles.formCheckbox} onChange={(event) => setIncludeTasks(event.target.checked)} type="checkbox" />
                      Include prep tasks
                    </label>
                    <label className={styles.formCheckboxRow}>
                      <input checked={includeQuantities} className={styles.formCheckbox} onChange={(event) => setIncludeQuantities(event.target.checked)} type="checkbox" />
                      Include quantities
                    </label>
                    <label className={styles.formCheckboxRow}>
                      <input checked={includeTypes} className={styles.formCheckbox} onChange={(event) => setIncludeTypes(event.target.checked)} type="checkbox" />
                      Include type labels
                    </label>
                    <label className={styles.formCheckboxRow}>
                      <input checked={includeSourceLabels} className={styles.formCheckbox} onChange={(event) => setIncludeSourceLabels(event.target.checked)} type="checkbox" />
                      Include source dish labels
                    </label>
                    <label className={styles.formCheckboxRow}>
                      <input checked={excludePantryStaples} className={styles.formCheckbox} onChange={(event) => setExcludePantryStaples(event.target.checked)} type="checkbox" />
                      Exclude pantry staples
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className={styles.newListFooter}>
              <button className={styles.btnGhost} onClick={() => setShowModal(false)} type="button">
                Cancel
              </button>
              <button className={styles.btnShop} onClick={() => void submitNewList()} type="button">
                {draftMode === "manual" ? "Create List" : "Generate List"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showNotesModal && selectedList ? (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.notesModal}>
            <div className={styles.newListHeader}>
              <h3 className={styles.newListTitle}>Prep List Notes</h3>
              <button className={styles.modalCloseBtn} onClick={closeNotesModal} type="button">
                ✕
              </button>
            </div>
            <div className={styles.notesModalBody}>
              <div className={styles.notesModalMeta}>{selectedList.name}</div>
              <textarea
                aria-label="Prep list detailed notes"
                className={styles.notesModalInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setNotesDraft(nextValue);
                  scheduleListNotesSave(selectedList.id, nextValue);
                }}
                placeholder="Add detailed prep notes for this list..."
                rows={12}
                value={notesDraft}
              />
            </div>
            <div className={styles.newListFooter}>
              <button className={styles.btnCreate} onClick={closeNotesModal} type="button">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}