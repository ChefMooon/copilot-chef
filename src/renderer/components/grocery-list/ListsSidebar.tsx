import {
  formatListDate,
  isToday,
  listProgress,
  type GroceryList,
} from "@/lib/grocery";

import styles from "./grocery-list.module.css";

type Props = {
  lists: GroceryList[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleFav: (id: string, nextValue: boolean) => void;
};

export function ListsSidebar({
  lists,
  selectedId,
  onSelect,
  onToggleFav,
}: Props) {
  return (
    <div className={styles.listsSidebar}>
      <div className={styles.sidebarHeader}>
        <span className={styles.sidebarTitle}>All Lists</span>
        <span className={styles.sidebarCount}>{lists.length}</span>
      </div>
      {lists.map((list) => (
        <div
          className={`${styles.listRow} ${selectedId === list.id ? styles.listRowSelected : ""}`}
          key={list.id}
          onClick={() => onSelect(list.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(list.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className={styles.listRowInfo}>
            <div className={styles.listRowName}>{list.name}</div>
            <div className={styles.listRowMeta}>
              {isToday(list.date) ? "Today" : formatListDate(list.date)} ·{" "}
              {list.items.length} items
            </div>
          </div>
          <button
            className={`${styles.listRowFav} ${list.favourite ? styles.listRowFavOn : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFav(list.id, !list.favourite);
            }}
            type="button"
          >
            {list.favourite ? "⭐" : "☆"}
          </button>
          <span className={styles.listRowPct}>{listProgress(list.items)}%</span>
        </div>
      ))}
    </div>
  );
}
