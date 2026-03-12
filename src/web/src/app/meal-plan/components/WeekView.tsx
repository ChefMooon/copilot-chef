import { DAYS, getMonday, isSameDay, mealsForDay, type EditableMeal, TYPE_CONFIG } from "@/lib/calendar";

import styles from "../meal-plan.module.css";

type WeekViewProps = {
  date: Date;
  meals: EditableMeal[];
  setDate: (date: Date) => void;
  onEdit: (meal: EditableMeal) => void;
};

export function WeekView({ date, meals, setDate, onEdit }: WeekViewProps) {
  const weekStart = getMonday(date);

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return day;
  });

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

  const startLabel = days[0]?.toLocaleDateString("default", { month: "short", day: "numeric" }) ?? "";
  const endLabel =
    days[6]?.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" }) ?? "";
  const today = new Date();

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
      <div className={styles.weekGrid}>
        {days.map((day, index) => {
          const dayMeals = mealsForDay(meals, day);
          const todayMatch = isSameDay(day, today);

          return (
            <div className={`${styles.weekCol} ${todayMatch ? styles.weekColToday : ""}`} key={index}>
              <div className={styles.weekColHeader}>
                <span className={styles.weekColWeekday}>{DAYS[day.getDay()]}</span>
                <span className={`${styles.weekColNum} ${todayMatch ? styles.weekColNumToday : ""}`}>{day.getDate()}</span>
              </div>
              <div className={styles.weekColMeals}>
                {dayMeals.length === 0 ? (
                  <div className={styles.weekEmptyDay}>-</div>
                ) : (
                  dayMeals.map((meal) => {
                    const typeConfig = TYPE_CONFIG[meal.type];
                    return (
                      <button
                        className={styles.weekChip}
                        key={meal.id || `${meal.type}-${meal.date.toISOString()}-${meal.name}`}
                        onClick={() => onEdit(meal)}
                        style={{ background: typeConfig.bg, borderLeft: `3px solid ${typeConfig.dot}` }}
                        type="button"
                      >
                        <span className={styles.weekChipName}>{meal.name}</span>
                        <span className={styles.weekChipType} style={{ color: typeConfig.text }}>
                          {typeConfig.label}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
