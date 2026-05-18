import { useEffect, useLayoutEffect, useRef, useState } from "react";

import styles from "./meal-plan.module.css";

type DropIntentAction = "swap" | "insert";

type DropIntentPopoverProps = {
  isOpen: boolean;
  anchor: { x: number; y: number } | null;
  isApplying?: boolean;
  onSelect: (action: DropIntentAction) => void;
  onCancel: () => void;
};

export function DropIntentPopover({
  isOpen,
  anchor,
  isApplying = false,
  onSelect,
  onCancel,
}: DropIntentPopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );

  useLayoutEffect(() => {
    if (!isOpen || !anchor) {
      setPosition(null);
      return;
    }

    const reposition = () => {
      const panelRect = panelRef.current?.getBoundingClientRect();
      const panelWidth = panelRect?.width && panelRect.width > 0 ? panelRect.width : 280;
      const panelHeight = panelRect?.height && panelRect.height > 0 ? panelRect.height : 140;
      const spacing = 8;
      const viewportPadding = 12;

      const minLeft = viewportPadding;
      const maxLeft = Math.max(minLeft, window.innerWidth - panelWidth - viewportPadding);
      const minTop = viewportPadding;
      const maxTop = Math.max(minTop, window.innerHeight - panelHeight - viewportPadding);

      const nextLeft = Math.min(Math.max(anchor.x + spacing, minLeft), maxLeft);
      const nextTop = Math.min(Math.max(anchor.y + spacing, minTop), maxTop);

      setPosition({ left: nextLeft, top: nextTop });
    };

    reposition();
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("resize", reposition);
    };
  }, [anchor, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onWindowPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (panelRef.current?.contains(target)) {
        return;
      }

      onCancel();
    };

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("mousedown", onWindowPointerDown);
    window.addEventListener("keydown", onWindowKeyDown);

    return () => {
      window.removeEventListener("mousedown", onWindowPointerDown);
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen || !anchor) {
    return null;
  }

  return (
    <div
      className={styles.dropIntentPopover}
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Choose drop behavior"
      style={{
        left: position?.left ?? anchor.x,
        top: position?.top ?? anchor.y,
      }}
    >
      <p className={styles.dropIntentTitle}>Target slot already has meals</p>
      <div className={styles.dropIntentActions}>
        <button
          className={styles.dropIntentPrimaryBtn}
          disabled={isApplying}
          onClick={() => onSelect("insert")}
          type="button"
        >
          Insert here
        </button>
        <button
          className={styles.dropIntentGhostBtn}
          disabled={isApplying}
          onClick={() => onSelect("swap")}
          type="button"
        >
          Swap
        </button>
        <button
          className={styles.dropIntentGhostBtn}
          disabled={isApplying}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
