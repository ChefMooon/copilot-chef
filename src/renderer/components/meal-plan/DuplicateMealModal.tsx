import { useEffect, useMemo, useState } from "react";

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
import { PeriodNavigation } from "./PeriodNavigation";

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

type DuplicateTargetDay = {
  date: Date;
  mealTypes: ReturnType<typeof getMealTypeDefinitionsForDate>;
  enabledMealTypes: ReturnType<typeof getMealTypeDefinitionsForDate>;
  isSourceDay: boolean;
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
  const [displayedWeekStart, setDisplayedWeekStart] = useState(() =>
    getMonday(referenceDate)
  );

  useEffect(() => {
    if (isOpen) {
      setDisplayedWeekStart(getMonday(referenceDate));
    }
  }, [isOpen, referenceDate]);

  const currentWeekStart = getMonday(new Date());
  const canNavigatePrevious =
    displayedWeekStart.getTime() > currentWeekStart.getTime();

  const changeDisplayedWeek = (offset: number) => {
    const nextWeekStart = new Date(displayedWeekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + offset);

    if (
      offset < 0 &&
      nextWeekStart.getTime() < currentWeekStart.getTime()
    ) {
      return;
    }

    setDisplayedWeekStart(nextWeekStart);
  };

  const duplicateTargets = useMemo(() => {
    const sourceDate = normalizeMealDate(meal.date);

    return Array.from({ length: 7 }, (_, index): DuplicateTargetDay => {
      const date = new Date(displayedWeekStart);
      date.setDate(date.getDate() + index);

      const mealTypes = getMealTypeDefinitionsForDate(date, mealTypeProfiles);
      const isSourceDay = isSameDay(date, sourceDate);

      return {
        date,
        mealTypes,
        enabledMealTypes: mealTypes.filter((definition) => definition.enabled),
        isSourceDay,
      };
    });
  }, [displayedWeekStart, meal.date, mealTypeProfiles]);

  const displayedWeekEnd = new Date(displayedWeekStart);
  displayedWeekEnd.setDate(displayedWeekEnd.getDate() + 6);
  const displayedWeekLabel = `${displayedWeekStart.toLocaleDateString("default", {
    month: "short",
    day: "numeric",
  })} - ${displayedWeekEnd.toLocaleDateString("default", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  const firstSelectableTarget = duplicateTargets
    .flatMap((target) =>
      target.enabledMealTypes.map((definition) => ({ target, definition }))
    )
    .find(({ target }) => !target.isSourceDay);

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
      closeDisabled={isDuplicating}
    >
      <p className={styles.duplicateBody}>
        Choose a day and meal type in this week. The duplicate keeps the same meal
        details for the selected target.
      </p>

      {error ? <p className={styles.duplicateError}>{error}</p> : null}

      <PeriodNavigation
        className={styles.duplicateWeekNav}
        nextLabel="Next week"
        onNext={() => changeDisplayedWeek(7)}
        onPrevious={() => changeDisplayedWeek(-7)}
        previousLabel="Previous week"
        showPrevious={canNavigatePrevious}
      >
        <span className={styles.weekNavLabel}>{displayedWeekLabel}</span>
      </PeriodNavigation>

      <div className={styles.duplicateGrid} role="list">
        {duplicateTargets.map(
          ({ date, enabledMealTypes, isSourceDay }) => {
            const dayLabel = date.toLocaleDateString("default", {
              weekday: "short",
            });
            const dateLabel = date.toLocaleDateString("default", {
              month: "short",
              day: "numeric",
            });
            const isUnavailable = enabledMealTypes.length === 0;

            return (
              <div
                className={`${styles.duplicateDayCard} ${isSourceDay || isUnavailable ? styles.duplicateDayCardDisabled : ""}`}
                data-source-day={isSourceDay ? "true" : "false"}
                data-target-date={date.toISOString()}
                key={date.toISOString()}
                role="listitem"
              >
                <div className={styles.duplicateDayTopRow}>
                  <span className={styles.duplicateDayLabel}>{dayLabel}</span>
                  {isSourceDay ? (
                    <span className={styles.duplicateDayBadge}>Source day</span>
                  ) : null}
                </div>
                <span className={styles.duplicateDayDate}>{dateLabel}</span>
                <div
                  aria-label={`${dayLabel}, ${dateLabel} meal types`}
                  className={styles.duplicateTypeOptions}
                  role="group"
                >
                  {enabledMealTypes.length > 0 ? (
                    enabledMealTypes.map((definition) => {
                      const typeConfig = getTypeConfig(definition.slug, [definition]);
                      const isSelectable = definition.enabled && !isSourceDay;
                      const buttonLabel = `${dayLabel}, ${dateLabel}, Duplicate as ${typeConfig.label}`;

                      return (
                        <button
                          aria-label={buttonLabel}
                          className={`${styles.duplicateDayType} ${!isSelectable ? styles.duplicateDayTypeDisabled : ""}`}
                          data-autofocus={
                            firstSelectableTarget?.target ===
                              duplicateTargets.find((target) => target.date === date) &&
                            firstSelectableTarget?.definition.id === definition.id
                              ? "true"
                              : undefined
                          }
                          data-meal-type-definition-id={definition.id}
                          data-source-day={isSourceDay ? "true" : "false"}
                          data-target-date={date.toISOString()}
                          disabled={isDuplicating || !isSelectable}
                          key={definition.id}
                          onClick={() => {
                            onDuplicate({
                              date,
                              mealType: definition.slug,
                              mealTypeDefinitionId: definition.id,
                            });
                          }}
                          title={buttonLabel}
                          type="button"
                        >
                          <span>{typeConfig.label}</span>
                        </button>
                      );
                    })
                  ) : (
                    <button
                      aria-label={`${dayLabel}, ${dateLabel}, No meal types available`}
                      className={`${styles.duplicateDayType} ${styles.duplicateDayTypeDisabled}`}
                      data-source-day={isSourceDay ? "true" : "false"}
                      data-target-date={date.toISOString()}
                      disabled
                      type="button"
                    >
                      No meal types available
                    </button>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

    </ModalShell>
  );
}