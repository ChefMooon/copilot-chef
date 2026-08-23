import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  DotsSixVertical,
  PencilSimple,
  Plus,
} from "@phosphor-icons/react";

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
import { isInsertAfterPointer, showMealDragPreview, showSlotDragPreview } from "./dragPreview";
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

type EdgeDirection = "previous" | "next";

type AutoScrollBand = "left" | "right" | "top" | "bottom";
type BandActivity = Record<AutoScrollBand, boolean>;

type WeekScrollState = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  canScrollTop: boolean;
  canScrollBottom: boolean;
  isOverflowingX: boolean;
  isOverflowingY: boolean;
};

const initialWeekScrollState: WeekScrollState = {
  canScrollLeft: false,
  canScrollRight: false,
  canScrollTop: false,
  canScrollBottom: false,
  isOverflowingX: false,
  isOverflowingY: false,
};

const noActiveBands: BandActivity = {
  left: false,
  right: false,
  top: false,
  bottom: false,
};

const AUTO_SCROLL_BANDS: AutoScrollBand[] = ["left", "right", "top", "bottom"];

const MEAL_PLAN_DRAG_MIME = "application/x-local-recipe-book-meal-plan-drag";

const WALL_PUSH_FLIP_DELAY_MS = 500;
const EDGE_SCROLL_BAND_PX = 72;
const EDGE_SCROLL_BAND_Y_PX = 64;
const EDGE_SCROLL_MIN_SPEED = 3;
const EDGE_SCROLL_MAX_SPEED = 14;

const WEEK_SCROLL_BAND_CLASS: Record<AutoScrollBand, string> = {
  left: styles.weekScrollBandLeft,
  right: styles.weekScrollBandRight,
  top: styles.weekScrollBandTop,
  bottom: styles.weekScrollBandBottom,
};

const WEEK_SCROLL_BAND_ICON: Record<AutoScrollBand, typeof ArrowLeft> = {
  left: ArrowLeft,
  right: ArrowRight,
  top: ArrowUp,
  bottom: ArrowDown,
};

const WEEK_SCROLL_FADE_CLASS: Record<AutoScrollBand, string> = {
  left: styles.weekScrollFadeLeft,
  right: styles.weekScrollFadeRight,
  top: styles.weekScrollFadeTop,
  bottom: styles.weekScrollFadeBottom,
};

const WEEK_SCROLL_CLIP_KEY: Record<AutoScrollBand, keyof WeekScrollState> = {
  left: "canScrollLeft",
  right: "canScrollRight",
  top: "canScrollTop",
  bottom: "canScrollBottom",
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
  const [dropInsertAfter, setDropInsertAfter] = useState<boolean | null>(null);
  const [isApplyingDrop, setIsApplyingDrop] = useState(false);
  const [edgeHoverDirection, setEdgeHoverDirection] =
    useState<EdgeDirection | null>(null);
  const [scrollState, setScrollState] =
    useState<WeekScrollState>(initialWeekScrollState);
  const [autoScrollBands, setAutoScrollBands] =
    useState<BandActivity>(noActiveBands);
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollStateRef = useRef<WeekScrollState>(initialWeekScrollState);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRafIdRef = useRef<number | null>(null);
  const isAutoScrollLoopActiveRef = useRef(false);
  const autoScrollFrameRef = useRef<() => void>(() => {});
  const bandActiveRef = useRef<BandActivity>(noActiveBands);
  const edgeNavigationTimersRef = useRef<Record<EdgeDirection, number | null>>({
    previous: null,
    next: null,
  });
  const edgeHoverDirectionRef = useRef<EdgeDirection | null>(null);
  const edgeNavigationLockedRef = useRef(false);

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

  const changeWeek = (offset: number) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + offset);

    setDate(nextDate);
    return true;
  };

  const nextWeek = () => {
    changeWeek(7);
  };

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

  const clearEdgeTimers = () => {
    for (const direction of ["previous", "next"] as const) {
      const timer = edgeNavigationTimersRef.current[direction];
      if (timer !== null) {
        window.clearTimeout(timer);
        edgeNavigationTimersRef.current[direction] = null;
      }
    }
  };

  const clearEdgeNavigationState = () => {
    clearEdgeTimers();
    edgeHoverDirectionRef.current = null;
    edgeNavigationLockedRef.current = false;
    setEdgeHoverDirection(null);
  };

  const setBandActivity = (next: BandActivity) => {
    const previous = bandActiveRef.current;
    if (
      previous.left === next.left &&
      previous.right === next.right &&
      previous.top === next.top &&
      previous.bottom === next.bottom
    ) {
      return;
    }

    bandActiveRef.current = next;
    setAutoScrollBands(next);
  };

  const stopAutoScrollLoop = () => {
    if (autoScrollRafIdRef.current !== null) {
      window.cancelAnimationFrame(autoScrollRafIdRef.current);
      autoScrollRafIdRef.current = null;
    }
    isAutoScrollLoopActiveRef.current = false;
    setBandActivity(noActiveBands);
  };

  const computeEdgeSpeed = (
    distanceToEdge: number,
    bandPx: number,
    sign: 1 | -1
  ) => {
    const ratio = Math.min(Math.max(1 - distanceToEdge / bandPx, 0), 1);
    return (
      sign *
      (EDGE_SCROLL_MIN_SPEED +
        (EDGE_SCROLL_MAX_SPEED - EDGE_SCROLL_MIN_SPEED) * ratio)
    );
  };

  const evaluateBandActivity = (): BandActivity => {
    const scroller = scrollerRef.current;
    const pointer = lastPointerRef.current;
    if (!scroller || !pointer) {
      return noActiveBands;
    }

    const rect = scroller.getBoundingClientRect();
    return {
      left:
        pointer.x >= rect.left && pointer.x < rect.left + EDGE_SCROLL_BAND_PX,
      right:
        pointer.x <= rect.right && pointer.x > rect.right - EDGE_SCROLL_BAND_PX,
      top: pointer.y >= rect.top && pointer.y < rect.top + EDGE_SCROLL_BAND_Y_PX,
      bottom:
        pointer.y <= rect.bottom && pointer.y > rect.bottom - EDGE_SCROLL_BAND_Y_PX,
    };
  };

  const runAutoScrollFrame = () => {
    autoScrollRafIdRef.current = null;
    const scroller = scrollerRef.current;
    const pointer = lastPointerRef.current;
    if (!scroller || !pointer || !isAutoScrollLoopActiveRef.current) {
      return;
    }

    const rect = scroller.getBoundingClientRect();
    let vx = 0;
    let vy = 0;
    if (pointer.x < rect.left + EDGE_SCROLL_BAND_PX) {
      vx = computeEdgeSpeed(pointer.x - rect.left, EDGE_SCROLL_BAND_PX, -1);
    } else if (pointer.x > rect.right - EDGE_SCROLL_BAND_PX) {
      vx = computeEdgeSpeed(rect.right - pointer.x, EDGE_SCROLL_BAND_PX, 1);
    }
    if (pointer.y < rect.top + EDGE_SCROLL_BAND_Y_PX) {
      vy = computeEdgeSpeed(pointer.y - rect.top, EDGE_SCROLL_BAND_Y_PX, -1);
    } else if (pointer.y > rect.bottom - EDGE_SCROLL_BAND_Y_PX) {
      vy = computeEdgeSpeed(rect.bottom - pointer.y, EDGE_SCROLL_BAND_Y_PX, 1);
    }

    const maxScrollLeft = Math.max(
      scroller.scrollWidth - scroller.clientWidth,
      0
    );
    const maxScrollTop = Math.max(
      scroller.scrollHeight - scroller.clientHeight,
      0
    );
    scroller.scrollLeft = Math.min(Math.max(scroller.scrollLeft + vx, 0), maxScrollLeft);
    scroller.scrollTop = Math.min(Math.max(scroller.scrollTop + vy, 0), maxScrollTop);

    const activity = evaluateBandActivity();
    setBandActivity(activity);

    const atWallLeft = activity.left && scroller.scrollLeft <= 0;
    const atWallRight = activity.right && scroller.scrollLeft >= maxScrollLeft;
    if (atWallLeft) {
      scheduleEdgeNavigation("previous");
    } else if (atWallRight) {
      scheduleEdgeNavigation("next");
    } else {
      clearEdgeNavigationState();
    }

    autoScrollRafIdRef.current = window.requestAnimationFrame(stepAutoScrollFrame);
  };

  const stepAutoScrollFrame = () => {
    autoScrollFrameRef.current();
  };

  autoScrollFrameRef.current = runAutoScrollFrame;

  const startAutoScrollLoop = () => {
    if (isAutoScrollLoopActiveRef.current) {
      return;
    }

    isAutoScrollLoopActiveRef.current = true;
    autoScrollRafIdRef.current = window.requestAnimationFrame(stepAutoScrollFrame);
  };

  const scheduleEdgeNavigation = (direction: EdgeDirection) => {
    if (edgeHoverDirectionRef.current !== direction) {
      clearEdgeTimers();
      edgeNavigationLockedRef.current = false;
      edgeHoverDirectionRef.current = direction;
      setEdgeHoverDirection(direction);
    } else if (edgeNavigationLockedRef.current) {
      return;
    }

    if (edgeNavigationTimersRef.current[direction] !== null) {
      return;
    }

    edgeNavigationTimersRef.current[direction] = window.setTimeout(() => {
      edgeNavigationTimersRef.current[direction] = null;

      if (edgeNavigationLockedRef.current) {
        return;
      }

      const offset = direction === "previous" ? -7 : 7;
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + offset);

      edgeNavigationLockedRef.current = true;
      setEdgeHoverDirection(direction);
      setDate(nextDate);
    }, WALL_PUSH_FLIP_DELAY_MS);
  };

  const updateScrollState = () => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const next: WeekScrollState = {
      canScrollLeft: scroller.scrollLeft > 0,
      canScrollRight:
        scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth - 1,
      canScrollTop: scroller.scrollTop > 0,
      canScrollBottom:
        scroller.scrollTop < scroller.scrollHeight - scroller.clientHeight - 1,
      isOverflowingX: scroller.scrollWidth > scroller.clientWidth + 1,
      isOverflowingY: scroller.scrollHeight > scroller.clientHeight + 1,
    };
    const previous = scrollStateRef.current;

    if (
      previous.canScrollLeft !== next.canScrollLeft ||
      previous.canScrollRight !== next.canScrollRight ||
      previous.canScrollTop !== next.canScrollTop ||
      previous.canScrollBottom !== next.canScrollBottom ||
      previous.isOverflowingX !== next.isOverflowingX ||
      previous.isOverflowingY !== next.isOverflowingY
    ) {
      scrollStateRef.current = next;
      setScrollState(next);
    }
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    updateScrollState();
    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollState);
    resizeObserver?.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [date]);

  useEffect(() => {
    return () => {
      clearEdgeTimers();
      if (autoScrollRafIdRef.current !== null) {
        window.cancelAnimationFrame(autoScrollRafIdRef.current);
        autoScrollRafIdRef.current = null;
      }
      isAutoScrollLoopActiveRef.current = false;
    };
  }, []);

  const clearDragState = () => {
    stopAutoScrollLoop();
    clearEdgeNavigationState();
    setDraggedPayload(null);
    setDropTargetKey(null);
    setDropInsertAfter(null);
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
      dragTypes.includes(MEAL_PLAN_DRAG_MIME) || dragTypes.includes("text/plain")
    );
  };

  const getActiveDropPayload = (event: DragEvent<HTMLElement>) =>
    getMealPlanDragPayload(event.dataTransfer) ?? draggedPayload;

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
    showMealDragPreview(event.dataTransfer, {
      name: meal.name,
      subTypeName: meal.mealSubTypeDefinition?.name ?? null,
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

    const suffix = slotMeals.length > 3 ? ` +${slotMeals.length - 3} more` : "";
    showSlotDragPreview(event.dataTransfer, {
      title: `Dragging ${slotMeals.length} ${slotType} meals`,
      namesLine: slotMeals
        .slice(0, 3)
        .map((meal) => meal.name)
        .join(" • "),
      metaLine: `${slotDay.toLocaleDateString()}${suffix}`,
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

    stopAutoScrollLoop();
    setIsApplyingDrop(true);

    try {
      await onDropPayload(payload, target, anchor);
    } finally {
      clearDragState();
    }
  };

  const handleDragTerminated = () => {
    stopAutoScrollLoop();
    clearEdgeNavigationState();
  };

  const onBoardDragOverCapture = (event: DragEvent<HTMLDivElement>) => {
    const transferPayload = getMealPlanDragPayload(event.dataTransfer);
    const dragTypes = Array.from(event.dataTransfer.types ?? []);
    const hasRecognizedDragType =
      dragTypes.includes(MEAL_PLAN_DRAG_MIME) || dragTypes.includes("text/plain");
    const activePayload =
      transferPayload ?? (hasRecognizedDragType ? draggedPayload : null);

    lastPointerRef.current = { x: event.clientX, y: event.clientY };

    if (!canHandleDragOver(event, activePayload)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (activePayload && draggedPayload === null) {
      setDraggedPayload(activePayload);
    }

    startAutoScrollLoop();
  };

  const onBoardDragLeaveCapture = (event: DragEvent<HTMLDivElement>) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && boardRef.current?.contains(relatedTarget)) {
      return;
    }

    stopAutoScrollLoop();
    clearEdgeNavigationState();
  };

  return (
    <div className={styles.weekView}>
      <PeriodNavigation
        accentColor={navigationProfileContext.accentColor}
        className={styles.weekNav}
        nextLabel="Go to next week"
        onNext={nextWeek}
        onPrevious={() => changeWeek(-7)}
        previousLabel="Go to previous week"
      >
        <span className={styles.weekNavLabel}>
          {startLabel} - {endLabel}
        </span>
      </PeriodNavigation>
      <div className={styles.weekBoardScrollerWrap}>
        <div className={styles.weekBoardScroller} ref={scrollerRef}>
        <div
          className={styles.weekBoard}
          onDragLeaveCapture={onBoardDragLeaveCapture}
          onDragOverCapture={onBoardDragOverCapture}
          onDragEndCapture={handleDragTerminated}
          onDropCapture={handleDragTerminated}
          ref={boardRef}
        >
          <div
            className={`${styles.weekBoardHeader} ${scrollState.canScrollBottom ? styles.weekShadowBottom : ""}`}
          >
            <div
              className={`${styles.weekBoardCorner} ${scrollState.canScrollRight ? styles.weekShadowRight : ""}`}
            >
              Meal
            </div>
            {days.map((day, index) => {
              const todayMatch = isSameDay(day, today);
              const profileContext = dayProfileContexts[index];
              const isMuted =
                highlightedProfileId != null &&
                profileContext.profile.id !== highlightedProfileId;

              return (
                <div
                  className={`${styles.weekDayHeader} ${todayMatch ? styles.weekDayHeaderToday : ""} ${profileContext.isProfileStart ? styles.weekDayHeaderProfileStart : ""} ${isMuted ? styles.weekProfileMuted : ""}`}
                  data-week-day-index={index}
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
          </div>

          {days.length > 0
            ? rowMealTypes.map((type) => {
                const typeConfig =
                  rowMealTypeConfigs.get(type) ?? getTypeConfig(type, mergedMealTypes);

                return (
                  <div
                    className={styles.weekBoardRow}
                    data-week-board-row={type}
                    key={type}
                  >
                    <div
                      className={`${styles.weekTypeCell} ${scrollState.canScrollRight ? styles.weekTypeCellShadowRight : ""}`}
                    >
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
                                onDragLeave={() => {
                                  setDropTargetKey((current) =>
                                    current === emptyTargetKey ? null : current
                                  );
                                  setDropInsertAfter(null);
                                }}
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
                                  const payload = getActiveDropPayload(event);
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
                                  const payload = getActiveDropPayload(event);
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
                                const payload = getActiveDropPayload(event);
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
                                    {dropTargetKey === mealTargetKey &&
                                    dropInsertAfter !== null ? (
                                      <div
                                        aria-hidden="true"
                                        className={`${styles.slotInsertCaret} ${dropInsertAfter ? styles.slotInsertCaretBottom : styles.slotInsertCaretTop}`}
                                        data-week-insert-caret={mealTargetKey}
                                      />
                                    ) : null}
                                    <button
                                      className={`${styles.weekSlotMealCard} ${hasSubType ? styles.weekSlotMealCardHasSubType : ""} ${hasNotes ? styles.weekSlotMealCardHasNotes : ""} ${isTitleOnly ? styles.weekSlotMealCardTitleOnly : ""} ${draggedMealId === meal.id ? styles.mealCardDragging : ""} ${draggedSlotMealIds?.has(meal.id ?? "") ? styles.slotMealInDraggedGroup : ""} ${dropTargetKey === mealTargetKey ? styles.slotDropTarget : ""}`}
                                      data-meal-id={meal.id}
                                      data-meal-plan-drag-source="calendar-meal"
                                      draggable={!isApplyingDrop && !dragDisabled}
                                      onClick={() => onEdit(meal)}
                                      onDragEnd={scheduleClearDragState}
                                      onDragLeave={() => {
                                        setDropTargetKey((current) =>
                                          current === mealTargetKey ? null : current
                                        );
                                        setDropInsertAfter(null);
                                      }}
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

                                        const insertAfter = isInsertAfterPointer(
                                          event.clientY,
                                          event.currentTarget.getBoundingClientRect()
                                        );

                                        event.preventDefault();
                                        event.stopPropagation();
                                        event.dataTransfer.dropEffect = "move";
                                        setDropTargetKey(mealTargetKey);
                                        setDropInsertAfter(insertAfter);
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
                                        const payload = getActiveDropPayload(event);
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
                  </div>
                );
              })
             : null}
        </div>
        </div>
        {AUTO_SCROLL_BANDS.map((band) => {
          const BandIcon = WEEK_SCROLL_BAND_ICON[band];
          const bandDirection =
            band === "left" ? "previous" : band === "right" ? "next" : null;
          const isFlipping =
            bandDirection !== null &&
            autoScrollBands[band] &&
            edgeHoverDirection === bandDirection;

          return (
            <div
              aria-hidden="true"
              className={`${styles.weekScrollBand} ${WEEK_SCROLL_BAND_CLASS[band]} ${autoScrollBands[band] ? styles.weekScrollBandActive : ""} ${isFlipping ? styles.weekScrollBandFlipping : ""}`}
              data-week-scroll-band={band}
              key={band}
            >
              {autoScrollBands[band] ? (
                <BandIcon
                  aria-hidden="true"
                  className={styles.weekScrollBandArrow}
                  size={24}
                  weight={isFlipping ? "fill" : "regular"}
                />
              ) : null}
            </div>
          );
        })}
        {AUTO_SCROLL_BANDS.map((band) => {
          const isClipped = scrollState[WEEK_SCROLL_CLIP_KEY[band]];
          const isEngaged = isClipped && autoScrollBands[band];

          return (
            <div
              aria-hidden="true"
              className={`${styles.weekScrollFade} ${WEEK_SCROLL_FADE_CLASS[band]} ${isClipped ? styles.weekScrollFadeVisible : ""} ${isEngaged ? styles.weekScrollFadeIntense : ""}`}
              data-week-scroll-fade={band}
              key={`fade-${band}`}
            />
          );
        })}
      </div>
    </div>
  );
}
