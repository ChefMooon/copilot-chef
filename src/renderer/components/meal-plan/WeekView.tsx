import { Fragment, useMemo, useState, type DragEvent } from "react";

import {
  createEmptyMeal,
  createMealSlots,
  DAYS,
  getMealPlanDragPayload,
  getMonday,
  getMealTypeProfileContexts,
  setMealPlanDragPayload,
  getTypeConfig,
  mergeMealTypeDefinitions,
  type CalendarMealType,
  isSameDay,
  type EditableMeal,
  type MealPlanDropAnchor,
  type MealPlanDropTarget,
  type MealPlanDragPayload,
} from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";

import styles from "./meal-plan.module.css";

type WeekViewProps = {
  date: Date;
  meals: EditableMeal[];
  mealTypeProfiles: MealTypeProfilePayload[];
  highlightedProfileId?: string | null;
  dragDisabled?: boolean;
  setDate: (date: Date) => void;
  onEdit: (meal: EditableMeal) => void;
  onOpenSlotManager: (date: Date, type: CalendarMealType) => void;
  onDropPayload: (
    payload: MealPlanDragPayload,
    target: MealPlanDropTarget,
    anchor: MealPlanDropAnchor
  ) => Promise<void>;
};

export function WeekView({
  date,
  meals,
  mealTypeProfiles,
  highlightedProfileId,
  dragDisabled = false,
  setDate,
  onEdit,
  onOpenSlotManager,
  onDropPayload,
}: WeekViewProps) {
  const weekStart = getMonday(date);
  const [draggedPayload, setDraggedPayload] = useState<MealPlanDragPayload | null>(
    null
  );
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
  const rowMealTypes = useMemo(() => {
    const types = Array.from(
      new Set(slotsByDay.flatMap(({ slots }) => slots.map((slot) => slot.type)))
    );

    return types.sort((left, right) => {
      const leftConfig = getTypeConfig(left, mergedMealTypes);
      const rightConfig = getTypeConfig(right, mergedMealTypes);

      return (
        leftConfig.sortOrder - rightConfig.sortOrder ||
        leftConfig.label.localeCompare(rightConfig.label)
      );
    });
  }, [mergedMealTypes, slotsByDay]);
  const draggedMealId = draggedPayload?.kind === "meal" ? draggedPayload.mealId : null;
  const draggedSlotMealIds =
    draggedPayload?.kind === "slot" ? new Set(draggedPayload.mealIds) : null;

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
    slotDay: Date,
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
      slotDate: slotDay.toISOString(),
      slotType,
      mealIds,
    };

    event.dataTransfer.effectAllowed = "move";
    setMealPlanDragPayload(event.dataTransfer, payload);
    setDraggedPayload(payload);

    const preview = document.createElement("div");
    preview.className = styles.slotDragPreview;

    const heading = document.createElement("div");
    heading.className = styles.slotDragPreviewTitle;
    heading.textContent = `Dragging ${slotMeals.length} ${slotType} meals`;

    const names = document.createElement("div");
    names.className = styles.slotDragPreviewList;
    names.textContent = slotMeals
      .slice(0, 3)
      .map((meal) => meal.name)
      .join(" • ");

    const suffix =
      slotMeals.length > 3 ? ` +${slotMeals.length - 3} more` : "";
    const meta = document.createElement("div");
    meta.className = styles.slotDragPreviewMeta;
    meta.textContent = `${slotDay.toLocaleDateString()}${suffix}`;

    preview.append(heading, names, meta);
    document.body.appendChild(preview);

    if (typeof event.dataTransfer.setDragImage === "function") {
      event.dataTransfer.setDragImage(preview, 24, 18);
    }

    requestAnimationFrame(() => {
      preview.remove();
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
                      const isUnavailable = !slot;
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
                            draggedPayload ? (
                              <div
                                className={`${styles.weekSlotEmpty} ${dropTargetKey === emptyTargetKey ? styles.slotDropTarget : ""}`}
                                onDragLeave={() =>
                                  setDropTargetKey((current) =>
                                    current === emptyTargetKey ? null : current
                                  )
                                }
                                onDragOver={(event) => {
                                  if (!draggedPayload || isApplyingDrop) {
                                    return;
                                  }

                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = "move";
                                  setDropTargetKey(emptyTargetKey);
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
                                      slotDate: day.toISOString(),
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
                            <div
                              className={`${styles.weekSlotStack} ${slotMeals.length === 1 ? styles.weekSlotStackSingle : ""} ${dropTargetKey === emptyTargetKey ? styles.slotDropTarget : ""}`}
                              onDragLeave={() =>
                                setDropTargetKey((current) =>
                                  current === emptyTargetKey ? null : current
                                )
                              }
                              onDragOver={(event) => {
                                if (!draggedPayload || isApplyingDrop) {
                                  return;
                                }

                                event.preventDefault();
                                event.dataTransfer.dropEffect = "move";
                                setDropTargetKey(emptyTargetKey);
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
                                    slotDate: day.toISOString(),
                                    slotType: type,
                                  },
                                  { x: event.clientX, y: event.clientY }
                                );
                              }}
                            >
                              {slotMeals.map((meal) => {
                                const mealTargetKey = `week-meal-${meal.id}`;

                                return (
                                  <button
                                    className={`${styles.weekSlotMealCard} ${draggedMealId === meal.id ? styles.mealCardDragging : ""} ${draggedSlotMealIds?.has(meal.id ?? "") ? styles.slotMealInDraggedGroup : ""} ${dropTargetKey === mealTargetKey ? styles.slotDropTarget : ""}`}
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
                                      if (!draggedPayload || isApplyingDrop) {
                                        return;
                                      }

                                      if (
                                        draggedPayload.kind === "meal" &&
                                        draggedPayload.mealId === meal.id
                                      ) {
                                        return;
                                      }

                                      event.preventDefault();
                                      event.stopPropagation();
                                      event.dataTransfer.dropEffect = "move";
                                      setDropTargetKey(mealTargetKey);
                                    }}
                                    onDragStart={(event) => onDragStartMeal(event, meal)}
                                    onDrop={async (event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      const rect = event.currentTarget.getBoundingClientRect();
                                      const insertAfter =
                                        event.clientY > rect.top + rect.height / 2;
                                      const payload = getMealPlanDragPayload(event.dataTransfer);
                                      if (!payload) {
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
                              <div className={styles.slotActionsRow}>
                                {slotMeals.length >= 2 ? (
                                  <button
                                    aria-label={`Add ${type} meal`}
                                    className={styles.slotAddIconBtn}
                                    disabled={Boolean(draggedPayload) || isApplyingDrop}
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
                                    title="Add meal"
                                    type="button"
                                  >
                                    +
                                  </button>
                                ) : (
                                  <button
                                    className={`${styles.slotAddMoreBtn} ${styles.emptySlotButton}`}
                                    disabled={Boolean(draggedPayload) || isApplyingDrop}
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
                                )}
                                {slotMeals.length >= 2 ? (
                                  <button
                                    aria-label={`Manage ${type} meals`}
                                    className={styles.slotManageIconBtn}
                                    disabled={Boolean(draggedPayload) || isApplyingDrop}
                                    onClick={() => onOpenSlotManager(day, type)}
                                    type="button"
                                  >
                                    <svg
                                      aria-hidden="true"
                                      className={styles.slotManageIcon}
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M15.07 4a0.49 0.49 0 0 0 -0.36 -0.15 0.5 0.5 0 0 0 -0.35 0.14L3.44 14.91a0.5 0.5 0 0 0 0 0.71l4.94 4.94a0.51 0.51 0 0 0 0.36 0.15 0.49 0.49 0 0 0 0.35 -0.15L20 9.65a0.51 0.51 0 0 0 0 -0.71Z"
                                        fill="currentColor"
                                      />
                                      <path
                                        d="M2.43 16.8a0.51 0.51 0 0 0 -0.84 0.24L0.08 23.31a0.49 0.49 0 0 0 0.14 0.47 0.51 0.51 0 0 0 0.47 0.14L7 22.41a0.49 0.49 0 0 0 0.36 -0.35 0.52 0.52 0 0 0 -0.12 -0.49Z"
                                        fill="currentColor"
                                      />
                                      <path
                                        d="M23.2 2.92 21.08 0.8a2.52 2.52 0 0 0 -3.54 0l-1.41 1.42a0.48 0.48 0 0 0 0 0.7l4.95 5a0.48 0.48 0 0 0 0.7 0l1.42 -1.47a2.5 2.5 0 0 0 0 -3.53Z"
                                        fill="currentColor"
                                      />
                                    </svg>
                                  </button>
                                ) : null}
                                {slotMeals.length >= 2 ? (
                                  <button
                                    aria-label={`Drag ${type} slot`}
                                    className={styles.slotDragHandleBtn}
                                    draggable={!isApplyingDrop && !dragDisabled}
                                    onDragEnd={scheduleClearDragState}
                                    onDragStart={(event) =>
                                      onDragStartSlot(event, slotMeals, day, type)
                                    }
                                    title="Drag entire slot"
                                    type="button"
                                  >
                                    <span aria-hidden="true" className={styles.slotDragHandleGlyph}>
                                      ::
                                    </span>
                                  </button>
                                ) : null}
                              </div>
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
