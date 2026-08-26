import { useState, type CSSProperties, type DragEvent } from "react";
import { PencilSimple, DotsSixVertical } from "@phosphor-icons/react";

import {
  createMealSlots,
  createEmptyMeal,
  getMealPlanDragPayload,
  getMealTypeDefinitionsForDate,
  getMealTypeProfileContext,
  setMealPlanDragPayload,
  getTypeConfig,
  isSameDay,
  type CalendarMealType,
  type EditableMeal,
  type MealPlanDropAnchor,
  type MealPlanDropTarget,
  type MealPlanDragPayload,
} from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { PeriodNavigation } from "./PeriodNavigation";
import { isInsertAfterPointer, showSlotDragPreview } from "./dragPreview";
import styles from "./meal-plan.module.css";

type DayViewProps = {
  date: Date;
  meals: EditableMeal[];
  mealTypeProfiles: MealTypeProfilePayload[];
  highlightedProfileId?: string | null;
  dragDisabled?: boolean;
  setDate: (date: Date) => void;
  onEdit: (meal: EditableMeal) => void;
  onAddMeal?: (meal: EditableMeal) => void;
  onOpenSlotManager: (date: Date, type: CalendarMealType) => void;
  onDropPayload: (
    payload: MealPlanDragPayload,
    target: MealPlanDropTarget,
    anchor: MealPlanDropAnchor
  ) => Promise<void>;
};

export function DayView({
  date,
  meals,
  mealTypeProfiles,
  highlightedProfileId,
  dragDisabled = false,
  setDate,
  onEdit,
  onAddMeal = onEdit,
  onOpenSlotManager,
  onDropPayload,
}: DayViewProps) {
  const profileContext = getMealTypeProfileContext(date, mealTypeProfiles);
  const mealTypes = getMealTypeDefinitionsForDate(date, mealTypeProfiles);
  const daySlots = createMealSlots(meals, date, mealTypes);
  const [draggedPayload, setDraggedPayload] = useState<MealPlanDragPayload | null>(
    null
  );
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
  const draggedMealId = draggedPayload?.kind === "meal" ? draggedPayload.mealId : null;
  const draggedSlotMealIds =
    draggedPayload?.kind === "slot" ? new Set(draggedPayload.mealIds) : null;
  const isMuted =
    highlightedProfileId != null &&
    profileContext.profile.id !== highlightedProfileId;

  const clearDragState = () => {
    setDraggedPayload(null);
    setDropTargetKey(null);
    setIsApplyingDrop(false);
  };

  const scheduleClearDragState = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clearDragState();
      });
    });
  };

  const canHandleDragOver = (
    event: DragEvent<HTMLElement>,
    activePayload: MealPlanDragPayload | null
  ) => {
    if (isApplyingDrop) {
      return false;
    }

    if (activePayload) {
      return true;
    }

    const dragTypes = Array.from(event.dataTransfer.types ?? []);
    return (
      dragTypes.includes("application/x-local-recipe-book-meal-plan-drag") ||
      dragTypes.includes("text/plain")
    );
  };

  const onDragStartMeal = (
    event: DragEvent<HTMLButtonElement>,
    meal: EditableMeal
  ) => {
    if (!meal.id || isApplyingDrop || dragDisabled) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    setMealPlanDragPayload(event.dataTransfer, {
      kind: "meal",
      mealId: meal.id,
    });
    setDraggedPayload({
      kind: "meal",
      mealId: meal.id,
    });
  };

  const onDragStartSlot = (
    event: DragEvent<HTMLButtonElement>,
    slotMeals: EditableMeal[],
    slotType: CalendarMealType
  ) => {
    if (slotMeals.length < 2 || isApplyingDrop || dragDisabled) {
      event.preventDefault();
      return;
    }

    const mealIds = slotMeals
      .map((meal) => meal.id)
      .filter((mealId): mealId is string => Boolean(mealId));

    if (mealIds.length < 2) {
      event.preventDefault();
      return;
    }

    const payload: MealPlanDragPayload = {
      kind: "slot",
      slotDate: date.toISOString(),
      slotType,
      mealIds,
    };

    event.dataTransfer.effectAllowed = "move";
    setMealPlanDragPayload(event.dataTransfer, payload);
    setDraggedPayload(payload);

    const suffix = slotMeals.length > 3 ? ` +${slotMeals.length - 3} more` : "";
    showSlotDragPreview(event.dataTransfer, {
      title: `Dragging ${slotMeals.length} ${slotType} meals`,
      namesLine: slotMeals
        .slice(0, 3)
        .map((meal) => meal.name)
        .join(" • "),
      metaLine: `${date.toLocaleDateString()}${suffix}`,
    });
  };

  const applyDropTarget = async (
    payload: MealPlanDragPayload,
    target: MealPlanDropTarget,
    anchor: MealPlanDropAnchor
  ) => {
    if (isApplyingDrop) {
      return;
    }

    setIsApplyingDrop(true);

    try {
      await onDropPayload(payload, target, anchor);
    } finally {
      clearDragState();
    }
  };

  return (
    <div className={`${styles.dayView} ${isMuted ? styles.dayProfileMuted : ""}`}>
      <PeriodNavigation
        className={styles.dayNav}
        accentColor={profileContext.accentColor}
        nextLabel="Go to next day"
        onNext={next}
        onPrevious={prev}
        previousLabel="Go to previous day"
      >
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
      </PeriodNavigation>

      <div className={styles.dayTimeline}>
        {daySlots.map(({ type, meals: slotMeals }, index) => {
          const typeConfig = getTypeConfig(type, mealTypes);
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
                  draggedPayload ? (
                    <div
                      className={`${styles.timelineEmptySlot} ${dropTargetKey === emptyTargetKey ? styles.slotDropTarget : ""}`}
                      onDragLeave={() =>
                        setDropTargetKey((current) =>
                          current === emptyTargetKey ? null : current
                        )
                      }
                      onDragOver={(event) => {
                        const activePayload =
                          draggedPayload ?? getMealPlanDragPayload(event.dataTransfer);

                        if (!canHandleDragOver(event, activePayload)) {
                          return;
                        }

                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropTargetKey(emptyTargetKey);
                        if (activePayload) {
                          setDraggedPayload(activePayload);
                        }
                      }}
                      onDrop={async (event) => {
                        event.preventDefault();
                        const payload = getMealPlanDragPayload(event.dataTransfer);
                        if (!payload) {
                          return;
                        }

                        await applyDropTarget(
                          payload,
                          {
                            kind: "slot",
                            slotDate: date.toISOString(),
                            slotType: type,
                          },
                          { x: event.clientX, y: event.clientY }
                        );
                      }}
                    >
                      <span className={styles.slotDropHint}>Drop here</span>
                    </div>
                  ) : (
                    <button
                      className={`${styles.timelineEmptySlot} ${styles.emptySlotButton} ${dropTargetKey === emptyTargetKey ? styles.slotDropTarget : ""}`}
                      onClick={() =>
                        onAddMeal(
                          createEmptyMeal(
                            new Date(date),
                            type,
                            mealTypes.find((definition) => definition.slug === type) ?? null
                          )
                        )
                      }
                      onDragOver={(event) => {
                        const activePayload = getMealPlanDragPayload(event.dataTransfer);
                        if (!canHandleDragOver(event, activePayload)) {
                          return;
                        }

                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropTargetKey(emptyTargetKey);
                        if (activePayload) {
                          setDraggedPayload(activePayload);
                        }
                      }}
                      onDrop={async (event) => {
                        const payload = getMealPlanDragPayload(event.dataTransfer);
                        if (!payload) {
                          scheduleClearDragState();
                          return;
                        }

                        event.preventDefault();
                        await applyDropTarget(
                          payload,
                          {
                            kind: "slot",
                            slotDate: date.toISOString(),
                            slotType: type,
                          },
                          { x: event.clientX, y: event.clientY }
                        );
                      }}
                      type="button"
                    >
                      <span className={styles.btnAddSlot}>+ Add</span>
                    </button>
                  )
                ) : (
                  <div
                    className={`${styles.slotMealStack} ${dropTargetKey === emptyTargetKey ? styles.slotDropTarget : ""}`}
                    onDragLeave={() =>
                      setDropTargetKey((current) =>
                        current === emptyTargetKey ? null : current
                      )
                    }
                    onDragOver={(event) => {
                      const activePayload =
                        draggedPayload ?? getMealPlanDragPayload(event.dataTransfer);

                      if (!canHandleDragOver(event, activePayload)) {
                        return;
                      }

                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTargetKey(emptyTargetKey);
                      if (activePayload) {
                        setDraggedPayload(activePayload);
                      }
                    }}
                    onDrop={async (event) => {
                      event.preventDefault();
                      const payload = getMealPlanDragPayload(event.dataTransfer);
                      if (!payload) {
                        return;
                      }

                      await applyDropTarget(
                        payload,
                        {
                          kind: "slot",
                          slotDate: date.toISOString(),
                          slotType: type,
                        },
                        { x: event.clientX, y: event.clientY }
                      );
                    }}
                  >
                    {slotMeals.map((meal) => {
                      const mealTargetKey = `day-meal-${meal.id}`;

                      return (
                        <button
                          className={`${styles.timelineMealCard} ${draggedMealId === meal.id ? styles.mealCardDragging : ""} ${draggedSlotMealIds?.has(meal.id ?? "") ? styles.slotMealInDraggedGroup : ""} ${dropTargetKey === mealTargetKey ? styles.slotDropTarget : ""}`}
                          data-meal-plan-drag-source="calendar-meal"
                          draggable={!isApplyingDrop && !dragDisabled}
                          key={
                            meal.id ||
                            `${meal.type}-${meal.date.toISOString()}-${meal.name}`
                          }
                          onClick={() => onEdit(meal)}
                          onDragEnd={scheduleClearDragState}
                          onDragLeave={() =>
                            setDropTargetKey((current) =>
                              current === mealTargetKey ? null : current
                            )
                          }
                          onDragOver={(event) => {
                            const activePayload =
                              draggedPayload ?? getMealPlanDragPayload(event.dataTransfer);

                            if (!canHandleDragOver(event, activePayload)) {
                              return;
                            }

                            if (
                              activePayload?.kind === "meal" &&
                              activePayload.mealId === meal.id
                            ) {
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = "move";
                            setDropTargetKey(mealTargetKey);
                            if (activePayload) {
                              setDraggedPayload(activePayload);
                            }
                          }}
                          onDragStart={(event) => onDragStartMeal(event, meal)}
                          onDrop={async (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const insertAfter = isInsertAfterPointer(
                              event.clientY,
                              event.currentTarget.getBoundingClientRect()
                            );
                            const payload = getMealPlanDragPayload(event.dataTransfer);
                            if (!payload) {
                              scheduleClearDragState();
                              return;
                            }

                            await applyDropTarget(
                              payload,
                              {
                                kind: "meal",
                                mealId: meal.id,
                                insertAfter,
                              },
                              { x: event.clientX, y: event.clientY }
                            );
                          }}
                          style={{
                            "--meal-type-color": typeConfig.dot,
                          } as CSSProperties}
                          type="button"
                        >
                          <span className={styles.timelineMealName}>{meal.name}</span>
                          {meal.mealSubTypeDefinition ? (
                            <span
                              className={styles.timelineMealSubType}
                              style={{ color: meal.mealSubTypeDefinition.color }}
                            >
                              {meal.mealSubTypeDefinition.name}
                            </span>
                          ) : null}
                          {meal.notes ? (
                            <span className={styles.timelineMealNotes}>
                              {meal.notes}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    <div className={styles.slotActionsRow}>
                      <button
                        className={styles.slotAddMoreBtn}
                        disabled={Boolean(draggedPayload) || isApplyingDrop}
                        onClick={() =>
                          onAddMeal(
                            createEmptyMeal(
                              new Date(date),
                              type,
                              mealTypes.find((definition) => definition.slug === type) ?? null
                            )
                          )
                        }
                        type="button"
                      >
                        + Add
                      </button>
                      {slotMeals.length >= 2 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              aria-label={`Manage ${type} meals`}
                              className={styles.slotManageIconBtn}
                              disabled={Boolean(draggedPayload) || isApplyingDrop}
                              onClick={() => onOpenSlotManager(date, type)}
                              type="button"
                            >
                              <PencilSimple aria-hidden="true" className={styles.slotManageIcon} size={18} weight="regular" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Manage meals</TooltipContent>
                        </Tooltip>
                      ) : null}
                      {slotMeals.length >= 2 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              aria-label={`Drag ${type} slot`}
                              className={styles.slotDragHandleBtn}
                              draggable={!isApplyingDrop && !dragDisabled}
                              onDragEnd={scheduleClearDragState}
                              onDragStart={(event) => onDragStartSlot(event, slotMeals, type)}
                              type="button"
                            >
                              <DotsSixVertical aria-hidden="true" size={18} weight="regular" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Drag entire slot</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
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
