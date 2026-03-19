import { useState } from "react";

import styles from "../meal-plan.module.css";

type TrashDropZoneProps = {
  visible: boolean;
  onDropMeal: (mealId: string) => void;
};

export function TrashDropZone({ visible, onDropMeal }: TrashDropZoneProps) {
  const [isActive, setIsActive] = useState(false);

  return (
    <div
      aria-hidden={!visible}
      className={`${styles.trashZone} ${visible ? styles.trashZoneVisible : ""} ${
        isActive ? styles.trashZoneActive : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!visible) {
          return;
        }

        setIsActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }

        setIsActive(false);
      }}
      onDragOver={(event) => {
        if (!visible) {
          return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsActive(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsActive(false);

        if (!visible) {
          return;
        }

        const mealId = event.dataTransfer.getData("text/plain").trim();
        if (!mealId) {
          return;
        }

        onDropMeal(mealId);
      }}
      role="button"
      tabIndex={-1}
    >
      <span aria-hidden="true" className={styles.trashZoneIcon}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </span>
      <span className={styles.trashZoneLabel}>Drop meal to delete</span>
    </div>
  );
}
