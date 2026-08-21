import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/button";

import styles from "./meal-plan.module.css";

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
  onCancel,
}: DeleteConfirmationModalProps) {
  return (
    <ModalShell
      ariaLabel="Delete meal confirmation"
      className={styles.confirmationPanel}
      closeDisabled={isLoading}
      closeLabel="Close delete confirmation"
      onClose={onCancel}
      open={isOpen}
      title="Delete this meal?"
      footerRight={
        <>
          <Button disabled={isLoading} onClick={onCancel} type="button" variant="outline">
            Keep
          </Button>
          <Button
            autoFocus
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
            variant="danger"
          >
            {isLoading ? "Deleting..." : "Delete Meal"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className={styles.confirmationBody}>
          This will permanently remove
          <strong> {mealName || "this meal"}</strong> from your meal plan.
        </p>
        {error ? <p className={styles.confirmationError}>{error}</p> : null}
      </div>
    </ModalShell>
  );
}
