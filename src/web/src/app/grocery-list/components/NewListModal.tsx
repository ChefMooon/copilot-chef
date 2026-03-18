import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "../grocery-list.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!portalRoot) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [portalRoot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!portalRoot) {
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
      panel.querySelector<HTMLElement>("[autofocus]") ?? getFocusable()[0] ?? panel;
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
  }, [portalRoot]);

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-2.5 backdrop-blur-[3px] sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      ref={overlayRef}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-cream-dark bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create grocery list"
        tabIndex={-1}
      >
        <div className={styles.newListHeader}>
          <h3 className={styles.newListTitle}>New Grocery List</h3>
          <button
            className={styles.modalCloseBtn}
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>
        <div className={`${styles.newListBody} flex-1 overflow-y-auto`}>
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
            <input
              className={styles.formInput}
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
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
    </div>,
    portalRoot
  );
}
