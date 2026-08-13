import { useState } from "react";
import { TrashSimple } from "@phosphor-icons/react";

import styles from "./meal-plan.module.css";

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
      aria-label="Drop meal to delete"
      tabIndex={-1}
    >
      <span aria-hidden="true" className={styles.trashZoneIcon}>
        <TrashSimple aria-hidden="true" size={24} weight="regular" />
      </span>
      <span className={styles.trashZoneLabel}>Drop meal to delete</span>
    </div>
  );
}
