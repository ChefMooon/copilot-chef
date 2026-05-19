import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";

import {
  buildMonthCellAriaLabel,
  createEmptyMeal,
  createMealSlots,
  formatMealTypeProfileRange,
  getMealTypeProfileContext,
  getMealTypeOrder,
  getTypeConfig,
  isSameDay,
  mealsForDay,
  MONTHS,
  type EditableMeal,
} from "@/lib/calendar";
import type { MealTypeProfilePayload } from "@shared/types";

import styles from "./meal-plan.module.css";

type MonthViewProps = {
  date: Date;
  meals: EditableMeal[];
  mealTypeProfiles: MealTypeProfilePayload[];
  highlightedProfileId?: string | null;
  setDate: (date: Date) => void;
  onRequestDayView?: () => void;
  onRequestWeekView?: () => void;
  onEdit: (meal: EditableMeal) => void;
};

type PopoverState = {
  date: Date;
  anchor: {
    left: number;
    top: number;
    bottom: number;
  };
};

const POPOVER_VIEWPORT_PADDING = 12;
const POPOVER_TRIGGER_SPACING = 8;
const POPOVER_FALLBACK_WIDTH = 240;
const POPOVER_FALLBACK_HEIGHT = 320;

export function MonthView({
  date,
  meals,
  mealTypeProfiles,
  highlightedProfileId,
  setDate,
  onRequestDayView,
  onRequestWeekView,
  onEdit,
}: MonthViewProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const prevMonth = () => {
    const nextDate = new Date(date);
    nextDate.setDate(1);
    nextDate.setMonth(nextDate.getMonth() - 1);
    setDate(nextDate);
  };

  const nextMonth = () => {
    const nextDate = new Date(date);
    nextDate.setDate(1);
    nextDate.setMonth(nextDate.getMonth() + 1);
    setDate(nextDate);
  };

  const handleDayClick = (event: MouseEvent<HTMLButtonElement>, day: Date) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPopover({
      date: day,
      anchor: {
        left: rect.left,
        top: rect.top,
        bottom: rect.bottom,
      },
    });
  };

  useLayoutEffect(() => {
    if (!popover) {
      setPopoverPosition(null);
      return;
    }

    const reposition = () => {
      const panelRect = popoverRef.current?.getBoundingClientRect();
      const panelWidth =
        panelRect?.width && panelRect.width > 0
          ? panelRect.width
          : POPOVER_FALLBACK_WIDTH;
      const panelHeight =
        panelRect?.height && panelRect.height > 0
          ? panelRect.height
          : POPOVER_FALLBACK_HEIGHT;

      const minLeft = POPOVER_VIEWPORT_PADDING;
      const maxLeft = Math.max(
        minLeft,
        window.innerWidth - panelWidth - POPOVER_VIEWPORT_PADDING
      );
      const minTop = POPOVER_VIEWPORT_PADDING;
      const maxTop = Math.max(
        minTop,
        window.innerHeight - panelHeight - POPOVER_VIEWPORT_PADDING
      );

      const belowTop = popover.anchor.bottom + POPOVER_TRIGGER_SPACING;
      const aboveTop = popover.anchor.top - panelHeight - POPOVER_TRIGGER_SPACING;

      const canFitBelow = belowTop <= maxTop;
      const canFitAbove = aboveTop >= minTop;

      let preferredTop = belowTop;

      if (!canFitBelow && canFitAbove) {
        preferredTop = aboveTop;
      } else if (!canFitBelow && !canFitAbove) {
        const belowOverflow = belowTop - maxTop;
        const aboveOverflow = minTop - aboveTop;
        preferredTop = belowOverflow <= aboveOverflow ? belowTop : aboveTop;
      }

      const nextLeft = Math.min(Math.max(popover.anchor.left, minLeft), maxLeft);
      const nextTop = Math.min(Math.max(preferredTop, minTop), maxTop);

      setPopoverPosition({ left: nextLeft, top: nextTop });
    };

    reposition();
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("resize", reposition);
    };
  }, [popover]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPopover(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const today = new Date();
  const popoverMealTypes = popover
    ? getMealTypeProfileContext(popover.date, mealTypeProfiles).mealTypes
    : [];
  const popoverProfileContext = popover
    ? getMealTypeProfileContext(popover.date, mealTypeProfiles)
    : null;
  const popoverMeals = popover ? mealsForDay(meals, popover.date, popoverMealTypes) : [];
  const popoverSlots = popover
    ? createMealSlots(meals, popover.date, popoverMealTypes)
    : [];

  const openDayViewFromPopover = () => {
    if (!popover) {
      return;
    }

    setDate(new Date(popover.date));
    onRequestDayView?.();
    setPopover(null);
  };

  const openWeekViewFromPopover = () => {
    if (!popover) {
      return;
    }

    setDate(new Date(popover.date));
    onRequestWeekView?.();
    setPopover(null);
  };

  return (
    <div className={styles.monthView}>
      <div className={styles.monthNav}>
        <button className={styles.dayNavBtn} onClick={prevMonth} type="button">
          {"<"}
        </button>
        <span className={styles.monthNavLabel}>
          {MONTHS[month]} {year}
        </span>
        <button className={styles.dayNavBtn} onClick={nextMonth} type="button">
          {">"}
        </button>
      </div>

      <div className={styles.monthGrid}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div className={styles.monthDayHeader} key={day}>
            {day}
          </div>
        ))}

        {Array.from({ length: totalCells }, (_, index) => {
          const dayNum = index - startOffset + 1;

          if (dayNum < 1 || dayNum > daysInMonth) {
            return (
              <div
                className={`${styles.monthCell} ${styles.monthCellEmpty}`}
                key={index}
              />
            );
          }

          const cellDate = new Date(year, month, dayNum);
          const profileContext = getMealTypeProfileContext(cellDate, mealTypeProfiles);
          const mealTypes = profileContext.mealTypes;
          const cellMeals = mealsForDay(meals, cellDate, mealTypes);
          const todayMatch = isSameDay(cellDate, today);
          const isMuted =
            highlightedProfileId != null &&
            profileContext.profile.id !== highlightedProfileId;

          return (
            <button
              aria-label={buildMonthCellAriaLabel(cellDate, profileContext, cellMeals)}
              className={`${styles.monthCell} ${todayMatch ? styles.monthCellToday : ""} ${styles.monthCellInteractive} ${cellMeals.length ? styles.monthCellHasMeals : ""} ${profileContext.isProfileStart ? styles.monthCellProfileStart : ""} ${isMuted ? styles.monthProfileMuted : ""}`}
              key={index}
              onClick={(event) => handleDayClick(event, cellDate)}
              style={{ boxShadow: `inset 0 3px 0 ${profileContext.accentColor}` }}
              type="button"
            >
              <span
                className={`${styles.monthCellNum} ${todayMatch ? styles.monthCellNumToday : ""}`}
              >
                {dayNum}
              </span>
              <span
                className={styles.monthProfileMarker}
                style={{ color: profileContext.accentColor }}
              >
                {profileContext.isProfileStart ? profileContext.profile.name : ""}
              </span>
              <div className={styles.monthDots}>
                {getMealTypeOrder(mealTypes).map((type) => {
                  const hasMealType = cellMeals.some(
                    (meal) => meal.type === type
                  );
                  return hasMealType ? (
                    <span
                      className={styles.monthDot}
                      key={type}
                      style={{ background: getTypeConfig(type, mealTypes).dot }}
                    />
                  ) : null;
                })}
              </div>
            </button>
          );
        })}
      </div>

      {popover ? (
        <>
          <div
            className={styles.popoverBackdrop}
            onClick={() => setPopover(null)}
          />
          <div
            className={styles.monthPopover}
            role="dialog"
            aria-modal="false"
            aria-label="Month day meals"
            ref={popoverRef}
            style={{
              top:
                popoverPosition?.top ??
                popover.anchor.bottom + POPOVER_TRIGGER_SPACING,
              left: popoverPosition?.left ?? popover.anchor.left,
            }}
          >
            <div className={styles.popoverHeader}>
              <div className={styles.popoverHeaderTopRow}>
                <div className={styles.popoverHeaderBody}>
                  <span className={styles.popoverDate}>
                    {popover.date.toLocaleDateString("default", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {popoverProfileContext ? (
                    <div className={styles.popoverProfileSummary}>
                      <span
                        className={styles.popoverProfileChip}
                        style={{
                          borderColor: popoverProfileContext.accentColor,
                          color: popoverProfileContext.accentColor,
                        }}
                      >
                        {popoverProfileContext.profile.name}
                      </span>
                      {popoverProfileContext.rangeLabel ? (
                        <span className={styles.popoverProfileRange}>
                          {formatMealTypeProfileRange(popoverProfileContext.profile)}
                        </span>
                      ) : null}
                      {popoverProfileContext.isProfileStart ? (
                        <span className={styles.popoverProfileTransition}>
                          Profile starts on this day
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button
                  className={styles.popoverClose}
                  aria-label="Close month details"
                  onClick={() => setPopover(null)}
                  type="button"
                >
                  <span className={styles.popoverCloseGlyph}>x</span>
                </button>
              </div>
              <div className={styles.popoverHeaderActionsRow}>
                <div className={styles.popoverHeaderActions}>
                  <button
                    className={styles.popoverHeaderActionBtn}
                    aria-label="Open day view"
                    onClick={openDayViewFromPopover}
                    type="button"
                  >
                    Open Day
                  </button>
                  <button
                    className={styles.popoverHeaderActionBtn}
                    aria-label="Open week view"
                    onClick={openWeekViewFromPopover}
                    type="button"
                  >
                    Open Week
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.popoverMeals}>
              {popoverMeals.length === 0 ? (
                <div className={styles.popoverEmptyState}>No meals planned.</div>
              ) : null}
              {popoverSlots.map((slot) => {
                const typeConfig = getTypeConfig(slot.type, popoverMealTypes);

                return (
                  <section className={styles.popoverMealGroup} key={slot.type}>
                    <div className={styles.popoverMealGroupHeader}>
                      <span
                        className={styles.popoverMealTypeChip}
                        style={{ borderColor: typeConfig.dot, color: typeConfig.text }}
                      >
                        {typeConfig.label}
                      </span>
                      <button
                        className={styles.slotAddMoreBtn}
                        onClick={() => {
                          onEdit(
                            createEmptyMeal(
                              new Date(popover.date),
                              slot.type,
                              popoverMealTypes.find(
                                (definition) => definition.slug === slot.type
                              ) ?? null
                            )
                          );
                        }}
                        type="button"
                      >
                        + Add {typeConfig.label}
                      </button>
                    </div>
                    {slot.meals.length === 0 ? (
                      <div className={styles.popoverGroupEmpty}>No meal planned.</div>
                    ) : (
                      slot.meals.map((meal) => (
                        <button
                          className={styles.popoverMealRow}
                          key={
                            meal.id ||
                            `${meal.type}-${meal.date.toISOString()}-${meal.name}`
                          }
                          onClick={() => {
                            onEdit(meal);
                          }}
                          type="button"
                        >
                          <span
                            className={styles.popoverDot}
                            style={{ background: typeConfig.dot }}
                          />
                          <div className={styles.popoverMealInfo}>
                            <span className={styles.popoverMealName}>{meal.name}</span>
                            <span
                              className={styles.popoverMealType}
                              style={{ color: typeConfig.text }}
                            >
                              {typeConfig.label}
                            </span>
                            {meal.mealSubTypeDefinition ? (
                              <span
                                className={styles.popoverMealSubType}
                                style={{ color: meal.mealSubTypeDefinition.color }}
                              >
                                {meal.mealSubTypeDefinition.name}
                              </span>
                            ) : null}
                          </div>
                          <span className={styles.popoverEditHint}>Edit</span>
                        </button>
                      ))
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
