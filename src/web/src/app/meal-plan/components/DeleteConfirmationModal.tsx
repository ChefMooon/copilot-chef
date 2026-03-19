import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "../meal-plan.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!isOpen || !portalRoot) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, portalRoot]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", keyHandler);

    return () => {
      window.removeEventListener("keydown", keyHandler);
    };
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (!isOpen || !portalRoot) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const initialTarget =
      panel.querySelector<HTMLElement>("[data-autofocus='true']") ??
      getFocusable()[0] ??
      panel;
    initialTarget.focus();

    const tabHandler = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === panel) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", tabHandler);

    return () => {
      window.removeEventListener("keydown", tabHandler);
      previousFocus?.focus();
    };
  }, [isOpen, portalRoot]);

  if (!isOpen || !portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className={styles.confirmationOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
      ref={overlayRef}
    >
      <div
        className={styles.confirmationPanel}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        tabIndex={-1}
      >
        <h2 className={styles.confirmationTitle} id="delete-confirm-title">
          Delete this meal?
        </h2>
        <p className={styles.confirmationBody}>
          This will permanently remove
          <strong> {mealName || "this meal"}</strong> from your meal plan.
        </p>
        {error ? <p className={styles.confirmationError}>{error}</p> : null}
        <div className={styles.confirmationActions}>
          <button
            className={styles.btnGhost}
            onClick={onCancel}
            type="button"
            disabled={isLoading}
          >
            Keep
          </button>
          <button
            className={styles.btnDelete}
            data-autofocus="true"
            onClick={onConfirm}
            type="button"
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete Meal"}
          </button>
        </div>
      </div>
    </div>,
    portalRoot
  );
}
