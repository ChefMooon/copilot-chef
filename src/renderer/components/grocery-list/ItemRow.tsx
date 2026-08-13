import { useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, CaretDown, CaretUp, DotsSixVertical, X } from "@phosphor-icons/react";

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
          <DotsSixVertical aria-hidden="true" size={18} />
        </span>
        <input
          aria-label={`Mark ${item.name} as collected`}
          checked={item.checked}
          className={styles.itemCheck}
          onChange={(event) => onUpdate({ checked: event.target.checked })}
          type="checkbox"
        />
        <input
          aria-label="Item name"
          className={`${styles.itemNameInput} ${item.checked ? styles.itemDone : ""}`}
          onChange={(event) => onUpdate({ name: event.target.value })}
          placeholder="Item name..."
          value={item.name}
        />
        <div className={styles.itemQtyRow}>
          <input
            aria-label={`Quantity for ${item.name}`}
            className={styles.itemQtyInput}
            min="0"
            onChange={(event) => onUpdate({ qty: event.target.value })}
            placeholder="Qty"
            type="text"
            value={item.qty ?? ""}
          />
          <select
            aria-label={`Unit for ${item.name}`}
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
          aria-label={`Category for ${item.name}`}
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
            aria-label="Move item up"
            className={styles.iconBtn}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="Move up"
            type="button"
          >
            <ArrowUp aria-hidden="true" size={18} />
          </button>
          <button
            aria-label="Move item down"
            className={styles.iconBtn}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            title="Move down"
            type="button"
          >
            <ArrowDown aria-hidden="true" size={18} />
          </button>
          <button
            aria-label={expanded ? "Hide more fields" : "Show more fields"}
            className={styles.iconBtn}
            onClick={() => setExpanded((value) => !value)}
            title="More fields"
            type="button"
          >
            {expanded ? <CaretUp aria-hidden="true" size={18} /> : <CaretDown aria-hidden="true" size={18} />}
          </button>
          <button
            aria-label={`Remove ${item.name}`}
            className={`${styles.iconBtn} ${styles.itemDeleteBtn}`}
            onClick={onDelete}
            title="Remove"
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
      {expanded ? (
        <div className={styles.itemRowExtra}>
          <div className={styles.itemExtraField}>
            <label className={styles.itemExtraLabel}>Notes / Brand</label>
            <input
              aria-label={`Notes for ${item.name}`}
              className={styles.itemExtraInput}
              onChange={(event) => onUpdate({ notes: event.target.value })}
              placeholder="e.g. Free-range, organic..."
              value={item.notes ?? ""}
            />
          </div>
          <div className={styles.itemExtraField}>
            <label className={styles.itemExtraLabel}>Linked Meal</label>
            <input
              aria-label={`Linked meal for ${item.name}`}
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
