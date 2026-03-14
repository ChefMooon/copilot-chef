"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/api";
import { useChatPageContext } from "@/context/chat-context";
import {
  deriveGroceryList,
  isToday,
  isUpcoming,
  removeGroceryListFromCollection,
  upsertGroceryList,
  updateGroceryListInCollection,
  type GroceryItem,
  type GroceryList,
  type QuickFilter
} from "@/lib/grocery";

import styles from "./grocery-list.module.css";
import { ListEditor } from "./components/ListEditor";
import { ListsSidebar } from "./components/ListsSidebar";
import { NewListModal } from "./components/NewListModal";
import { QuickReference } from "./components/QuickReference";

export default function GroceryListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const listsQueryKey = ["grocery-lists"] as const;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("today");
  const [upcomingDays, setUpcomingDays] = useState(7);
  const [showNewModal, setShowNewModal] = useState(false);

  const listsQuery = useQuery({
    queryKey: ["grocery-lists"],
    queryFn: () => fetchJson<{ data: GroceryList[] }>("/api/grocery-lists").then((response) => response.data)
  });

  const lists = listsQuery.data ?? [];

  const selectedList = useMemo(() => {
    if (selectedId) {
      const found = lists.find((list) => list.id === selectedId);
      if (found) {
        return found;
      }
    }

    return lists[0] ?? null;
  }, [lists, selectedId]);

  const filteredQuick = useMemo(() => {
    if (activeFilter === "today") {
      return lists.filter((list) => isToday(list.date));
    }
    if (activeFilter === "upcoming") {
      return lists.filter((list) => isUpcoming(list.date, upcomingDays));
    }
    if (activeFilter === "fav") {
      return lists.filter((list) => list.favourite);
    }
    if (activeFilter === "recent") {
      return [...lists]
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .slice(0, 5);
    }
    return lists;
  }, [activeFilter, lists, upcomingDays]);

  const setListsCache = (updater: (current: GroceryList[]) => GroceryList[]) => {
    queryClient.setQueryData<GroceryList[]>(listsQueryKey, (current) => updater(current ?? []));
  };

  const setListCache = (listId: string, updater: (current: GroceryList) => GroceryList) => {
    queryClient.setQueryData<GroceryList | undefined>(["grocery-list", listId], (current) =>
      current ? deriveGroceryList(updater(current)) : current
    );
  };

  const syncList = (nextList: GroceryList, previousId?: string) => {
    if (previousId && previousId !== nextList.id) {
      setListsCache((current) => removeGroceryListFromCollection(current, previousId));
      queryClient.removeQueries({ queryKey: ["grocery-list", previousId], exact: true });
    }

    setListsCache((current) => upsertGroceryList(current, nextList));
    queryClient.setQueryData(["grocery-list", nextList.id], deriveGroceryList(nextList, nextList.updatedAt));
  };

  const rollbackListSnapshots = (
    previousLists: GroceryList[] | undefined,
    previousList: GroceryList | undefined,
    listId: string,
    clearList = false
  ) => {
    queryClient.setQueryData(listsQueryKey, previousLists);
    if (clearList) {
      queryClient.removeQueries({ queryKey: ["grocery-list", listId], exact: true });
    } else {
      queryClient.setQueryData(["grocery-list", listId], previousList);
    }
  };

  const patchList = async (id: string, payload: Partial<GroceryList>) => {
    const previousLists = queryClient.getQueryData<GroceryList[]>(listsQueryKey);
    const previousList = queryClient.getQueryData<GroceryList>(["grocery-list", id]);

    setListsCache((current) =>
      updateGroceryListInCollection(current, id, (list) => ({
        ...list,
        ...payload
      }))
    );
    setListCache(id, (list) => ({ ...list, ...payload }));

    try {
      const response = await fetchJson<{ data: GroceryList }>(`/api/grocery-lists/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      syncList(response.data);
    } catch (error) {
      rollbackListSnapshots(previousLists, previousList, id);
      throw error;
    }
  };

  const patchItem = async (listId: string, itemId: string, payload: Partial<GroceryItem>) => {
    const previousLists = queryClient.getQueryData<GroceryList[]>(listsQueryKey);
    const previousList = queryClient.getQueryData<GroceryList>(["grocery-list", listId]);

    const applyItemUpdate = (list: GroceryList) => ({
      ...list,
      items: list.items.map((item) => (item.id === itemId ? { ...item, ...payload } : item))
    });

    setListsCache((current) => updateGroceryListInCollection(current, listId, applyItemUpdate));
    setListCache(listId, applyItemUpdate);

    try {
      const response = await fetchJson<{ data: GroceryList }>(`/api/grocery-lists/${listId}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      syncList(response.data);
    } catch (error) {
      rollbackListSnapshots(previousLists, previousList, listId);
      throw error;
    }
  };

  useChatPageContext({
    page: "grocery-list",
    activeList: selectedList
      ? {
          id: selectedList.id,
          name: selectedList.name,
          items: selectedList.items.map((item) => ({
            id: item.id,
            name: item.name,
            qty: item.qty,
            unit: item.unit,
            category: item.category,
            checked: item.checked,
          })),
          totalItems: selectedList.totalItems,
          checkedCount: selectedList.checkedCount,
          completionPercentage: selectedList.completionPercentage,
        }
      : null,
    allLists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      itemCount: l.totalItems,
      checkedCount: l.checkedCount,
    })),
  });

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>Grocery List</div>
          <h1 className={styles.pageTitle}>Your Lists</h1>
          <p className={styles.pageSub}>{lists.length} list{lists.length === 1 ? "" : "s"} · select one to edit</p>
        </div>
        <button className={styles.btnNewList} onClick={() => setShowNewModal(true)} type="button">
          + New List
        </button>
      </div>

      <QuickReference
        activeFilter={activeFilter}
        lists={filteredQuick}
        onChangeUpcomingDays={setUpcomingDays}
        onSelectFilter={setActiveFilter}
        onSelectList={setSelectedId}
        onToggleFav={(id, nextValue) => void patchList(id, { favourite: nextValue })}
        selectedId={selectedList?.id ?? null}
        upcomingDays={upcomingDays}
      />

      <div className={styles.mainCols}>
        <ListsSidebar
          lists={lists}
          onSelect={setSelectedId}
          onToggleFav={(id, nextValue) => void patchList(id, { favourite: nextValue })}
          selectedId={selectedList?.id ?? null}
        />

        {selectedList ? (
          <ListEditor
            list={selectedList}
            onCreateItem={async (listId, payload) => {
              const previousLists = queryClient.getQueryData<GroceryList[]>(listsQueryKey);
              const previousList = queryClient.getQueryData<GroceryList>(["grocery-list", listId]);
              const tempItem: GroceryItem = {
                id: `temp-${Date.now()}`,
                name: payload.name,
                category: "Produce",
                unit: "",
                qty: "",
                notes: "",
                meal: "",
                checked: false,
                sortOrder: selectedList?.items.length ?? 0
              };
              const applyCreate = (list: GroceryList) => ({
                ...list,
                items: [...list.items, tempItem]
              });

              setListsCache((current) => updateGroceryListInCollection(current, listId, applyCreate));
              setListCache(listId, applyCreate);

              try {
                const response = await fetchJson<{ data: GroceryList }>(`/api/grocery-lists/${listId}/items`, {
                  method: "POST",
                  body: JSON.stringify({
                    ...payload,
                    category: "Produce",
                    unit: "",
                    qty: "",
                    notes: "",
                    meal: "",
                    checked: false
                  })
                });
                syncList(response.data);
              } catch (error) {
                rollbackListSnapshots(previousLists, previousList, listId);
                throw error;
              }
            }}
            onDeleteItem={async (listId, itemId) => {
              const previousLists = queryClient.getQueryData<GroceryList[]>(listsQueryKey);
              const previousList = queryClient.getQueryData<GroceryList>(["grocery-list", listId]);
              const applyDelete = (list: GroceryList) => ({
                ...list,
                items: list.items.filter((item) => item.id !== itemId)
              });

              setListsCache((current) => updateGroceryListInCollection(current, listId, applyDelete));
              setListCache(listId, applyDelete);

              try {
                const response = await fetchJson<{ data: GroceryList }>(`/api/grocery-lists/${listId}/items/${itemId}`, {
                  method: "DELETE"
                });
                syncList(response.data);
              } catch (error) {
                rollbackListSnapshots(previousLists, previousList, listId);
                throw error;
              }
            }}
            onDeleteList={async (id) => {
              const previousLists = queryClient.getQueryData<GroceryList[]>(listsQueryKey);
              const previousList = queryClient.getQueryData<GroceryList>(["grocery-list", id]);
              const remaining = removeGroceryListFromCollection(previousLists ?? [], id);

              setListsCache((current) => removeGroceryListFromCollection(current, id));
              queryClient.removeQueries({ queryKey: ["grocery-list", id], exact: true });
              if (selectedList?.id === id) {
                setSelectedId(remaining[0]?.id ?? null);
              }

              try {
                await fetchJson<{ data: { id: string } }>(`/api/grocery-lists/${id}`, {
                  method: "DELETE"
                });
              } catch (error) {
                rollbackListSnapshots(previousLists, previousList, id);
                throw error;
              }
            }}
            onReorder={async (listId, itemIds) => {
              const previousLists = queryClient.getQueryData<GroceryList[]>(listsQueryKey);
              const previousList = queryClient.getQueryData<GroceryList>(["grocery-list", listId]);
              const applyReorder = (list: GroceryList) => ({
                ...list,
                items: itemIds
                  .map((itemId, index) => {
                    const item = list.items.find((entry) => entry.id === itemId);
                    return item ? { ...item, sortOrder: index } : null;
                  })
                  .filter((item): item is GroceryItem => item !== null)
              });

              setListsCache((current) => updateGroceryListInCollection(current, listId, applyReorder));
              setListCache(listId, applyReorder);

              try {
                const response = await fetchJson<{ data: GroceryList }>(`/api/grocery-lists/${listId}/reorder`, {
                  method: "POST",
                  body: JSON.stringify({ itemIds })
                });
                syncList(response.data);
              } catch (error) {
                rollbackListSnapshots(previousLists, previousList, listId);
                throw error;
              }
            }}
            onShop={() => {
              router.push(`/grocery-list/shop/${selectedList.id}`);
            }}
            onUpdateItem={patchItem}
            onUpdateList={async (id, updates) => {
              await patchList(id, updates);
            }}
          />
        ) : (
          <div className={styles.editorPlaceholder}>
            <div className={styles.editorPlaceholderIcon}>🛒</div>
            <p className={styles.editorPlaceholderText}>Select a list to start editing.</p>
          </div>
        )}
      </div>

      {showNewModal ? (
        <NewListModal
          onClose={() => setShowNewModal(false)}
          onCreate={async ({ name, date }) => {
            const previousLists = queryClient.getQueryData<GroceryList[]>(listsQueryKey);
            const tempId = `temp-list-${Date.now()}`;
            const optimisticList = deriveGroceryList({
              id: tempId,
              name,
              date: new Date(`${date}T12:00:00`).toISOString(),
              favourite: false,
              mealPlanId: null,
              mealPlan: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              checkedCount: 0,
              totalItems: 0,
              completionPercentage: 0,
              items: []
            });

            setListsCache((current) => [...current, optimisticList]);
            queryClient.setQueryData(["grocery-list", tempId], optimisticList);
            setSelectedId(tempId);
            setShowNewModal(false);

            try {
              const response = await fetchJson<{ data: GroceryList }>("/api/grocery-lists", {
                method: "POST",
                body: JSON.stringify({ name, date: new Date(`${date}T12:00:00`).toISOString() })
              });
              syncList(response.data, tempId);
              setSelectedId(response.data.id);
            } catch (error) {
              queryClient.setQueryData(listsQueryKey, previousLists);
              queryClient.removeQueries({ queryKey: ["grocery-list", tempId], exact: true });
              setSelectedId(previousLists?.[0]?.id ?? null);
              throw error;
            }
          }}
        />
      ) : null}
    </>
  );
}
