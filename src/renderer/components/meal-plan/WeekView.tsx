import { Fragment, useMemo, useState, type DragEvent } from "react";

import {
  createEmptyMeal,
  createMealSlots,
  DAYS,
  getMonday,
  getMealTypeProfileContexts,
  getTypeConfig,
  mergeMealTypeDefinitions,
  type CalendarMealType,
  isSameDay,
  type EditableMeal,
} from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";

import styles from "./meal-plan.module.css";

type WeekViewProps = {
  date: Date;
  meals: EditableMeal[];
  mealTypeProfiles: MealTypeProfilePayload[];
  highlightedProfileId?: string | null;
  setDate: (date: Date) => void;
  onEdit: (meal: EditableMeal) => void;
  onMoveMeal: (
    meal: EditableMeal,
    targetDate: Date,
    targetType: CalendarMealType
  ) => Promise<void>;
  onSwapMeals: (
    draggedMeal: EditableMeal,
    targetMeal: EditableMeal
  ) => Promise<void>;
};

export function WeekView({
  date,
  meals,
  mealTypeProfiles,
  highlightedProfileId,
  setDate,
  onEdit,
  onMoveMeal,
  onSwapMeals,
}: WeekViewProps) {
  const weekStart = getMonday(date);
  const [draggedMealId, setDraggedMealId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [isApplyingDrop, setIsApplyingDrop] = useState(false);

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return day;
  });
  const dayProfileContexts = useMemo(
    () => getMealTypeProfileContexts(days, mealTypeProfiles),
    [days, mealTypeProfiles]
  );
  const slotsByDay = useMemo(
    () =>
      dayProfileContexts.map(({ mealTypes }, index) => {
        const day = days[index];
        return {
          day,
          mealTypes,
          slots: createMealSlots(meals, day, mealTypes),
        };
      }),
    [dayProfileContexts, days, meals]
  );

  const prevWeek = () => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() - 7);
    setDate(nextDate);
  };

  const nextWeek = () => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 7);
    setDate(nextDate);
  };

  const startLabel =
    days[0]?.toLocaleDateString("default", {
      month: "short",
      day: "numeric",
    }) ?? "";
  const endLabel =
    days[6]?.toLocaleDateString("default", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) ?? "";
  const today = new Date();
  const weekMeals = slotsByDay.flatMap(({ slots }) =>
    slots.flatMap((slot) => slot.meals)
  );
  const mergedMealTypes = useMemo(
    () => mergeMealTypeDefinitions(slotsByDay.map(({ mealTypes }) => mealTypes)),
    [slotsByDay]
  );
  const rowMealTypes = mergedMealTypes.map((definition) => definition.slug);
  const draggedMeal = weekMeals.find((meal) => meal.id === draggedMealId) ?? null;

  const clearDragState = () => {
    setDraggedMealId(null);
    setDropTargetKey(null);
    setIsApplyingDrop(false);
  };

  const onDragStartMeal = (
    event: DragEvent<HTMLButtonElement>,
    meal: EditableMeal
  ) => {
    if (!meal.id || isApplyingDrop) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", meal.id);
    setDraggedMealId(meal.id);
  };

  const moveMealToSlot = async (targetDay: Date, targetType: CalendarMealType) => {
    if (!draggedMeal || isApplyingDrop) {
      return;
    }

    setIsApplyingDrop(true);

    try {
      await onMoveMeal(draggedMeal, targetDay, targetType);
    } finally {
      clearDragState();
    }
  };

  const swapMeals = async (targetMeal: EditableMeal) => {
    if (!draggedMeal || draggedMeal.id === targetMeal.id || isApplyingDrop) {
      return;
    }

    setIsApplyingDrop(true);

    try {
      await onSwapMeals(draggedMeal, targetMeal);
    } finally {
      clearDragState();
    }
  };

  return (
    <div className={styles.weekView}>
      <div className={styles.weekNav}>
        <button className={styles.dayNavBtn} onClick={prevWeek} type="button">
          {"<"}
        </button>
        <span className={styles.weekNavLabel}>
          {startLabel} - {endLabel}
        </span>
        <button className={styles.dayNavBtn} onClick={nextWeek} type="button">
          {">"}
        </button>
      </div>
      <div className={styles.weekBoardScroller}>
        <div className={styles.weekBoard}>
          <div className={styles.weekBoardCorner}>Meal</div>
          {days.map((day, index) => {
            const todayMatch = isSameDay(day, today);
            const profileContext = dayProfileContexts[index];
            const isMuted =
              highlightedProfileId != null &&
              profileContext.profile.id !== highlightedProfileId;

            return (
              <div
                className={`${styles.weekDayHeader} ${todayMatch ? styles.weekDayHeaderToday : ""} ${profileContext.isProfileStart ? styles.weekDayHeaderProfileStart : ""} ${isMuted ? styles.weekProfileMuted : ""}`}
                key={`header-${day.toISOString()}`}
                style={{ boxShadow: `inset 0 3px 0 ${profileContext.accentColor}` }}
              >
                <span className={styles.weekColWeekday}>{DAYS[day.getDay()]}</span>
                <span
                  className={`${styles.weekColNum} ${todayMatch ? styles.weekColNumToday : ""}`}
                >
                  {day.getDate()}
                </span>
                <span
                  className={styles.weekProfileChip}
                  style={{ borderColor: profileContext.accentColor, color: profileContext.accentColor }}
                  title={profileContext.rangeLabel ?? profileContext.profile.description ?? undefined}
                >
                  {profileContext.profile.name}
                </span>
                {profileContext.isProfileStart ? (
                  <span className={styles.weekProfileTransition}>Profile starts</span>
                ) : null}
              </div>
            );
          })}

          {days.length > 0
            ? rowMealTypes.map((type) => {
                const typeConfig = getTypeConfig(type, mergedMealTypes);

                return (
                  <Fragment key={type}>
                    <div className={styles.weekTypeCell}>
                      <span
                        className={styles.weekTypeDot}
                        style={{ background: typeConfig.dot }}
                      />
                      <span
                        className={styles.weekTypeLabel}
                        style={{ color: typeConfig.text }}
                      >
                        {typeConfig.label}
                      </span>
                    </div>
                    {slotsByDay.map(({ day, mealTypes, slots }, index) => {
                      const todayMatch = isSameDay(day, today);
                      const slot = slots.find(
                        (currentSlot) => currentSlot.type === type
                      );
                      const slotMeals = slot?.meals ?? [];
                      const isConfiguredType = mealTypes.some(
                        (definition) => definition.slug === type
                      );
                      const isUnavailable = !isConfiguredType && slotMeals.length === 0;
                      const emptyTargetKey = `week-slot-${day.toISOString()}-${type}`;
                      const profileContext = dayProfileContexts[index];
                      const isMuted =
                        highlightedProfileId != null &&
                        profileContext.profile.id !== highlightedProfileId;

                      return (
                        <div
                          className={`${styles.weekSlotCell} ${todayMatch ? styles.weekSlotCellToday : ""} ${isUnavailable ? styles.weekSlotCellUnavailable : ""} ${isMuted ? styles.weekProfileMuted : ""}`}
                          key={`${day.toISOString()}-${type}`}
                        >
                          {isUnavailable ? (
                            <div className={styles.weekSlotUnavailable}>
                              <span className={styles.weekSlotUnavailableLabel}>Not in profile</span>
                              <span className={styles.weekSlotUnavailableProfile}>
                                {profileContext.profile.name}
                              </span>
                            </div>
                          ) : slotMeals.length === 0 ? (
                            draggedMeal ? (
                              <div
                                className={`${styles.weekSlotEmpty} ${dropTargetKey === emptyTargetKey ? styles.slotDropTarget : ""}`}
                                onDragLeave={() =>
                                  setDropTargetKey((current) =>
                                    current === emptyTargetKey ? null : current
                                  )
                                }
                                onDragOver={(event) => {
                                  if (!draggedMeal || isApplyingDrop) {
                                    return;
                                  }

                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = "move";
                                  setDropTargetKey(emptyTargetKey);
                                }}
                                onDrop={async (event) => {
                                  event.preventDefault();
                                  await moveMealToSlot(day, type);
                                }}
                              >
                                <span className={styles.slotDropHint}>Drop here</span>
                              </div>
                            ) : (
                              <button
                                className={`${styles.weekSlotEmpty} ${styles.emptySlotButton}`}
                                onClick={() =>
                                  onEdit(
                                    createEmptyMeal(
                                      new Date(day),
                                      type,
                                      mealTypes.find((definition) => definition.slug === type) ??
                                        null
                                    )
                                  )
                                }
                                type="button"
                              >
                                <span className={styles.btnAddSlot}>+ Add</span>
                              </button>
                            )
                          ) : (
                            <div className={styles.weekSlotStack}>
                              {slotMeals.map((meal) => {
                                const mealTargetKey = `week-meal-${meal.id}`;

                                return (
                                  <button
                                    className={`${styles.weekSlotMealCard} ${draggedMealId === meal.id ? styles.mealCardDragging : ""} ${dropTargetKey === mealTargetKey ? styles.slotDropTarget : ""}`}
                                    draggable={!isApplyingDrop}
                                    key={
                                      meal.id ||
                                      `${meal.type}-${meal.date.toISOString()}-${meal.name}`
                                    }
                                    onClick={() => onEdit(meal)}
                                    onDragEnd={clearDragState}
                                    onDragLeave={() =>
                                      setDropTargetKey((current) =>
                                        current === mealTargetKey ? null : current
                                      )
                                    }
                                    onDragOver={(event) => {
                                      if (!draggedMeal || draggedMeal.id === meal.id || isApplyingDrop) {
                                        return;
                                      }

                                      event.preventDefault();
                                      event.dataTransfer.dropEffect = "move";
                                      setDropTargetKey(mealTargetKey);
                                    }}
                                    onDragStart={(event) => onDragStartMeal(event, meal)}
                                    onDrop={async (event) => {
                                      event.preventDefault();
                                      await swapMeals(meal);
                                    }}
                                    style={{
                                      background: typeConfig.bg,
                                      borderLeft: `3px solid ${typeConfig.dot}`,
                                    }}
                                    type="button"
                                  >
                                    <span className={styles.weekChipName}>{meal.name}</span>
                                    {meal.notes ? (
                                      <span className={styles.weekMealNotes}>{meal.notes}</span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })
            : null}
        </div>
      </div>
    </div>
  );
}
