"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DayView } from "./components/DayView";
import { EditModal } from "./components/EditModal";
import { MonthView } from "./components/MonthView";
import { WeekView } from "./components/WeekView";
import styles from "./meal-plan.module.css";

import {
  createEmptyMeal,
  fromCalendarMealType,
  MEAL_TYPES,
  MONTHS,
  toEditableMeal,
  toRangeByView,
  TYPE_CONFIG,
  type CalendarMeal,
  type EditableMeal,
} from "@/lib/calendar";

import { fetchJson } from "@/lib/api";
import { useChatPageContext } from "@/context/chat-context";

type CalView = "day" | "week" | "month";

function toIsoString(date: Date) {
  return date.toISOString();
}

async function readChatResponse(message: string) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Unable to fetch AI suggestion");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text.trim();
}

export default function MealPlanPage() {
  const [view, setView] = useState<CalView>("week");

  useEffect(() => {
    try {
      const storedView = localStorage.getItem("cal_view") as CalView | null;
      if (storedView) setView(storedView);
    } catch {
      // ignore persistence failures
    }
  }, []);
  const [date, setDate] = useState(() => new Date());
  const [editMeal, setEditMeal] = useState<EditableMeal | null>(null);
  const queryClient = useQueryClient();

  const dateRange = useMemo(() => toRangeByView(view, date), [view, date]);

  const mealsQuery = useQuery({
    queryKey: [
      "meals",
      view,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchJson<{ data: CalendarMeal[] }>(
        `/api/meals?from=${encodeURIComponent(toIsoString(dateRange.from))}&to=${encodeURIComponent(
          toIsoString(dateRange.to)
        )}`
      ).then((response) => response.data.map(toEditableMeal)),
  });

  const meals = mealsQuery.data ?? [];

  useChatPageContext({
    page: "meal-plan",
    view,
    date: date.toISOString(),
    dateRangeFrom: dateRange.from.toISOString(),
    dateRangeTo: dateRange.to.toISOString(),
    meals: meals.map((m) => ({
      id: m.id ?? "",
      name: m.name,
      mealType: m.type,
      date: m.date.toISOString(),
    })),
  });

  const switchView = (nextView: CalView) => {
    setView(nextView);
    try {
      localStorage.setItem("cal_view", nextView);
    } catch {
      // ignore persistence failures
    }
  };

  const onSaveMeal = async (updatedMeal: EditableMeal) => {
    const payload = {
      mealPlanId: updatedMeal.mealPlanId,
      name: updatedMeal.name,
      date: updatedMeal.date.toISOString(),
      mealType: fromCalendarMealType(updatedMeal.type),
      notes: updatedMeal.notes,
      ingredients: updatedMeal.ingredients,
    };

    if (updatedMeal.id) {
      await fetchJson<{ data: CalendarMeal }>(`/api/meals/${updatedMeal.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await fetchJson<{ data: CalendarMeal }>("/api/meals", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    await queryClient.invalidateQueries({ queryKey: ["meals"] });
  };

  const onDeleteMeal = async (mealId: string) => {
    await fetchJson<{ data: { id: string } }>(`/api/meals/${mealId}`, {
      method: "DELETE",
    });

    await queryClient.invalidateQueries({ queryKey: ["meals"] });
  };

  const onResuggest = async (meal: EditableMeal) => {
    const answer = await readChatResponse(
      `Re-suggest a ${meal.type} meal for ${meal.date.toDateString()} based on my preferences. Return a short meal name and one sentence.`
    );

    const nextName =
      answer
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0)
        ?.replace(/^[-*\d.)\s]+/, "") ?? meal.name;

    return {
      name: nextName.replace(/^"|"$/g, ""),
    };
  };

  return (
    <div className={styles.calendarPage}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>Meal Plan</div>
          <h1 className={styles.pageTitle}>Weekly Meal Plan</h1>
          <p className={styles.pageSub}>
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
        <div className={styles.pageHeaderRight}>
          <button
            className={styles.btnAddMeal}
            onClick={() =>
              setEditMeal(createEmptyMeal(new Date(date), "dinner"))
            }
            type="button"
          >
            + Add Meal
          </button>
          <button
            className={styles.btnToday}
            onClick={() => setDate(new Date())}
            type="button"
          >
            Today
          </button>
          <div className={styles.viewToggle}>
            {(["day", "week", "month"] as const).map((option) => (
              <button
                className={`${styles.viewBtn} ${view === option ? styles.viewBtnActive : ""}`}
                key={option}
                onClick={() => switchView(option)}
                type="button"
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.calCard}>
        {view === "day" ? (
          <DayView
            date={date}
            meals={meals}
            onEdit={setEditMeal}
            setDate={setDate}
          />
        ) : null}
        {view === "week" ? (
          <WeekView
            date={date}
            meals={meals}
            onEdit={setEditMeal}
            setDate={setDate}
          />
        ) : null}
        {view === "month" ? (
          <MonthView
            date={date}
            meals={meals}
            onEdit={setEditMeal}
            setDate={setDate}
          />
        ) : null}
      </div>

      <div className={styles.legend}>
        {MEAL_TYPES.map((type) => (
          <div className={styles.legendItem} key={type}>
            <span
              className={styles.legendDot}
              style={{ background: TYPE_CONFIG[type].dot }}
            />
            <span className={styles.legendText}>{TYPE_CONFIG[type].label}</span>
          </div>
        ))}
      </div>

      {editMeal ? (
        <EditModal
          meal={editMeal}
          onClose={() => setEditMeal(null)}
          onDelete={onDeleteMeal}
          onResuggest={onResuggest}
          onSave={onSaveMeal}
        />
      ) : null}

      {mealsQuery.isLoading ? (
        <p className={styles.pageSub} style={{ marginTop: "0.85rem" }}>
          Loading meals...
        </p>
      ) : null}
      {mealsQuery.error ? (
        <p
          className={styles.pageSub}
          style={{ marginTop: "0.85rem", color: "#A0441A" }}
        >
          Unable to load meals for this range.
        </p>
      ) : null}
    </div>
  );
}
