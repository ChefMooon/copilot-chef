import { Fragment, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { Copy, DotsSixVertical, PencilSimple, Plus } from "@phosphor-icons/react";

import {
  createEmptyMeal,
  createMealSlots,
  DAYS,
  getMealPlanDragPayload,
  getMonday,
  getMealTypeProfileContext,
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
import type {
  MealTypeDefinitionPayload,
  MealTypeProfilePayload,
} from "@shared/types";

import { PeriodNavigation } from "./PeriodNavigation";
import styles from "./meal-plan.module.css";

type WeekViewProps = {
  date: Date;
  meals: EditableMeal[];
  mealTypeProfiles: MealTypeProfilePayload[];
  highlightedProfileId?: string | null;
  dragDisabled?: boolean;
  setDate: (date: Date) => void;
  onEdit: (meal: EditableMeal) => void;
  onAddMeal?: (meal: EditableMeal) => void;
  onDuplicateMeal: (meal: EditableMeal) => void;
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
  onAddMeal = onEdit,
  onDuplicateMeal,
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
  const navigationProfileContext = getMealTypeProfileContext(
    date,
    mealTypeProfiles
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
  const rowMealTypeConfigs = useMemo(() => {
    const activeDefinitions = new Map(
      navigationProfileContext.mealTypes.map((definition) => [
        definition.slug,
        definition,
      ])
    );
    const candidatesByType = new Map<
      string,
      Map<string, { definition: MealTypeDefinitionPayload; count: number }>
    >();

    for (const { mealTypes } of slotsByDay) {
      for (const definition of mealTypes) {
        const candidates = candidatesByType.get(definition.slug) ?? new Map();
        const candidate = candidates.get(definition.id);

        if (candidate) {
          candidate.count += 1;
        } else {
          candidates.set(definition.id, { definition, count: 1 });
        }

        candidatesByType.set(definition.slug, candidates);
      }
    }

    return new Map(
      rowMealTypes.map((type) => {
        const candidates = Array.from(candidatesByType.get(type)?.values() ?? []);
        const activeDefinition = activeDefinitions.get(type);
        const selected = candidates.sort((left, right) => {
          const leftIsActive = left.definition.id === activeDefinition?.id;
          const rightIsActive = right.definition.id === activeDefinition?.id;

          return (
            Number(rightIsActive) - Number(leftIsActive) ||
            right.count - left.count ||
            left.definition.sortOrder - right.definition.sortOrder ||
            left.definition.name.localeCompare(right.definition.name)
          );
        })[0]?.definition;

        return [
          type,
          selected
            ? getTypeConfig(type, [selected])
            : getTypeConfig(type, mergedMealTypes),
        ] as const;
      })
    );
  }, [mergedMealTypes, navigationProfileContext.mealTypes, rowMealTypes, slotsByDay]);
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
      <PeriodNavigation
        accentColor={navigationProfileContext.accentColor}
        className={styles.weekNav}
        nextLabel="Go to next week"
        onNext={nextWeek}
        onPrevious={prevWeek}
        previousLabel="Go to previous week"
      >
        <span className={styles.weekNavLabel}>
          {startLabel} - {endLabel}
        </span>
      </PeriodNavigation>
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
              >
                <span className={styles.weekColWeekday}>{DAYS[day.getDay()]}</span>
                <span
                  className={`${styles.weekColNum} ${todayMatch ? styles.weekColNumToday : ""}`}
                >
                  {day.getDate()}
                </span>
                <span
                  className={styles.weekProfileChip}
                  style={{
                    "--profile-accent": profileContext.accentColor,
                  } as CSSProperties}
                  title={profileContext.rangeLabel ?? profileContext.profile.description ?? undefined}
                >
                  {profileContext.profile.name}
                </span>
                <span
                  aria-hidden="true"
                  className={styles.weekDayHeaderAccent}
                  style={{ backgroundColor: profileContext.accentColor }}
                />
              </div>
            );
          })}

          {days.length > 0
            ? rowMealTypes.map((type) => {
                const typeConfig =
                  rowMealTypeConfigs.get(type) ?? getTypeConfig(type, mergedMealTypes);

                return (
                  <Fragment key={type}>
                    <div className={styles.weekTypeCell}>
                      <span
                        className={styles.weekTypeDot}
                        style={{ background: typeConfig.dot }}
                      />
                      <span
                        className={styles.weekTypeLabel}
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
                                className={`${styles.weekSlotEmpty} ${styles.emptySlotButton} ${dropTargetKey === emptyTargetKey ? styles.slotDropTarget : ""}`}
                                onClick={() =>
                                  onAddMeal(
                                    createEmptyMeal(
                                      new Date(day),
                                      type,
                                      mealTypes.find((definition) => definition.slug === type) ??
                                        null
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
                                      slotDate: day.toISOString(),
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
                              className={`${styles.weekSlotStack} ${slotMeals.length === 1 ? styles.weekSlotStackSingle : ""} ${dropTargetKey === emptyTargetKey ? styles.slotDropTarget : ""}`}
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
                                    slotDate: day.toISOString(),
                                    slotType: type,
                                  },
                                  { x: event.clientX, y: event.clientY }
                                );
                              }}
                            >
                              {slotMeals.map((meal) => {
                                const mealTargetKey = `week-meal-${meal.id}`;
                                const hasSubType = Boolean(meal.mealSubTypeDefinition);
                                const hasNotes = Boolean(meal.notes);
                                const isTitleOnly = !hasSubType && !hasNotes;

                                return (
                                  <div
                                    className={`${styles.weekMealCardShell} ${hasSubType ? styles.weekCardHasSubType : ""} ${hasNotes ? styles.weekCardHasNotes : ""} ${isTitleOnly ? styles.weekCardTitleOnly : ""}`}
                                    key={
                                      meal.id ||
                                      `${meal.type}-${meal.date.toISOString()}-${meal.name}`
                                    }
                                  >
                                    <button
                                      className={`${styles.weekSlotMealCard} ${hasSubType ? styles.weekSlotMealCardHasSubType : ""} ${hasNotes ? styles.weekSlotMealCardHasNotes : ""} ${isTitleOnly ? styles.weekSlotMealCardTitleOnly : ""} ${draggedMealId === meal.id ? styles.mealCardDragging : ""} ${draggedSlotMealIds?.has(meal.id ?? "") ? styles.slotMealInDraggedGroup : ""} ${dropTargetKey === mealTargetKey ? styles.slotDropTarget : ""}`}
                                      data-meal-plan-drag-source="calendar-meal"
                                      draggable={!isApplyingDrop && !dragDisabled}
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
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        const insertAfter =
                                          event.clientY > rect.top + rect.height / 2;
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
                                      <span className={styles.weekChipName}>{meal.name}</span>
                                      {meal.mealSubTypeDefinition ? (
                                        <span
                                          className={styles.weekMealSubType}
                                          style={{ color: meal.mealSubTypeDefinition.color }}
                                        >
                                          {meal.mealSubTypeDefinition.name}
                                        </span>
                                      ) : null}
                                      {meal.notes ? (
                                        <span className={styles.weekMealNotes}>{meal.notes}</span>
                                      ) : null}
                                    </button>

                                    <button
                                      aria-label={`Duplicate ${meal.name}`}
                                      className={styles.weekMealActionBtn}
                                      disabled={isApplyingDrop || dragDisabled}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onDuplicateMeal(meal);
                                      }}
                                      title="Duplicate meal"
                                      type="button"
                                    >
                                      <Copy
                                        aria-hidden="true"
                                        className={styles.weekMealActionIcon}
                                        size={18}
                                        weight="regular"
                                      />
                                    </button>
                                  </div>
                                );
                              })}
                              <div className={styles.slotActionsRow}>
                                {slotMeals.length >= 2 ? (
                                  <button
                                    aria-label={`Add ${type} meal`}
                                    className={styles.slotAddIconBtn}
                                    disabled={Boolean(draggedPayload) || isApplyingDrop}
                                    onClick={() =>
                                      onAddMeal(
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
                                    <Plus aria-hidden="true" size={18} weight="regular" />
                                  </button>
                                ) : (
                                  <button
                                    className={`${styles.slotAddMoreBtn} ${styles.emptySlotButton}`}
                                    disabled={Boolean(draggedPayload) || isApplyingDrop}
                                    onClick={() =>
                                      onAddMeal(
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
                                    <PencilSimple
                                      aria-hidden="true"
                                      className={styles.slotManageIcon}
                                      size={18}
                                      weight="regular"
                                    />
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
                                    <DotsSixVertical aria-hidden="true" size={18} weight="regular" />
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
