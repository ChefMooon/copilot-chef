import { useState, type DragEvent } from "react";

import {
  createMealSlots,
  createEmptyMeal,
  isSameDay,
  type CalendarMealType,
  type EditableMeal,
  TYPE_CONFIG,
} from "@/lib/calendar";

import styles from "../meal-plan.module.css";

type DayViewProps = {
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

export function DayView({
  date,
  meals,
  setDate,
  onEdit,
  onMoveMeal,
  onSwapMeals,
}: DayViewProps) {
  const daySlots = createMealSlots(meals, date);
  const dayMeals = daySlots.flatMap((slot) => slot.meals);
  const [draggedMealId, setDraggedMealId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [isApplyingDrop, setIsApplyingDrop] = useState(false);

  const prev = () => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() - 1);
    setDate(nextDate);
  };

  const next = () => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    setDate(nextDate);
  };

  const today = new Date();
  const draggedMeal = dayMeals.find((meal) => meal.id === draggedMealId) ?? null;

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

  const moveMealToSlot = async (targetType: CalendarMealType) => {
    if (!draggedMeal || isApplyingDrop) {
      return;
    }

    setIsApplyingDrop(true);

    try {
      await onMoveMeal(draggedMeal, date, targetType);
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
    <div className={styles.dayView}>
      <div className={styles.dayNav}>
        <button className={styles.dayNavBtn} onClick={prev} type="button">
          {"<"}
        </button>
        <div className={styles.dayNavTitle}>
          <span className={styles.dayNavWeekday}>
            {date.toLocaleDateString("default", { weekday: "long" })}
          </span>
          <span className={styles.dayNavDate}>
            {date.toLocaleDateString("default", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {isSameDay(date, today) ? (
              <span className={styles.todayPill}>Today</span>
            ) : null}
          </span>
        </div>
        <button className={styles.dayNavBtn} onClick={next} type="button">
          {">"}
        </button>
      </div>

      <div className={styles.dayTimeline}>
        {daySlots.map(({ type, meals: slotMeals }, index) => {
          const typeConfig = TYPE_CONFIG[type];
          const emptyTargetKey = `day-slot-${type}`;

          return (
            <div className={styles.timelineSlot} key={type}>
              <div className={styles.timelineLabelCol}>
                <div
                  className={styles.timelineDot}
                  style={{ background: typeConfig.dot }}
                />
                {index < daySlots.length - 1 ? (
                  <div className={styles.timelineLine} />
                ) : null}
              </div>
              <div className={styles.timelineContent}>
                <div
                  className={styles.timelineTypeLabel}
                  style={{ color: typeConfig.text }}
                >
                  {typeConfig.label}
                </div>
                {slotMeals.length === 0 ? (
                  <div
                    className={`${styles.timelineEmptySlot} ${dropTargetKey === emptyTargetKey ? styles.slotDropTarget : ""}`}
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
                      await moveMealToSlot(type);
                    }}
                  >
                    {draggedMeal ? (
                      <span className={styles.slotDropHint}>Drop here</span>
                    ) : null}
                    {!draggedMeal && (
                      <button
                        className={styles.btnAddSlot}
                        onClick={() => onEdit(createEmptyMeal(new Date(date), type))}
                        type="button"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={styles.slotMealStack}>
                    {slotMeals.map((meal) => {
                      const mealTargetKey = `day-meal-${meal.id}`;

                      return (
                        <button
                          className={`${styles.timelineMealCard} ${draggedMealId === meal.id ? styles.mealCardDragging : ""} ${dropTargetKey === mealTargetKey ? styles.slotDropTarget : ""}`}
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
                          style={{ borderLeft: `3px solid ${typeConfig.dot}` }}
                          type="button"
                        >
                          <span className={styles.timelineMealName}>{meal.name}</span>
                          {meal.notes ? (
                            <span className={styles.timelineMealNotes}>
                              {meal.notes}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
