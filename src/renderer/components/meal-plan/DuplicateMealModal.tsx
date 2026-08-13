import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

import {
  getMealTypeDefinitionsForDate,
  getMonday,
  getTypeConfig,
  isSameDay,
  normalizeMealDate,
  type EditableMeal,
} from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";

import styles from "./meal-plan.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DuplicateTarget = {
  date: Date;
  mealType: string;
  mealTypeDefinitionId: string | null;
};

type DuplicateMealModalProps = {
  meal: EditableMeal;
  referenceDate: Date;
  mealTypeProfiles: MealTypeProfilePayload[];
  isOpen: boolean;
  isDuplicating?: boolean;
  error?: string | null;
  onClose: () => void;
  onDuplicate: (target: DuplicateTarget) => void;
};

export function DuplicateMealModal({
  meal,
  referenceDate,
  mealTypeProfiles,
  isOpen,
  isDuplicating = false,
  error,
  onClose,
  onDuplicate,
}: DuplicateMealModalProps) {
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
        onClose();
      }
    };

    window.addEventListener("keydown", keyHandler);

    return () => {
      window.removeEventListener("keydown", keyHandler);
    };
  }, [isOpen, onClose]);

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

  const duplicateTargets = useMemo(() => {
    const weekStart = getMonday(referenceDate);
    const sourceDate = normalizeMealDate(meal.date);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);

      const mealTypes = getMealTypeDefinitionsForDate(date, mealTypeProfiles);
      const sameType =
        mealTypes.find(
          (definition) => definition.slug === meal.type && definition.enabled
        ) ?? null;
      const fallbackType = mealTypes.find((definition) => definition.enabled) ?? null;
      const targetType = sameType ?? fallbackType;
      const isSourceDay = isSameDay(date, sourceDate);

      return {
        date,
        mealTypes,
        targetType,
        isSourceDay,
      };
    });
  }, [meal.date, meal.type, mealTypeProfiles, referenceDate]);

  const firstSelectableIndex = duplicateTargets.findIndex(
    (target) => !target.isSourceDay && target.targetType !== null
  );

  if (!isOpen || !portalRoot) {
    return null;
  }

  return createPortal(
    <div
      className={styles.duplicateOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      ref={overlayRef}
    >
      <div
        aria-labelledby="duplicate-meal-title"
        aria-modal="true"
        className={styles.duplicatePanel}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className={styles.duplicateHeader}>
          <div>
            <p className={styles.duplicateEyebrow}>Duplicate meal</p>
            <h2 className={styles.duplicateTitle} id="duplicate-meal-title">
              {meal.name}
            </h2>
          </div>
          <button
            aria-label="Close duplicate meal dialog"
            className={styles.modalClose}
            data-autofocus={firstSelectableIndex < 0 ? "true" : undefined}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} weight="regular" />
          </button>
        </div>

        <p className={styles.duplicateBody}>
          Choose a day in this week. The duplicate keeps the same meal details and
          defaults to the same meal type when that type exists for the target day.
        </p>

        {error ? <p className={styles.duplicateError}>{error}</p> : null}

        <div className={styles.duplicateGrid} role="list">
          {duplicateTargets.map(({ date, mealTypes, targetType, isSourceDay }, index) => {
            const typeConfig = targetType
              ? getTypeConfig(targetType.slug, mealTypes)
              : null;
            const dayLabel = date.toLocaleDateString("default", {
              weekday: "short",
            });
            const dateLabel = date.toLocaleDateString("default", {
              month: "short",
              day: "numeric",
            });
            const targetLabel = targetType
              ? `Duplicate as ${typeConfig?.label ?? targetType.name}`
              : "No meal types available";
            const buttonLabel = `${dayLabel}, ${dateLabel}${targetType ? `, ${targetLabel}` : ""}`;

            return (
              <button
                className={`${styles.duplicateDayCard} ${isSourceDay || !targetType ? styles.duplicateDayCardDisabled : ""}`}
                data-autofocus={index === firstSelectableIndex ? "true" : undefined}
                data-source-day={isSourceDay ? "true" : "false"}
                data-target-date={date.toISOString()}
                disabled={isDuplicating || isSourceDay || !targetType}
                key={date.toISOString()}
                onClick={() => {
                  if (!targetType) {
                    return;
                  }

                  onDuplicate({
                    date,
                    mealType: targetType.slug,
                    mealTypeDefinitionId: targetType.id,
                  });
                }}
                role="listitem"
                type="button"
                title={buttonLabel}
              >
                <span className={styles.duplicateDayTopRow}>
                  <span className={styles.duplicateDayLabel}>{dayLabel}</span>
                  {isSourceDay ? (
                    <span className={styles.duplicateDayBadge}>Source day</span>
                  ) : null}
                </span>
                <span className={styles.duplicateDayDate}>{dateLabel}</span>
                <span
                  className={styles.duplicateDayType}
                  style={
                    typeConfig
                      ? {
                          borderColor: typeConfig.dot,
                          color: typeConfig.text,
                        }
                      : undefined
                  }
                >
                  {targetLabel}
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.duplicateActions}>
          <button className={styles.btnGhost} onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>,
    portalRoot
  );
}