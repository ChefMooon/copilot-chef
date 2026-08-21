import { useMemo } from "react";

import {
  getMealTypeDefinitionsForDate,
  getMonday,
  getTypeConfig,
  isSameDay,
  normalizeMealDate,
  type EditableMeal,
} from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";
import { ModalShell } from "@/components/ui/ModalShell";

import styles from "./meal-plan.module.css";

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

  return (
    <ModalShell
      ariaLabel="Duplicate meal"
      className={`${styles.duplicatePanel} max-w-2xl`}
      closeLabel="Close duplicate meal dialog"
      onClose={onClose}
      open={isOpen}
      hideFooter
      eyebrow="Duplicate meal"
      title={meal.name}
    >

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

    </ModalShell>
  );
}