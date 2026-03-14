import { useState, useEffect, useRef } from "react";

// ─── Mock Data ───────────────────────────────────────────────────────────────
const MEAL_TYPES = [
  "breakfast",
  "morning snack",
  "lunch",
  "afternoon snack",
  "dinner",
];
const TYPE_COLORS = {
  breakfast: {
    dot: "#E8885A",
    bg: "#FDF0E8",
    text: "#A0441A",
    label: "BREAKFAST",
  },
  "morning snack": {
    dot: "#C5A84B",
    bg: "#FBF6E8",
    text: "#8A6E20",
    label: "MORNING SNACK",
  },
  lunch: { dot: "#5A7D63", bg: "#EAF2EC", text: "#2E5438", label: "LUNCH" },
  "afternoon snack": {
    dot: "#8A7DB8",
    bg: "#F0EDF8",
    text: "#5A4D8A",
    label: "AFTERNOON SNACK",
  },
  dinner: { dot: "#3B5E45", bg: "#D4E4D8", text: "#1E3A26", label: "DINNER" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const generateMeals = () => {
  const base = new Date(2026, 2, 8); // Sunday March 8
  const pool = {
    breakfast: [
      "Lemon Ricotta Pancakes",
      "Avocado Toast",
      "Overnight Oats",
      "Poached Eggs & Soldiers",
      "Granola Bowl",
      "Shakshuka",
      "Banana Smoothie",
    ],
    "morning snack": [
      "Apple & Almond Butter",
      "Greek Yogurt",
      "Trail Mix",
      "Rice Cakes",
      "Cheese & Crackers",
    ],
    lunch: [
      "Green Goddess Grain Bowls",
      "Citrus Salad Board",
      "Sourdough Tartines",
      "Miso Noodle Soup",
      "Roasted Veggie Wrap",
      "Tomato Bisque",
      "Chicken Caesar",
    ],
    "afternoon snack": [
      "Hummus & Veg",
      "Dark Chocolate",
      "Fruit Salad",
      "Edamame",
      "Nut Bar",
    ],
    dinner: [
      "Roast Chicken with Spring Veg",
      "Miso Butter Salmon",
      "Butternut Squash Risotto",
      "Lamb Kofta",
      "Mushroom Pasta",
      "Thai Green Curry",
      "Beef Tacos",
    ],
  };
  const meals = [];
  let id = 1;
  for (let d = 0; d < 14; d++) {
    const date = new Date(base);
    date.setDate(base.getDate() + d);
    MEAL_TYPES.forEach((type, ti) => {
      if (Math.random() < (type.includes("snack") ? 0.5 : 0.85)) {
        const names = pool[type];
        meals.push({
          id: id++,
          date: new Date(date),
          type,
          name: names[Math.floor(Math.random() * names.length)],
          notes:
            Math.random() > 0.6 ? "Prep night before for best results." : "",
          ingredients:
            type === "breakfast" || type === "dinner"
              ? ["Olive oil", "Garlic", "Sea salt", "Fresh herbs"].slice(
                  0,
                  2 + Math.floor(Math.random() * 3)
                )
              : [],
        });
      }
    });
  }
  return meals;
};

const MEALS_DATA = generateMeals();

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const mealsForDay = (meals, date) =>
  meals
    .filter((m) => isSameDay(m.date, date))
    .sort((a, b) => MEAL_TYPES.indexOf(a.type) - MEAL_TYPES.indexOf(b.type));

// ─── Edit Modal ──────────────────────────────────────────────────────────────
function EditModal({ meal, onClose, onSave }) {
  const [form, setForm] = useState({ ...meal });
  const [ingredientInput, setIngredientInput] = useState("");
  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.target === overlayRef.current) onClose();
    };
    const keyHandler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", keyHandler);
    overlayRef.current?.addEventListener("mousedown", handler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [onClose]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const tc = TYPE_COLORS[form.type];

  const addIngredient = () => {
    if (!ingredientInput.trim()) return;
    set("ingredients", [...(form.ingredients || []), ingredientInput.trim()]);
    setIngredientInput("");
  };
  const removeIngredient = (i) =>
    set(
      "ingredients",
      form.ingredients.filter((_, idx) => idx !== i)
    );

  return (
    <div className="modal-overlay" ref={overlayRef}>
      <div className="modal-panel">
        <div className="modal-header" style={{ borderColor: tc.dot }}>
          <div className="modal-header-left">
            <span
              className="modal-type-badge"
              style={{ background: tc.bg, color: tc.text }}
            >
              {tc.label}
            </span>
            <span className="modal-date-label">
              {form.date.toLocaleDateString("default", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Meal name */}
          <div className="form-group">
            <label className="form-label">Meal Name</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Lemon Ricotta Pancakes"
            />
          </div>

          {/* Type + Date row */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Meal Type</label>
              <select
                className="form-input"
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Day</label>
              <input
                className="form-input"
                type="date"
                value={form.date.toISOString().split("T")[0]}
                onChange={(e) => {
                  const d = new Date(e.target.value + "T12:00:00");
                  if (!isNaN(d)) set("date", d);
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input form-textarea"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Prep tips, variations, substitutions…"
            />
          </div>

          {/* Ingredients */}
          <div className="form-group">
            <label className="form-label">Ingredients</label>
            <div className="ingredients-list">
              {(form.ingredients || []).map((ing, i) => (
                <span key={i} className="ingredient-chip">
                  {ing}
                  <button
                    className="ingredient-remove"
                    onClick={() => removeIngredient(i)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="ingredient-add-row">
              <input
                className="form-input ingredient-input"
                value={ingredientInput}
                onChange={(e) => setIngredientInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addIngredient()}
                placeholder="Add ingredient…"
              />
              <button className="btn-add-ingredient" onClick={addIngredient}>
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn-ai-suggest"
            onClick={() => alert("AI re-suggest would fire here!")}
          >
            ✨ AI Re-suggest
          </button>
          <div className="modal-footer-right">
            <button className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-save"
              onClick={() => {
                onSave(form);
                onClose();
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────
function DayView({ date, meals, setDate, onEdit }) {
  const dayMeals = mealsForDay(meals, date);
  const prev = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d);
  };
  const next = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d);
  };
  const isToday = isSameDay(date, new Date(2026, 2, 12));

  return (
    <div className="day-view">
      <div className="day-nav">
        <button className="day-nav-btn" onClick={prev}>
          ‹
        </button>
        <div className="day-nav-title">
          <span className="day-nav-weekday">
            {date.toLocaleDateString("default", { weekday: "long" })}
          </span>
          <span className="day-nav-date">
            {date.toLocaleDateString("default", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {isToday && <span className="today-pill">Today</span>}
          </span>
        </div>
        <button className="day-nav-btn" onClick={next}>
          ›
        </button>
      </div>

      {dayMeals.length === 0 ? (
        <div className="day-empty">
          <div className="day-empty-icon">🍽️</div>
          <p className="day-empty-text">No meals planned for this day.</p>
          <button className="btn-add-meal">+ Add a Meal</button>
        </div>
      ) : (
        <div className="day-timeline">
          {MEAL_TYPES.map((type, ti) => {
            const typeMeals = dayMeals.filter((m) => m.type === type);
            const tc = TYPE_COLORS[type];
            return (
              <div key={type} className="timeline-slot">
                <div className="timeline-label-col">
                  <div
                    className="timeline-dot"
                    style={{ background: tc.dot }}
                  />
                  {ti < MEAL_TYPES.length - 1 && (
                    <div className="timeline-line" />
                  )}
                </div>
                <div className="timeline-content">
                  <div
                    className="timeline-type-label"
                    style={{ color: tc.text }}
                  >
                    {tc.label}
                  </div>
                  {typeMeals.length === 0 ? (
                    <div className="timeline-empty-slot">
                      <button className="btn-add-slot">+ Add</button>
                    </div>
                  ) : (
                    typeMeals.map((meal) => (
                      <div
                        key={meal.id}
                        className="timeline-meal-card"
                        onClick={() => onEdit(meal)}
                        style={{ borderLeft: `3px solid ${tc.dot}` }}
                      >
                        <span className="timeline-meal-name">{meal.name}</span>
                        {meal.notes && (
                          <span className="timeline-meal-notes">
                            {meal.notes}
                          </span>
                        )}
                      </div>
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

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({ date, meals, setDate, onEdit }) {
  // Get Monday of week
  const weekStart = new Date(date);
  const dow = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - dow);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = new Date(2026, 2, 12);

  const prevWeek = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 7);
    setDate(d);
  };
  const nextWeek = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 7);
    setDate(d);
  };

  const startLabel = days[0].toLocaleDateString("default", {
    month: "short",
    day: "numeric",
  });
  const endLabel = days[6].toLocaleDateString("default", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="week-view">
      <div className="week-nav">
        <button className="day-nav-btn" onClick={prevWeek}>
          ‹
        </button>
        <span className="week-nav-label">
          {startLabel} — {endLabel}
        </span>
        <button className="day-nav-btn" onClick={nextWeek}>
          ›
        </button>
      </div>
      <div className="week-grid">
        {days.map((day, di) => {
          const dayMeals = mealsForDay(meals, day);
          const isToday = isSameDay(day, today);
          return (
            <div
              key={di}
              className={`week-col ${isToday ? "week-col-today" : ""}`}
            >
              <div className="week-col-header">
                <span className="week-col-weekday">{DAYS[day.getDay()]}</span>
                <span
                  className={`week-col-num ${isToday ? "week-col-num-today" : ""}`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="week-col-meals">
                {dayMeals.length === 0 ? (
                  <div className="week-empty-day">—</div>
                ) : (
                  dayMeals.map((meal) => {
                    const tc = TYPE_COLORS[meal.type];
                    return (
                      <button
                        key={meal.id}
                        className="week-chip"
                        onClick={() => onEdit(meal)}
                        style={{
                          background: tc.bg,
                          borderLeft: `3px solid ${tc.dot}`,
                        }}
                      >
                        <span className="week-chip-name">{meal.name}</span>
                        <span
                          className="week-chip-type"
                          style={{ color: tc.text }}
                        >
                          {tc.label}
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

// ─── Month View ───────────────────────────────────────────────────────────────
function MonthView({ date, meals, setDate, onEdit }) {
  const [popover, setPopover] = useState(null); // { date, x, y }
  const today = new Date(2026, 2, 12);

  const year = date.getFullYear(),
    month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const prevMonth = () => {
    const d = new Date(date);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    setDate(d);
  };
  const nextMonth = () => {
    const d = new Date(date);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    setDate(d);
  };

  const handleDayClick = (e, day) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ date: day, x: rect.left, y: rect.bottom + 8 });
  };

  return (
    <div className="month-view">
      <div className="month-nav">
        <button className="day-nav-btn" onClick={prevMonth}>
          ‹
        </button>
        <span className="month-nav-label">
          {MONTHS[month]} {year}
        </span>
        <button className="day-nav-btn" onClick={nextMonth}>
          ›
        </button>
      </div>

      <div className="month-grid">
        {/* Day headers */}
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="month-day-header">
            {d}
          </div>
        ))}

        {/* Cells */}
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          if (dayNum < 1 || dayNum > daysInMonth)
            return <div key={i} className="month-cell month-cell-empty" />;
          const cellDate = new Date(year, month, dayNum);
          const cellMeals = mealsForDay(meals, cellDate);
          const isToday = isSameDay(cellDate, today);

          return (
            <div
              key={i}
              className={`month-cell ${isToday ? "month-cell-today" : ""} ${cellMeals.length ? "month-cell-has-meals" : ""}`}
              onClick={(e) => cellMeals.length && handleDayClick(e, cellDate)}
            >
              <span
                className={`month-cell-num ${isToday ? "month-cell-num-today" : ""}`}
              >
                {dayNum}
              </span>
              <div className="month-dots">
                {MEAL_TYPES.map((type) => {
                  const has = cellMeals.some((m) => m.type === type);
                  return has ? (
                    <span
                      key={type}
                      className="month-dot"
                      style={{ background: TYPE_COLORS[type].dot }}
                    />
                  ) : null;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Popover */}
      {popover && (
        <>
          <div className="popover-backdrop" onClick={() => setPopover(null)} />
          <div
            className="month-popover"
            style={{
              top: Math.min(popover.y, window.innerHeight - 320),
              left: Math.min(popover.x, window.innerWidth - 260),
            }}
          >
            <div className="popover-header">
              <span className="popover-date">
                {popover.date.toLocaleDateString("default", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <button
                className="popover-close"
                onClick={() => setPopover(null)}
              >
                ✕
              </button>
            </div>
            <div className="popover-meals">
              {mealsForDay(meals, popover.date).map((meal) => {
                const tc = TYPE_COLORS[meal.type];
                return (
                  <button
                    key={meal.id}
                    className="popover-meal-row"
                    onClick={() => {
                      onEdit(meal);
                      setPopover(null);
                    }}
                  >
                    <span
                      className="popover-dot"
                      style={{ background: tc.dot }}
                    />
                    <div className="popover-meal-info">
                      <span className="popover-meal-name">{meal.name}</span>
                      <span
                        className="popover-meal-type"
                        style={{ color: tc.text }}
                      >
                        {tc.label}
                      </span>
                    </div>
                    <span className="popover-edit-hint">Edit →</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Calendar Page ────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("cal_view") || "week";
    } catch {
      return "week";
    }
  });
  const [date, setDate] = useState(new Date(2026, 2, 12));
  const [meals, setMeals] = useState(MEALS_DATA);
  const [editMeal, setEditMeal] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const activePage = "Calendar";
  const NAV_ITEMS = ["Home", "Calendar", "Meal Plan", "Grocery List", "Stats"];

  const switchView = (v) => {
    setView(v);
    try {
      localStorage.setItem("cal_view", v);
    } catch {}
  };

  const handleSave = (updated) => {
    setMeals((ms) => ms.map((m) => (m.id === updated.id ? updated : m)));
  };

  return (
    <div
      style={{
        fontFamily: "'Nunito', sans-serif",
        background: "#F5F0E8",
        minHeight: "100vh",
        color: "#2C2416",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --green: #3B5E45; --green-light: #5A7D63; --green-pale: #D4E4D8;
          --cream: #F5F0E8; --cream-dark: #EDE6D6;
          --orange: #C5622A; --orange-light: #E8885A;
          --text: #2C2416; --text-muted: #7A6A58; --white: #FFFDF8;
          --shadow: 0 2px 12px rgba(44,36,22,0.10);
          --shadow-lg: 0 6px 28px rgba(44,36,22,0.14);
          --radius: 14px;
        }

        /* NAV */
        .header { background: var(--green); padding: 0 2rem; height: 64px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 200; box-shadow: 0 2px 16px rgba(44,36,22,0.18); }
        .logo { font-family: 'Lora', serif; font-size: 1.45rem; font-weight: 700; color: #FFFDF8; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
        .nav-desktop { display: flex; gap: 0.25rem; }
        .nav-link { font-family: 'Nunito', sans-serif; font-size: 0.9rem; font-weight: 600; color: rgba(255,253,248,0.75); padding: 0.45rem 1rem; border-radius: 8px; cursor: pointer; transition: all 0.18s; border: none; background: none; }
        .nav-link:hover { color: #FFFDF8; background: rgba(255,253,248,0.1); }
        .nav-link.active { color: #FFFDF8; background: rgba(255,253,248,0.18); }
        .nav-right { display: flex; align-items: center; gap: 0.5rem; }
        .settings-btn { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,253,248,0.12); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; color: #FFFDF8; }
        .hamburger { display: none; width: 38px; height: 38px; border-radius: 8px; background: rgba(255,253,248,0.12); border: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; }
        .hamburger span { display: block; width: 18px; height: 2px; background: #FFFDF8; border-radius: 2px; }
        .mobile-menu { display: none; position: fixed; top: 64px; left: 0; right: 0; background: var(--green); padding: 1rem; z-index: 199; box-shadow: var(--shadow-lg); flex-direction: column; gap: 0.25rem; border-bottom: 3px solid var(--orange); }
        .mobile-menu.open { display: flex; }
        .mobile-nav-link { font-family: 'Nunito', sans-serif; font-size: 1rem; font-weight: 600; color: rgba(255,253,248,0.85); padding: 0.75rem 1rem; border-radius: 8px; cursor: pointer; border: none; background: none; text-align: left; }
        .mobile-nav-link.active { background: rgba(255,253,248,0.15); color: #FFFDF8; }

        /* PAGE */
        .page { max-width: 1200px; margin: 0 auto; padding: 2rem 2rem 4rem; }

        /* PAGE HEADER */
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.75rem; gap: 1rem; flex-wrap: wrap; }
        .page-header-left {}
        .eyebrow { font-family: 'Nunito', sans-serif; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--orange); margin-bottom: 0.3rem; }
        .page-title { font-family: 'Lora', serif; font-size: 2rem; font-weight: 700; line-height: 1.15; color: var(--text); }
        .page-sub { font-family: 'Nunito', sans-serif; font-size: 0.9rem; color: var(--text-muted); margin-top: 0.3rem; }
        .page-header-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; margin-top: 0.25rem; }

        /* VIEW TOGGLE */
        .view-toggle { display: flex; background: var(--white); border: 1px solid var(--cream-dark); border-radius: 10px; padding: 3px; gap: 2px; box-shadow: var(--shadow); }
        .view-btn { font-family: 'Nunito', sans-serif; font-size: 0.8rem; font-weight: 700; padding: 0.35rem 0.85rem; border-radius: 7px; border: none; cursor: pointer; background: transparent; color: var(--text-muted); transition: all 0.16s; }
        .view-btn.active { background: var(--green); color: #FFFDF8; box-shadow: 0 1px 6px rgba(59,94,69,0.28); }
        .view-btn:hover:not(.active) { background: var(--cream-dark); color: var(--text); }

        /* TODAY btn */
        .btn-today { font-family: 'Nunito', sans-serif; font-size: 0.8rem; font-weight: 700; padding: 0.4rem 0.9rem; border-radius: 8px; border: 1.5px solid var(--cream-dark); background: var(--white); color: var(--text-muted); cursor: pointer; transition: all 0.16s; box-shadow: var(--shadow); }
        .btn-today:hover { border-color: var(--green); color: var(--green); }

        /* CARD WRAPPER */
        .cal-card { background: var(--white); border-radius: 18px; box-shadow: var(--shadow); border: 1px solid rgba(59,94,69,0.08); overflow: hidden; }

        /* ── DAY VIEW ── */
        .day-view { padding: 0; }
        .day-nav { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--cream-dark); }
        .day-nav-btn { width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--cream-dark); background: var(--cream); cursor: pointer; font-size: 1.2rem; color: var(--text-muted); display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .day-nav-btn:hover { border-color: var(--green); color: var(--green); background: var(--green-pale); }
        .day-nav-title { text-align: center; }
        .day-nav-weekday { font-family: 'Lora', serif; font-size: 1.3rem; font-weight: 700; display: block; color: var(--text); }
        .day-nav-date { font-family: 'Nunito', sans-serif; font-size: 0.82rem; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .today-pill { background: var(--orange); color: #fff; font-size: 0.65rem; font-weight: 800; padding: 2px 7px; border-radius: 99px; letter-spacing: 0.05em; }
        .day-timeline { padding: 1.5rem; display: flex; flex-direction: column; gap: 0; }
        .timeline-slot { display: flex; gap: 1rem; min-height: 72px; }
        .timeline-label-col { display: flex; flex-direction: column; align-items: center; width: 16px; flex-shrink: 0; padding-top: 4px; }
        .timeline-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; border: 2px solid var(--white); box-shadow: 0 0 0 2px rgba(0,0,0,0.08); }
        .timeline-line { flex: 1; width: 2px; background: var(--cream-dark); margin: 3px 0; min-height: 24px; }
        .timeline-content { flex: 1; padding-bottom: 1.25rem; }
        .timeline-type-label { font-family: 'Nunito', sans-serif; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; }
        .timeline-meal-card { background: var(--cream); border-radius: 10px; padding: 0.65rem 0.9rem; cursor: pointer; transition: all 0.15s; display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.4rem; }
        .timeline-meal-card:hover { background: var(--cream-dark); transform: translateX(2px); }
        .timeline-meal-name { font-family: 'Lora', serif; font-size: 0.95rem; font-weight: 600; color: var(--text); }
        .timeline-meal-notes { font-family: 'Nunito', sans-serif; font-size: 0.75rem; color: var(--text-muted); font-style: italic; }
        .timeline-empty-slot { height: 36px; border: 1.5px dashed var(--cream-dark); border-radius: 8px; display: flex; align-items: center; padding: 0 0.75rem; margin-bottom: 0.4rem; }
        .btn-add-slot { font-family: 'Nunito', sans-serif; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); background: none; border: none; cursor: pointer; }
        .btn-add-slot:hover { color: var(--green); }
        .day-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 0.75rem; }
        .day-empty-icon { font-size: 2.5rem; opacity: 0.4; }
        .day-empty-text { font-family: 'Nunito', sans-serif; font-size: 0.95rem; color: var(--text-muted); }
        .btn-add-meal { font-family: 'Nunito', sans-serif; font-size: 0.82rem; font-weight: 700; background: var(--green); color: #FFFDF8; border: none; border-radius: 8px; padding: 0.45rem 1rem; cursor: pointer; }

        /* ── WEEK VIEW ── */
        .week-view {}
        .week-nav { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--cream-dark); }
        .week-nav-label { font-family: 'Nunito', sans-serif; font-size: 0.9rem; font-weight: 700; color: var(--text); }
        .week-grid { display: grid; grid-template-columns: repeat(7, 1fr); min-height: 480px; }
        .week-col { border-right: 1px solid var(--cream-dark); display: flex; flex-direction: column; }
        .week-col:last-child { border-right: none; }
        .week-col-today { background: rgba(59,94,69,0.03); }
        .week-col-header { padding: 0.75rem 0.6rem 0.6rem; border-bottom: 1px solid var(--cream-dark); text-align: center; }
        .week-col-weekday { font-family: 'Nunito', sans-serif; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); display: block; }
        .week-col-num { font-family: 'Lora', serif; font-size: 1.1rem; font-weight: 700; color: var(--text); display: block; margin-top: 2px; }
        .week-col-num-today { background: var(--orange); color: #fff; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; margin: 2px auto 0; font-size: 0.95rem; }
        .week-col-meals { flex: 1; padding: 0.5rem 0.4rem; display: flex; flex-direction: column; gap: 0.3rem; }
        .week-empty-day { color: var(--cream-dark); font-size: 1.1rem; text-align: center; padding-top: 1rem; }
        .week-chip { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 0.4rem 0.5rem; border-radius: 7px; border: none; cursor: pointer; width: 100%; text-align: left; transition: all 0.14s; }
        .week-chip:hover { filter: brightness(0.95); transform: translateY(-1px); box-shadow: 0 2px 6px rgba(44,36,22,0.1); }
        .week-chip-name { font-family: 'Nunito', sans-serif; font-size: 0.72rem; font-weight: 700; color: var(--text); line-height: 1.3; }
        .week-chip-type { font-family: 'Nunito', sans-serif; font-size: 0.58rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }

        /* ── MONTH VIEW ── */
        .month-view { padding: 0; }
        .month-nav { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--cream-dark); }
        .month-nav-label { font-family: 'Lora', serif; font-size: 1.15rem; font-weight: 700; color: var(--text); }
        .month-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
        .month-day-header { font-family: 'Nunito', sans-serif; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); text-align: center; padding: 0.65rem 0; border-bottom: 1px solid var(--cream-dark); }
        .month-cell { border-right: 1px solid var(--cream-dark); border-bottom: 1px solid var(--cream-dark); padding: 0.5rem 0.6rem; min-height: 80px; display: flex; flex-direction: column; gap: 0.35rem; transition: background 0.12s; }
        .month-cell:nth-child(7n) { border-right: none; }
        .month-cell-empty { background: rgba(237,230,214,0.3); }
        .month-cell-has-meals { cursor: pointer; }
        .month-cell-has-meals:hover { background: var(--cream-dark); }
        .month-cell-today { background: rgba(59,94,69,0.04); }
        .month-cell-num { font-family: 'Nunito', sans-serif; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); line-height: 1; }
        .month-cell-num-today { background: var(--orange); color: #fff; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; }
        .month-dots { display: flex; gap: 3px; flex-wrap: wrap; }
        .month-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        /* POPOVER */
        .popover-backdrop { position: fixed; inset: 0; z-index: 300; }
        .month-popover { position: fixed; z-index: 301; background: var(--white); border-radius: 12px; box-shadow: var(--shadow-lg); border: 1px solid var(--cream-dark); width: 240px; overflow: hidden; animation: popIn 0.15s ease; }
        @keyframes popIn { from { opacity:0; transform: scale(0.95) translateY(-4px); } to { opacity:1; transform: scale(1) translateY(0); } }
        .popover-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid var(--cream-dark); }
        .popover-date { font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 700; color: var(--text); }
        .popover-close { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.85rem; padding: 2px 4px; border-radius: 4px; }
        .popover-close:hover { background: var(--cream-dark); }
        .popover-meals { display: flex; flex-direction: column; }
        .popover-meal-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1rem; border: none; background: none; cursor: pointer; text-align: left; transition: background 0.12s; border-bottom: 1px solid var(--cream-dark); }
        .popover-meal-row:last-child { border-bottom: none; }
        .popover-meal-row:hover { background: var(--cream); }
        .popover-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .popover-meal-info { flex: 1; display: flex; flex-direction: column; gap: 1px; overflow: hidden; }
        .popover-meal-name { font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .popover-meal-type { font-family: 'Nunito', sans-serif; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .popover-edit-hint { font-family: 'Nunito', sans-serif; font-size: 0.68rem; font-weight: 700; color: var(--green-light); opacity: 0.7; flex-shrink: 0; }
        .popover-meal-row:hover .popover-edit-hint { opacity: 1; }

        /* ── EDIT MODAL ── */
        .modal-overlay { position: fixed; inset: 0; background: rgba(44,36,22,0.45); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(3px); animation: fadeIn 0.18s ease; }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .modal-panel { background: var(--white); border-radius: 18px; width: 100%; max-width: 520px; box-shadow: 0 20px 60px rgba(44,36,22,0.22); animation: slideUp 0.2s ease; display: flex; flex-direction: column; max-height: 90vh; }
        @keyframes slideUp { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.4rem; border-bottom: 2px solid var(--cream-dark); }
        .modal-header-left { display: flex; flex-direction: column; gap: 0.3rem; }
        .modal-type-badge { font-family: 'Nunito', sans-serif; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; border-radius: 99px; width: fit-content; }
        .modal-date-label { font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 600; color: var(--text-muted); }
        .modal-close { width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid var(--cream-dark); background: var(--cream); cursor: pointer; font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; justify-content: center; transition: all 0.14s; flex-shrink: 0; }
        .modal-close:hover { border-color: var(--text-muted); color: var(--text); }
        .modal-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.4rem; display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
        .form-row { display: flex; gap: 0.85rem; }
        .form-label { font-family: 'Nunito', sans-serif; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
        .form-input { font-family: 'Nunito', sans-serif; font-size: 0.88rem; font-weight: 500; color: var(--text); background: var(--cream); border: 1.5px solid var(--cream-dark); border-radius: 9px; padding: 0.55rem 0.8rem; width: 100%; outline: none; transition: border-color 0.15s; }
        .form-input:focus { border-color: var(--green); }
        .form-textarea { resize: vertical; min-height: 72px; }
        .ingredients-list { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.4rem; }
        .ingredient-chip { font-family: 'Nunito', sans-serif; font-size: 0.75rem; font-weight: 600; background: var(--green-pale); color: var(--green); padding: 3px 8px 3px 10px; border-radius: 99px; display: flex; align-items: center; gap: 0.3rem; }
        .ingredient-remove { background: none; border: none; cursor: pointer; color: var(--green-light); font-size: 1rem; line-height: 1; padding: 0; }
        .ingredient-add-row { display: flex; gap: 0.5rem; }
        .ingredient-input { flex: 1; }
        .btn-add-ingredient { font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 700; background: var(--green-pale); color: var(--green); border: none; border-radius: 8px; padding: 0 0.9rem; cursor: pointer; white-space: nowrap; transition: background 0.14s; }
        .btn-add-ingredient:hover { background: var(--green); color: #FFFDF8; }
        .modal-footer { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.4rem; border-top: 1px solid var(--cream-dark); gap: 0.75rem; flex-wrap: wrap; }
        .modal-footer-right { display: flex; gap: 0.6rem; align-items: center; }
        .btn-ai-suggest { font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 700; background: #FBF6E8; color: #8A6E20; border: 1.5px solid #E8D98A; border-radius: 8px; padding: 0.42rem 0.85rem; cursor: pointer; transition: all 0.14s; }
        .btn-ai-suggest:hover { background: #F5ECC0; border-color: #C5A84B; }
        .btn-ghost { font-family: 'Nunito', sans-serif; font-size: 0.82rem; font-weight: 700; background: none; border: 1.5px solid var(--cream-dark); border-radius: 8px; padding: 0.42rem 0.85rem; color: var(--text-muted); cursor: pointer; transition: all 0.14s; }
        .btn-ghost:hover { border-color: var(--text-muted); color: var(--text); }
        .btn-save { font-family: 'Nunito', sans-serif; font-size: 0.82rem; font-weight: 700; background: var(--orange); color: #FFFDF8; border: none; border-radius: 8px; padding: 0.45rem 1.1rem; cursor: pointer; transition: background 0.14s; }
        .btn-save:hover { background: var(--orange-light); }

        /* MOBILE */
        @media (max-width: 768px) {
          .nav-desktop { display: none; }
          .hamburger { display: flex; }
          .page { padding: 1.25rem 1rem 3rem; }
          .page-header { flex-direction: column; gap: 0.75rem; }
          .page-header-right { width: 100%; justify-content: space-between; }
          .week-grid { grid-template-columns: repeat(7,1fr); overflow-x: auto; }
          .week-chip-name { font-size: 0.65rem; }
          .week-chip-type { display: none; }
          .week-col-header { padding: 0.5rem 0.3rem 0.4rem; }
          .month-cell { min-height: 56px; padding: 0.35rem 0.4rem; }
          .form-row { flex-direction: column; gap: 1rem; }
          .modal-panel { border-radius: 14px 14px 0 0; max-height: 92vh; position: fixed; bottom: 0; left: 0; right: 0; max-width: 100%; }
          .modal-overlay { align-items: flex-end; padding: 0; }
          .modal-footer { flex-direction: column-reverse; }
          .modal-footer-right { width: 100%; justify-content: flex-end; }
          .btn-ai-suggest { width: 100%; text-align: center; }
        }
      `}</style>

      {/* Header */}
      <header className="header">
        <div className="logo">🍳 Copilot Chef</div>
        <nav className="nav-desktop">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              className={`nav-link ${item === activePage ? "active" : ""}`}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="nav-right">
          <button className="hamburger" onClick={() => setMenuOpen((o) => !o)}>
            <span />
            <span />
            <span />
          </button>
          <button className="settings-btn">⚙️</button>
        </div>
      </header>
      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            className={`mobile-nav-link ${item === activePage ? "active" : ""}`}
            onClick={() => setMenuOpen(false)}
          >
            {item}
          </button>
        ))}
      </div>

      <main className="page">
        {/* Page header */}
        <div className="page-header">
          <div className="page-header-left">
            <div className="eyebrow">Calendar</div>
            <h1 className="page-title">Weekly Meal Calendar</h1>
            <p className="page-sub">
              {view === "day" &&
                date.toLocaleDateString("default", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              {view === "week" && "Plan and review your meals week by week."}
              {view === "month" &&
                `${MONTHS[date.getMonth()]} ${date.getFullYear()}`}
            </p>
          </div>
          <div className="page-header-right">
            <button
              className="btn-today"
              onClick={() => setDate(new Date(2026, 2, 12))}
            >
              Today
            </button>
            <div className="view-toggle">
              {["day", "week", "month"].map((v) => (
                <button
                  key={v}
                  className={`view-btn ${view === v ? "active" : ""}`}
                  onClick={() => switchView(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar card */}
        <div className="cal-card">
          {view === "day" && (
            <DayView
              date={date}
              meals={meals}
              setDate={setDate}
              onEdit={setEditMeal}
            />
          )}
          {view === "week" && (
            <WeekView
              date={date}
              meals={meals}
              setDate={setDate}
              onEdit={setEditMeal}
            />
          )}
          {view === "month" && (
            <MonthView
              date={date}
              meals={meals}
              setDate={setDate}
              onEdit={setEditMeal}
            />
          )}
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: "1.25rem",
            flexWrap: "wrap",
            marginTop: "1rem",
            paddingLeft: "0.25rem",
          }}
        >
          {MEAL_TYPES.map((type) => (
            <div
              key={type}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: TYPE_COLORS[type].dot,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'Nunito',sans-serif",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {TYPE_COLORS[type].label}
              </span>
            </div>
          ))}
        </div>
      </main>

      {/* Edit Modal */}
      {editMeal && (
        <EditModal
          meal={editMeal}
          onClose={() => setEditMeal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
