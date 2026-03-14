"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/api";
import {
  deriveGroceryList,
  groupByCategory,
  listProgress,
  updateGroceryListInCollection,
  type GroceryItem,
  type GroceryList,
} from "@/lib/grocery";

import styles from "./shop.module.css";

export default function GroceryShopPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;

  const listQuery = useQuery({
    queryKey: ["grocery-list", id],
    queryFn: () =>
      fetchJson<{ data: GroceryList }>(`/api/grocery-lists/${id}`).then(
        (response) => response.data
      ),
    enabled: Boolean(id),
  });

  const list = listQuery.data;
  const groups = useMemo(
    () => groupByCategory(list?.items ?? []),
    [list?.items]
  );
  const done = list?.items.filter((item) => item.checked).length ?? 0;
  const pct = list ? listProgress(list.items) : 0;

  const toggleItem = async (item: GroceryItem) => {
    if (!list) {
      return;
    }

    const previousList = queryClient.getQueryData<GroceryList>([
      "grocery-list",
      id,
    ]);
    const previousLists = queryClient.getQueryData<GroceryList[]>([
      "grocery-lists",
    ]);
    const applyToggle = (current: GroceryList) => ({
      ...current,
      items: current.items.map((entry) =>
        entry.id === item.id ? { ...entry, checked: !entry.checked } : entry
      ),
    });

    queryClient.setQueryData<GroceryList | undefined>(
      ["grocery-list", id],
      (current) => (current ? deriveGroceryList(applyToggle(current)) : current)
    );
    queryClient.setQueryData<GroceryList[] | undefined>(
      ["grocery-lists"],
      (current) =>
        current
          ? updateGroceryListInCollection(current, list.id, applyToggle)
          : current
    );

    try {
      const response = await fetchJson<{ data: GroceryList }>(
        `/api/grocery-lists/${list.id}/items/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ checked: !item.checked }),
        }
      );

      queryClient.setQueryData(["grocery-list", id], response.data);
      queryClient.setQueryData<GroceryList[] | undefined>(
        ["grocery-lists"],
        (current) =>
          current
            ? current.map((entry) =>
                entry.id === response.data.id ? response.data : entry
              )
            : current
      );
    } catch (error) {
      queryClient.setQueryData(["grocery-list", id], previousList);
      queryClient.setQueryData(["grocery-lists"], previousLists);
      throw error;
    }
  };

  if (!list) {
    return <div>Loading shopping view...</div>;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>🍳</span>
          <div>
            <div className={styles.listName}>{list.name}</div>
            <div className={styles.progressText}>
              {done} of {list.items.length} collected
            </div>
          </div>
        </div>
        <button
          className={styles.closeBtn}
          onClick={() => router.push("/grocery-list")}
          type="button"
        >
          ✕ Done
        </button>
      </div>
      <div className={styles.progressBarBg}>
        <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.body}>
        {groups.map(([category, items]) => (
          <div className={styles.category} key={category}>
            <div className={styles.categoryHeader}>{category}</div>
            {items.map((item) => (
              <button
                className={`${styles.item} ${item.checked ? styles.itemDone : ""}`}
                key={item.id}
                onClick={() => void toggleItem(item)}
                type="button"
              >
                <div
                  className={`${styles.checkCircle} ${item.checked ? styles.checkFilled : ""}`}
                >
                  {item.checked ? (
                    <span className={styles.checkmark}>✓</span>
                  ) : null}
                </div>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.name}</span>
                  <div className={styles.itemMeta}>
                    {item.qty ? (
                      <span>
                        {item.qty}
                        {item.unit ? ` ${item.unit}` : ""}
                      </span>
                    ) : null}
                    {item.notes ? (
                      <span className={styles.itemNotes}>· {item.notes}</span>
                    ) : null}
                    {item.meal ? (
                      <span className={styles.itemMeal}>for {item.meal}</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  {item.checked ? (
                    <span className={styles.statusDone}>Collected</span>
                  ) : (
                    <span className={styles.statusOpen}>Needed</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))}
        {list.items.length === 0 ? (
          <div className={styles.empty}>This list has no items yet.</div>
        ) : null}
      </div>
    </div>
  );
}
