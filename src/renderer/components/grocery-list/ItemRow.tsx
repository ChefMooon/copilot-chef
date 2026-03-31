import { useState, type DragEvent } from "react";

import { CATEGORIES, UNITS, type GroceryItem } from "@/lib/grocery";

import styles from "./grocery-list.module.css";

type Props = {
  item: GroceryItem;
  index: number;
  total: number;
  dropPosition: "before" | "after" | null;
  onUpdate: (changes: Partial<GroceryItem>) => void;
  onDelete: () => void;
  onMove: (delta: -1 | 1) => void;
  onDragStartItem: (itemId: string) => void;
  onDragHoverItem: (itemId: string, position: "before" | "after") => void;
  onDropItem: (itemId: string, position: "before" | "after") => void;
  onDragEndItem: () => void;
};

export function ItemRow({
  item,
  index,
  total,
  dropPosition,
  onUpdate,
  onDelete,
  onMove,
  onDragStartItem,
  onDragHoverItem,
  onDropItem,
  onDragEndItem,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);

  const getDropPosition = (event: DragEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  };

  return (
    <div
      className={`${styles.itemRow} ${dragging ? styles.itemRowDragging : ""} ${dropPosition === "before" ? styles.itemRowDropBefore : ""} ${dropPosition === "after" ? styles.itemRowDropAfter : ""}`}
      draggable
      onDragEnd={() => {
        setDragging(false);
        onDragEndItem();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        onDragHoverItem(item.id, getDropPosition(event));
      }}
      onDragStart={() => {
        setDragging(true);
        onDragStartItem(item.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropItem(item.id, getDropPosition(event));
      }}
    >
      <div className={styles.itemRowMain}>
        <span className={styles.dragHandle} title="Drag to reorder">
          ⠿
        </span>
        <input
          checked={item.checked}
          className={styles.itemCheck}
          onChange={(event) => onUpdate({ checked: event.target.checked })}
          type="checkbox"
        />
        <input
          className={`${styles.itemNameInput} ${item.checked ? styles.itemDone : ""}`}
          onChange={(event) => onUpdate({ name: event.target.value })}
          placeholder="Item name..."
          value={item.name}
        />
        <div className={styles.itemQtyRow}>
          <input
            className={styles.itemQtyInput}
            min="0"
            onChange={(event) => onUpdate({ qty: event.target.value })}
            placeholder="Qty"
            type="text"
            value={item.qty ?? ""}
          />
          <select
            className={styles.itemUnitSelect}
            onChange={(event) => onUpdate({ unit: event.target.value })}
            value={item.unit ?? ""}
          >
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit || "-"}
              </option>
            ))}
          </select>
        </div>
        <select
          className={styles.itemCatSelect}
          onChange={(event) => onUpdate({ category: event.target.value })}
          value={item.category}
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <div className={styles.itemRowActions}>
          <button
            className={styles.iconBtn}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="Move up"
            type="button"
          >
            ↑
          </button>
          <button
            className={styles.iconBtn}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            title="Move down"
            type="button"
          >
            ↓
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => setExpanded((value) => !value)}
            title="More fields"
            type="button"
          >
            {expanded ? "▲" : "▼"}
          </button>
          <button
            className={`${styles.iconBtn} ${styles.itemDeleteBtn}`}
            onClick={onDelete}
            title="Remove"
            type="button"
          >
            ✕
          </button>
        </div>
      </div>
      {expanded ? (
        <div className={styles.itemRowExtra}>
          <div className={styles.itemExtraField}>
            <label className={styles.itemExtraLabel}>Notes / Brand</label>
            <input
              className={styles.itemExtraInput}
              onChange={(event) => onUpdate({ notes: event.target.value })}
              placeholder="e.g. Free-range, organic..."
              value={item.notes ?? ""}
            />
          </div>
          <div className={styles.itemExtraField}>
            <label className={styles.itemExtraLabel}>Linked Meal</label>
            <input
              className={styles.itemExtraInput}
              onChange={(event) => onUpdate({ meal: event.target.value })}
              placeholder="e.g. Roast Chicken"
              value={item.meal ?? ""}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
