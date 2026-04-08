import { Fragment, useMemo, useState, type DragEvent } from "react";

import {
  createEmptyMeal,
  createMealSlots,
  DAYS,
  getMonday,
  type CalendarMealType,
  isSameDay,
  type EditableMeal,
  TYPE_CONFIG,
} from "@/lib/calendar";

import styles from "./meal-plan.module.css";

type WeekViewProps = {
  date: Date;
  meals: EditableMeal[];
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
  const slotsByDay = useMemo(
    () =>
      days.map((day) => ({
        day,
        slots: createMealSlots(meals, day),
      })),
    [days, meals]
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
  const mealTypes = slotsByDay[0]?.slots.map((slot) => slot.type) ?? [];
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
          {days.map((day) => {
            const todayMatch = isSameDay(day, today);

            return (
              <div
                className={`${styles.weekDayHeader} ${todayMatch ? styles.weekDayHeaderToday : ""}`}
                key={`header-${day.toISOString()}`}
              >
                <span className={styles.weekColWeekday}>{DAYS[day.getDay()]}</span>
                <span
                  className={`${styles.weekColNum} ${todayMatch ? styles.weekColNumToday : ""}`}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}

          {days.length > 0
            ? mealTypes.map((type) => {
                const typeConfig = TYPE_CONFIG[type];

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
                    {slotsByDay.map(({ day, slots }) => {
                      const todayMatch = isSameDay(day, today);
                      const slot = slots.find(
                        (currentSlot) => currentSlot.type === type
                      );
                      const slotMeals = slot?.meals ?? [];
                      const emptyTargetKey = `week-slot-${day.toISOString()}-${type}`;

                      return (
                        <div
                          className={`${styles.weekSlotCell} ${todayMatch ? styles.weekSlotCellToday : ""}`}
                          key={`${day.toISOString()}-${type}`}
                        >
                          {slotMeals.length === 0 ? (
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
                                  onEdit(createEmptyMeal(new Date(day), type))
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
