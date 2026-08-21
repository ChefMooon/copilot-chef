import { useMemo, useState } from "react";

import { ModalShell } from "@/components/ui/ModalShell";
import styles from "./grocery-list.module.css";

type Props = {
  onClose: () => void;
  onCreate: (payload: { name: string; date: string | null }) => Promise<void>;
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
  const [isOngoing, setIsOngoing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const canCreate = name.trim().length > 0;

  return (
    <ModalShell
      open
      ariaLabel="Create grocery list"
      bodyClassName={`${styles.newListBody} flex-1 overflow-y-auto`}
      closeLabel="Close create grocery list dialog"
      closeDisabled={isCreating}
      onClose={onClose}
      title="New Grocery List"
      footerLeft={
        <button className={styles.btnGhost} disabled={isCreating} onClick={onClose} type="button">
          Cancel
        </button>
      }
      footerRight={
        <button
          className={styles.btnCreate}
          disabled={!canCreate || isCreating}
          onClick={async () => {
            if (!canCreate || isCreating) return;
            setIsCreating(true);
            try {
              await onCreate({ name: name.trim(), date: isOngoing ? null : date });
            } finally {
              setIsCreating(false);
            }
          }}
          type="button"
        >
          {isCreating ? "Creating..." : "Create List"}
        </button>
      }
    >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>List Name</label>
            <input
              autoFocus
              className={styles.formInput}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. This Week's Shop"
              value={name}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Date</label>
            <label className={styles.formCheckboxRow}>
              <input
                checked={isOngoing}
                className={styles.formCheckbox}
                onChange={(event) => setIsOngoing(event.target.checked)}
                type="checkbox"
              />
              Ongoing list (no date)
            </label>
            <input
              className={styles.formInput}
              disabled={isOngoing}
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
          </div>
    </ModalShell>
  );
}
