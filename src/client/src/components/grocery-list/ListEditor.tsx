import { useEffect, useRef, useState } from "react";

import {
  listProgress,
  type GroceryItem,
  type GroceryList,
  formatListDate,
} from "@/lib/grocery";

import { ItemRow } from "./ItemRow";
import styles from "./grocery-list.module.css";

type Props = {
  list: GroceryList;
  onUpdateList: (id: string, updates: Partial<GroceryList>) => Promise<void>;
  onDeleteList: (id: string) => Promise<void>;
  onCreateItem: (listId: string, payload: { name: string }) => Promise<void>;
  onUpdateItem: (
    listId: string,
    itemId: string,
    updates: Partial<GroceryItem>
  ) => Promise<void>;
  onDeleteItem: (listId: string, itemId: string) => Promise<void>;
  onReorder: (listId: string, itemIds: string[]) => Promise<void>;
  onShop: () => void;
};

export function ListEditor({
  list,
  onUpdateList,
  onDeleteList,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onReorder,
  onShop,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(list.name);
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(list.date.slice(0, 10));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverState, setDragOverState] = useState<{
    itemId: string;
    position: "before" | "after";
  } | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNameValue(list.name);
  }, [list.id, list.name]);

  useEffect(() => {
    setDateValue(list.date.slice(0, 10));
  }, [list.id, list.date]);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
    }
  }, [editingName]);

  const checkedCount = list.items.filter((item) => item.checked).length;
  const pct = listProgress(list.items);

  const saveName = async () => {
    if (nameValue.trim() && nameValue !== list.name) {
      await onUpdateList(list.id, { name: nameValue.trim() });
    }
    setEditingName(false);
  };

  const moveItem = async (index: number, delta: -1 | 1) => {
    const next = [...list.items];
    const target = index + delta;
    if (target < 0 || target >= next.length) {
      return;
    }

    [next[index], next[target]] = [next[target], next[index]];
    await onReorder(
      list.id,
      next.map((item) => item.id)
    );
  };

  const clearDragState = () => {
    setDraggedItemId(null);
    setDragOverState(null);
  };

  const dropItem = async (
    targetItemId: string,
    position: "before" | "after"
  ) => {
    if (!draggedItemId || draggedItemId === targetItemId) {
      clearDragState();
      return;
    }

    const draggedItem = list.items.find((item) => item.id === draggedItemId);
    if (!draggedItem) {
      clearDragState();
      return;
    }

    const remaining = list.items.filter((item) => item.id !== draggedItemId);
    const targetIndex = remaining.findIndex((item) => item.id === targetItemId);

    if (targetIndex === -1) {
      clearDragState();
      return;
    }

    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    const next = [...remaining];
    next.splice(insertIndex, 0, draggedItem);

    if (next.every((item, index) => item.id === list.items[index]?.id)) {
      clearDragState();
      return;
    }

    clearDragState();
    await onReorder(
      list.id,
      next.map((item) => item.id)
    );
  };

  return (
    <>
      <div className={styles.editorPanel}>
        <div className={styles.editorHeader}>
          <div className={styles.editorTitleRow}>
            {editingName ? (
              <input
                className={styles.editorNameInput}
                onBlur={() => {
                  void saveName();
                }}
                onChange={(event) => setNameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void saveName();
                  }
                  if (event.key === "Escape") {
                    setNameValue(list.name);
                    setEditingName(false);
                  }
                }}
                ref={nameInputRef}
                value={nameValue}
              />
            ) : (
              <h2
                className={styles.editorName}
                onClick={() => setEditingName(true)}
              >
                {list.name}
              </h2>
            )}
            <div className={styles.editorHeaderMeta}>
              <button
                className={styles.editorDateBtn}
                onClick={() => setEditingDate(true)}
                title="Change date"
                type="button"
              >
                📅 {formatListDate(list.date)}
              </button>
            </div>
          </div>
          <div className={styles.editorHeaderActions}>
            <button className={styles.btnShop} onClick={onShop} type="button">
              🛒 Shop
            </button>
            <button
              className={styles.btnTelegramDisabled}
              disabled
              title="Coming soon - send to Telegram"
              type="button"
            >
              ✈ Send to Telegram
            </button>
            <button
              className={styles.btnDeleteList}
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete list"
              type="button"
            >
              🗑
            </button>
          </div>
        </div>

        <div className={styles.editorProgress}>
          <div className={styles.progressBarBg}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={styles.progressLabel}>
            {checkedCount} of {list.items.length} collected · {pct}%
          </span>
        </div>

        <div className={styles.editorItems}>
          {list.items.map((item, index) => (
            <ItemRow
              dropPosition={
                dragOverState?.itemId === item.id
                  ? dragOverState.position
                  : null
              }
              index={index}
              item={item}
              key={item.id}
              onDelete={() => void onDeleteItem(list.id, item.id)}
              onDragEndItem={clearDragState}
              onDragHoverItem={(itemId, position) => {
                if (!draggedItemId || draggedItemId === itemId) {
                  setDragOverState(null);
                  return;
                }
                setDragOverState({ itemId, position });
              }}
              onDragStartItem={setDraggedItemId}
              onDropItem={(itemId, position) => void dropItem(itemId, position)}
              onMove={(delta) => void moveItem(index, delta)}
              onUpdate={(changes) =>
                void onUpdateItem(list.id, item.id, changes)
              }
              total={list.items.length}
            />
          ))}
        </div>

        <div className={styles.editorAddRow}>
          <input
            className={styles.editorAddInput}
            onChange={(event) => setNewItemName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && newItemName.trim()) {
                void onCreateItem(list.id, { name: newItemName.trim() });
                setNewItemName("");
              }
            }}
            placeholder="Add an item..."
            value={newItemName}
          />
          <button
            className={styles.btnAddItem}
            onClick={() => {
              if (!newItemName.trim()) {
                return;
              }
              void onCreateItem(list.id, { name: newItemName.trim() });
              setNewItemName("");
            }}
            type="button"
          >
            + Add
          </button>
        </div>
      </div>

      {editingDate && (
        <div
          className={styles.modalOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setEditingDate(false);
              setDateValue(list.date.slice(0, 10));
            }
          }}
          role="presentation"
        >
          <div className={styles.newListModal}>
            <div className={styles.newListHeader}>
              <h3 className={styles.newListTitle}>Change Date</h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => {
                  setEditingDate(false);
                  setDateValue(list.date.slice(0, 10));
                }}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className={styles.newListBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Date</label>
                <input
                  autoFocus
                  className={styles.formInput}
                  onChange={(event) => setDateValue(event.target.value)}
                  type="date"
                  value={dateValue}
                />
              </div>
            </div>
            <div className={styles.newListFooter}>
              <button
                className={styles.btnGhost}
                onClick={() => {
                  setEditingDate(false);
                  setDateValue(list.date.slice(0, 10));
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className={styles.btnCreate}
                onClick={() => {
                  if (dateValue) {
                    void onUpdateList(list.id, {
                      date: new Date(`${dateValue}T12:00:00`).toISOString(),
                    });
                  }
                  setEditingDate(false);
                }}
                type="button"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className={styles.modalOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowDeleteConfirm(false);
            }
          }}
          role="presentation"
        >
          <div className={styles.newListModal}>
            <div className={styles.newListHeader}>
              <h3 className={styles.newListTitle}>Delete List</h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setShowDeleteConfirm(false)}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className={styles.newListBody}>
              <p>
                Are you sure you want to delete <strong>{list.name}</strong>?
                This cannot be undone.
              </p>
            </div>
            <div className={styles.newListFooter}>
              <button
                className={styles.btnGhost}
                onClick={() => setShowDeleteConfirm(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={styles.btnCreate}
                onClick={() => {
                  void onDeleteList(list.id);
                  setShowDeleteConfirm(false);
                }}
                style={{ backgroundColor: "#dc2626" }}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
