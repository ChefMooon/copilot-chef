import { useEffect, useRef } from "react";

import styles from "../meal-plan.module.css";

type DeleteConfirmationModalProps = {
  mealName: string;
  isOpen: boolean;
  isLoading: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteConfirmationModal({
  mealName,
  isOpen,
  isLoading,
  error,
  onConfirm,
  onCancel
}: DeleteConfirmationModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    const clickHandler = (event: MouseEvent) => {
      if (event.target === overlayRef.current) {
        onCancel();
      }
    };

    window.addEventListener("keydown", keyHandler);
    overlayRef.current?.addEventListener("mousedown", clickHandler);

    return () => {
      window.removeEventListener("keydown", keyHandler);
      overlayRef.current?.removeEventListener("mousedown", clickHandler);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.confirmationOverlay} ref={overlayRef}>
      <div className={styles.confirmationPanel} role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
        <h2 className={styles.confirmationTitle} id="delete-confirm-title">
          Delete this meal?
        </h2>
        <p className={styles.confirmationBody}>
          This will permanently remove
          <strong> {mealName || "this meal"}</strong> from your meal plan.
        </p>
        {error ? <p className={styles.confirmationError}>{error}</p> : null}
        <div className={styles.confirmationActions}>
          <button className={styles.btnGhost} onClick={onCancel} type="button" disabled={isLoading}>
            Keep
          </button>
          <button className={styles.btnDelete} onClick={onConfirm} type="button" disabled={isLoading}>
            {isLoading ? "Deleting..." : "Delete Meal"}
          </button>
        </div>
      </div>
    </div>
  );
}
