import { useEffect, useState, type MouseEvent } from "react";

import {
  buildMonthCellAriaLabel,
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
  onEdit: (meal: EditableMeal) => void;
};

type PopoverState = {
  date: Date;
  x: number;
  y: number;
};

export function MonthView({
  date,
  meals,
  mealTypeProfiles,
  highlightedProfileId,
  setDate,
  onEdit,
}: MonthViewProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);

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
    setPopover({ date: day, x: rect.left, y: rect.bottom + 8 });
  };

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
            style={{
              top: Math.min(popover.y, window.innerHeight - 320),
              left: Math.min(popover.x, window.innerWidth - 260),
            }}
          >
            <div className={styles.popoverHeader}>
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
                onClick={() => setPopover(null)}
                type="button"
              >
                x
              </button>
            </div>
            {popoverProfileContext ? (
              <div className={styles.popoverMealTypes}>
                {getMealTypeOrder(popoverProfileContext.mealTypes).map((type) => {
                  const typeConfig = getTypeConfig(type, popoverProfileContext.mealTypes);

                  return (
                    <span
                      className={styles.popoverMealTypeChip}
                      key={type}
                      style={{ borderColor: typeConfig.dot, color: typeConfig.text }}
                    >
                      {typeConfig.label}
                    </span>
                  );
                })}
              </div>
            ) : null}
            <div className={styles.popoverMeals}>
              {mealsForDay(meals, popover.date, popoverMealTypes).length === 0 ? (
                <div className={styles.popoverEmptyState}>No meals planned.</div>
              ) : (
                mealsForDay(meals, popover.date, popoverMealTypes).map((meal) => {
                  const typeConfig = getTypeConfig(meal.type, popoverMealTypes);
                  return (
                    <button
                      className={styles.popoverMealRow}
                      key={
                        meal.id ||
                        `${meal.type}-${meal.date.toISOString()}-${meal.name}`
                      }
                      onClick={() => {
                        onEdit(meal);
                        setPopover(null);
                      }}
                      type="button"
                    >
                      <span
                        className={styles.popoverDot}
                        style={{ background: typeConfig.dot }}
                      />
                      <div className={styles.popoverMealInfo}>
                        <span className={styles.popoverMealName}>
                          {meal.name}
                        </span>
                        <span
                          className={styles.popoverMealType}
                          style={{ color: typeConfig.text }}
                        >
                          {typeConfig.label}
                        </span>
                      </div>
                      <span className={styles.popoverEditHint}>Edit -&gt;</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
