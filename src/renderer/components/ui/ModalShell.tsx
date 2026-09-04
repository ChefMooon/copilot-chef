import { X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import styles from "./ModalShell.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  hideFooter?: boolean;
  headerClassName?: string;
  headerStyle?: CSSProperties;
  ariaLabel?: string;
  closeLabel?: string;
  closeDisabled?: boolean;
  suspended?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
  overlayClassName?: string;
  bodyClassName?: string;
  width?: string;
};

export function ModalShell({
  open,
  onClose,
  children,
  title,
  eyebrow,
  subtitle,
  footerLeft,
  footerRight,
  hideFooter = false,
  headerClassName,
  headerStyle,
  ariaLabel,
  closeLabel = "Close dialog",
  closeDisabled = false,
  suspended = false,
  closeOnOverlayClick = true,
  className,
  overlayClassName,
  bodyClassName,
  width,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const suspendedRef = useRef(suspended);
  const titleId = useId();
  const descriptionId = useId();

  suspendedRef.current = suspended;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    if (!panel) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const initialTarget =
      panel.querySelector<HTMLElement>("[data-autofocus='true'], [autofocus]") ??
      getFocusable()[0] ??
      panel;
    initialTarget.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (suspendedRef.current) return;
      if (event.key === "Escape") {
        if (!closeDisabled) onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [closeDisabled, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const labelledBy = ariaLabel ? undefined : title ? titleId : undefined;
  const describedBy = subtitle ? descriptionId : undefined;

  return createPortal(
    <div
      className={[styles.overlay, overlayClassName].filter(Boolean).join(" ")}
      aria-hidden={suspended || undefined}
      inert={suspended ? true : undefined}
      onMouseDown={(event) => {
        if (
          closeOnOverlayClick &&
          !closeDisabled &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        aria-describedby={describedBy}
        aria-label={ariaLabel ?? (!title ? "Dialog" : undefined)}
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={[styles.panel, className].filter(Boolean).join(" ")}
        ref={panelRef}
        role="dialog"
        style={width ? { width } : undefined}
        tabIndex={-1}
      >
        <header
          className={[styles.header, headerClassName].filter(Boolean).join(" ")}
          style={headerStyle}
        >
          <div className={styles.heading}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            {title ? <h2 id={titleId} className={styles.title}>{title}</h2> : null}
            {subtitle ? <p id={descriptionId} className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          <button
            aria-label={closeLabel}
            className={styles.closeButton}
            disabled={closeDisabled}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={20} weight="regular" />
          </button>
        </header>
        <div className={[styles.body, bodyClassName].filter(Boolean).join(" ")}>{children}</div>
        {!hideFooter && (footerLeft || footerRight) ? (
          <footer className={styles.footer}>
            <div className={styles.footerLeft}>{footerLeft}</div>
            <div className={styles.footerRight}>{footerRight}</div>
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  );
}