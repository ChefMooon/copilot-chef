import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/api";
import { isServerConfigReady } from "@/lib/config";
import { useServerConfig } from "@/lib/use-server-config";
import { groupPrepItems, sortPrepItems, type PrepItem, type PrepList } from "@/lib/prep-lists";

import styles from "../grocery-list/shop.module.css";

export default function PrepViewPage() {
  const config = useServerConfig();
  const apiReady = isServerConfigReady(config);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [showNotes, setShowNotes] = useState(false);

  const listQuery = useQuery({
    queryKey: ["prep-list", id],
    enabled: apiReady && Boolean(id),
    queryFn: () =>
      fetchJson<{ data: PrepList }>(`/api/prep-lists/${id}`).then((response) => response.data),
  });

  const list = listQuery.data;
  const items = useMemo(
    () => (list ? sortPrepItems(list.items, list.sortMode) : []),
    [list]
  );
  const groups = useMemo(
    () => (list ? groupPrepItems(items, list.groupBy) : []),
    [items, list]
  );

  const toggleItem = async (item: PrepItem) => {
    if (!list) {
      return;
    }

    await fetchJson<{ data: PrepList }>(`/api/prep-lists/${list.id}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ checked: !item.checked }),
    });
    await listQuery.refetch();
  };

  const markAllComplete = async () => {
    if (!list) {
      return;
    }

    await Promise.all(
      list.items
        .filter((item) => !item.checked)
        .map((item) =>
          fetchJson<{ data: PrepList }>(`/api/prep-lists/${list.id}/items/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify({ checked: true }),
          })
        )
    );
    await listQuery.refetch();
  };

  if (!list) {
    return (
      <div className={styles.overlay}>
        <div className={styles.body}>Loading prep view...</div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>🔪</span>
          <div>
            <div className={styles.listName}>{list.name}</div>
            <div className={styles.progressText}>
              {list.checkedCount} of {list.totalItems} finished · grouped by {list.groupBy}
            </div>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={() => navigate("/prep-lists")} type="button">
          ✕ Done
        </button>
      </div>
      <div className={styles.progressBarBg}>
        <div className={styles.progressBarFill} style={{ width: `${list.completionPercentage}%` }} />
      </div>
      <div className={styles.prepNotesBar}>
        <button
          className={styles.prepNotesToggle}
          onClick={() => setShowNotes((current) => !current)}
          type="button"
        >
          {showNotes ? "Hide Notes" : "View Notes"}
        </button>
      </div>
      {showNotes ? (
        <div className={styles.prepNotesPanel}>
          {list.notes ? list.notes : "No notes added for this prep list yet."}
        </div>
      ) : null}
      <div className={styles.body}>
        <div className={styles.backRow}>
          <button className={styles.backBtn} onClick={() => navigate("/prep-lists")} type="button">
            Back to Prep Lists
          </button>
          <button className={styles.completeBtn} onClick={() => void markAllComplete()} type="button">
            Mark All Complete
          </button>
        </div>

        {groups.map(([group, groupItems]) => (
          <div className={styles.category} key={group}>
            <div className={styles.categoryHeader}>{group}</div>
            {groupItems.map((item) => (
              <button
                className={`${styles.item} ${item.checked ? styles.itemDone : ""}`}
                key={item.id}
                onClick={() => void toggleItem(item)}
                type="button"
              >
                <div className={`${styles.checkCircle} ${item.checked ? styles.checkFilled : ""}`}>
                  {item.checked ? <span className={styles.checkmark}>✓</span> : null}
                </div>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.name}</span>
                  <div className={styles.itemMeta}>
                    {item.qty ? <span>{item.qty}{item.unit ? ` ${item.unit}` : ""}</span> : null}
                    {item.dish ? <span>· {item.dish}</span> : null}
                    {item.ingredientType ? <span>· {item.ingredientType}</span> : null}
                    {item.kind === "task" ? <span>· Task</span> : <span>· Ingredient</span>}
                  </div>
                </div>
                <div>{item.checked ? <span className={styles.statusDone}>Done</span> : <span className={styles.statusOpen}>Open</span>}</div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}