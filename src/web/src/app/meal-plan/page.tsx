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
  normalizeMealDate,
  toEditableMeal,
  toRangeByView,
  TYPE_CONFIG,
  type CalendarMealType,
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
  const mealsQueryKey = useMemo(
    () => [
      "meals",
      view,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ] as const,
    [dateRange.from, dateRange.to, view]
  );

  const mealsQuery = useQuery({
    queryKey: mealsQueryKey,
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

  const updateMealsCache = (
    updater: (current: EditableMeal[]) => EditableMeal[]
  ) => {
    const previousMeals =
      queryClient.getQueryData<EditableMeal[]>(mealsQueryKey) ?? [];

    queryClient.setQueryData<EditableMeal[]>(mealsQueryKey, (current) =>
      updater(current ?? [])
    );
    return previousMeals;
  };

  const patchMeal = async (
    mealId: string,
    changes: Partial<Pick<EditableMeal, "date" | "type">>
  ) => {
    const payload: { date?: string; mealType?: ReturnType<typeof fromCalendarMealType> } = {};

    if (changes.date) {
      payload.date = normalizeMealDate(changes.date).toISOString();
    }

    if (changes.type) {
      payload.mealType = fromCalendarMealType(changes.type);
    }

    await fetchJson<{ data: CalendarMeal }>(`/api/meals/${mealId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  };

  const onSaveMeal = async (updatedMeal: EditableMeal) => {
    const normalizedDate = normalizeMealDate(updatedMeal.date);
    const payload = {
      name: updatedMeal.name,
      date: normalizedDate.toISOString(),
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

  const onMoveMeal = async (
    meal: EditableMeal,
    targetDate: Date,
    targetType: CalendarMealType
  ) => {
    if (!meal.id) {
      return;
    }

    const normalizedTargetDate = normalizeMealDate(targetDate);
    const isSameSlot =
      meal.type === targetType &&
      meal.date.getFullYear() === normalizedTargetDate.getFullYear() &&
      meal.date.getMonth() === normalizedTargetDate.getMonth() &&
      meal.date.getDate() === normalizedTargetDate.getDate();

    if (isSameSlot) {
      return;
    }

    const previousMeals = updateMealsCache((current) =>
      current.map((currentMeal) =>
        currentMeal.id === meal.id
          ? {
              ...currentMeal,
              date: normalizedTargetDate,
              type: targetType,
            }
          : currentMeal
      )
    );

    try {
      await patchMeal(meal.id, {
        date: normalizedTargetDate,
        type: targetType,
      });
    } catch (error) {
      queryClient.setQueryData(mealsQueryKey, previousMeals);
      throw error;
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
    }
  };

  const onSwapMeals = async (draggedMeal: EditableMeal, targetMeal: EditableMeal) => {
    if (!draggedMeal.id || !targetMeal.id || draggedMeal.id === targetMeal.id) {
      return;
    }

    const draggedSourceDate = normalizeMealDate(draggedMeal.date);
    const targetSourceDate = normalizeMealDate(targetMeal.date);
    const sameSlot =
      draggedMeal.type === targetMeal.type &&
      draggedSourceDate.getFullYear() === targetSourceDate.getFullYear() &&
      draggedSourceDate.getMonth() === targetSourceDate.getMonth() &&
      draggedSourceDate.getDate() === targetSourceDate.getDate();

    if (sameSlot) {
      return;
    }

    const previousMeals = updateMealsCache((current) =>
      current.map((currentMeal) => {
        if (currentMeal.id === draggedMeal.id) {
          return {
            ...currentMeal,
            date: targetSourceDate,
            type: targetMeal.type,
          };
        }

        if (currentMeal.id === targetMeal.id) {
          return {
            ...currentMeal,
            date: draggedSourceDate,
            type: draggedMeal.type,
          };
        }

        return currentMeal;
      })
    );

    try {
      await Promise.all([
        patchMeal(draggedMeal.id, {
          date: targetSourceDate,
          type: targetMeal.type,
        }),
        patchMeal(targetMeal.id, {
          date: draggedSourceDate,
          type: draggedMeal.type,
        }),
      ]);
    } catch (error) {
      queryClient.setQueryData(mealsQueryKey, previousMeals);
      throw error;
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
    }
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
            onMoveMeal={onMoveMeal}
            onSwapMeals={onSwapMeals}
            setDate={setDate}
          />
        ) : null}
        {view === "week" ? (
          <WeekView
            date={date}
            meals={meals}
            onEdit={setEditMeal}
            onMoveMeal={onMoveMeal}
            onSwapMeals={onSwapMeals}
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
