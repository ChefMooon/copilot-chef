import { useEffect, useMemo, useState } from "react";

import styles from "../grocery-list.module.css";

type Props = {
  onClose: () => void;
  onCreate: (payload: { name: string; date: string }) => Promise<void>;
};

export function NewListModal({ onClose, onCreate }: Props) {
  const defaultDate = useMemo(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);
  const [name, setName] = useState("");
  const [date, setDate] = useState(defaultDate);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.modalOverlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div className={styles.newListModal}>
        <div className={styles.newListHeader}>
          <h3 className={styles.newListTitle}>New Grocery List</h3>
          <button className={styles.modalCloseBtn} onClick={onClose} type="button">
            ✕
          </button>
        </div>
        <div className={styles.newListBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>List Name</label>
            <input autoFocus className={styles.formInput} onChange={(event) => setName(event.target.value)} placeholder="e.g. This Week's Shop" value={name} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Date</label>
            <input className={styles.formInput} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </div>
        </div>
        <div className={styles.newListFooter}>
          <button className={styles.btnGhost} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={styles.btnCreate}
            onClick={() => {
              if (!name.trim()) {
                return;
              }
              void onCreate({ name: name.trim(), date });
            }}
            type="button"
          >
            Create List
          </button>
        </div>
      </div>
    </div>
  );
}
