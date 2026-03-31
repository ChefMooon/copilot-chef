import { useEffect, useState, type MouseEvent } from "react";

import {
  isSameDay,
  MEAL_TYPES,
  mealsForDay,
  MONTHS,
  type EditableMeal,
  TYPE_CONFIG,
} from "@/lib/calendar";

import styles from "./meal-plan.module.css";

type MonthViewProps = {
  date: Date;
  meals: EditableMeal[];
  setDate: (date: Date) => void;
  onEdit: (meal: EditableMeal) => void;
};

type PopoverState = {
  date: Date;
  x: number;
  y: number;
};

export function MonthView({ date, meals, setDate, onEdit }: MonthViewProps) {
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
          const cellMeals = mealsForDay(meals, cellDate);
          const todayMatch = isSameDay(cellDate, today);

          return (
            <button
              className={`${styles.monthCell} ${todayMatch ? styles.monthCellToday : ""} ${cellMeals.length ? styles.monthCellHasMeals : ""}`}
              key={index}
              onClick={(event) => {
                if (cellMeals.length > 0) {
                  handleDayClick(event, cellDate);
                }
              }}
              type="button"
            >
              <span
                className={`${styles.monthCellNum} ${todayMatch ? styles.monthCellNumToday : ""}`}
              >
                {dayNum}
              </span>
              <div className={styles.monthDots}>
                {MEAL_TYPES.map((type) => {
                  const hasMealType = cellMeals.some(
                    (meal) => meal.type === type
                  );
                  return hasMealType ? (
                    <span
                      className={styles.monthDot}
                      key={type}
                      style={{ background: TYPE_CONFIG[type].dot }}
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
              <span className={styles.popoverDate}>
                {popover.date.toLocaleDateString("default", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <button
                className={styles.popoverClose}
                onClick={() => setPopover(null)}
                type="button"
              >
                x
              </button>
            </div>
            <div className={styles.popoverMeals}>
              {mealsForDay(meals, popover.date).map((meal) => {
                const typeConfig = TYPE_CONFIG[meal.type];
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
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
