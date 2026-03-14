import {
  createEmptyMeal,
  isSameDay,
  MEAL_TYPES,
  mealsForDay,
  type EditableMeal,
  TYPE_CONFIG,
} from "@/lib/calendar";

import styles from "../meal-plan.module.css";

type DayViewProps = {
  date: Date;
  meals: EditableMeal[];
  setDate: (date: Date) => void;
  onEdit: (meal: EditableMeal) => void;
};

export function DayView({ date, meals, setDate, onEdit }: DayViewProps) {
  const dayMeals = mealsForDay(meals, date);

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

      {dayMeals.length === 0 ? (
        <div className={styles.dayEmpty}>
          <div className={styles.dayEmptyIcon}>🍽️</div>
          <p className={styles.dayEmptyText}>No meals planned for this day.</p>
          <button
            className={styles.btnAddMeal}
            onClick={() => onEdit(createEmptyMeal(new Date(date), "dinner"))}
            type="button"
          >
            + Add a Meal
          </button>
        </div>
      ) : (
        <div className={styles.dayTimeline}>
          {MEAL_TYPES.map((type, index) => {
            const typeMeals = dayMeals.filter((meal) => meal.type === type);
            const typeConfig = TYPE_CONFIG[type];

            return (
              <div className={styles.timelineSlot} key={type}>
                <div className={styles.timelineLabelCol}>
                  <div
                    className={styles.timelineDot}
                    style={{ background: typeConfig.dot }}
                  />
                  {index < MEAL_TYPES.length - 1 ? (
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
                  {typeMeals.length === 0 ? (
                    <div className={styles.timelineEmptySlot}>
                      <button
                        className={styles.btnAddSlot}
                        onClick={() =>
                          onEdit(createEmptyMeal(new Date(date), type))
                        }
                        type="button"
                      >
                        + Add
                      </button>
                    </div>
                  ) : (
                    typeMeals.map((meal) => (
                      <button
                        className={styles.timelineMealCard}
                        key={
                          meal.id ||
                          `${meal.type}-${meal.date.toISOString()}-${meal.name}`
                        }
                        onClick={() => onEdit(meal)}
                        style={{ borderLeft: `3px solid ${typeConfig.dot}` }}
                        type="button"
                      >
                        <span className={styles.timelineMealName}>
                          {meal.name}
                        </span>
                        {meal.notes ? (
                          <span className={styles.timelineMealNotes}>
                            {meal.notes}
                          </span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
