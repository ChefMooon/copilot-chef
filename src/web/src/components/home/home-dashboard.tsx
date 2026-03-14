"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useChatPageContext } from "@/context/chat-context";
import { fetchJson } from "@/lib/api";
import { cn } from "@/lib/utils";

import styles from "./home-dashboard.module.css";

type MealPlanPayload = {
  id: string;
  name: string;
  totalMeals: number;
};

type GroceryListPayload = {
  id: string;
  name: string;
  createdAt: string;
  checkedCount: number;
  totalItems: number;
  completionPercentage: number;
};

type HeatmapPayload = {
  weeks: Array<Array<{ date: string; meals: number; isFuture: boolean }>>;
  monthStarts: Record<string, number>;
};

function getHeatColor(meals: number, isFuture: boolean) {
  if (isFuture) {
    return "var(--cream-dark)";
  }

  if (meals === 0) {
    return "#E4DDD0";
  }

  if (meals === 1) {
    return "#A8C8B0";
  }

  if (meals === 2) {
    return "#6FA882";
  }

  return "var(--green)";
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function HomeDashboard() {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const mealPlanQuery = useQuery({
    queryKey: ["meal-plan", "current"],
    queryFn: () =>
      fetchJson<{ data: MealPlanPayload | null }>(
        "/api/meal-plans?current=1"
      ).then((response) => response.data),
  });

  const groceryListQuery = useQuery({
    queryKey: ["grocery-list", "current"],
    queryFn: () =>
      fetchJson<{ data: GroceryListPayload | null }>(
        "/api/grocery-lists?current=1"
      ).then((response) => response.data),
  });

  const heatmapQuery = useQuery({
    queryKey: ["meal-logs", 13],
    queryFn: () =>
      fetchJson<{ data: HeatmapPayload }>("/api/meal-logs?weeks=13").then(
        (response) => response.data
      ),
  });

  const greetingDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    []
  );

  const monthLabels = useMemo(() => {
    const entries = Object.entries(heatmapQuery.data?.monthStarts ?? {});
    return entries.reduce<Record<number, string>>(
      (accumulator, [month, index]) => {
        accumulator[index] = month;
        return accumulator;
      },
      {}
    );
  }, [heatmapQuery.data?.monthStarts]);

  const totalMeals = mealPlanQuery.data?.totalMeals ?? 0;
  const groceryList = groceryListQuery.data;
  const heatmap = heatmapQuery.data?.weeks ?? [];

  useChatPageContext({
    page: "home",
    mealPlanName: mealPlanQuery.data?.name ?? null,
    totalMeals,
    groceryListName: groceryList?.name ?? null,
    groceryCompletion: groceryList?.completionPercentage ?? 0,
  });

  return (
    <>
      <div className={cn(styles.pageGreeting, styles.fadeIn)}>
        <div className={styles.greetingEyebrow}>{greetingDate}</div>
        <h1 className={styles.greetingTitle}>{getGreeting()}, Chef!</h1>
        <p className={styles.greetingSub}>
          {totalMeals > 0
            ? `You have ${totalMeals} meals planned this week. Let's get cooking.`
            : "Your first weekly plan is ready to take shape."}
        </p>
      </div>

      <div className={cn(styles.sectionDivider, styles.fadeIn)}>Overview</div>
      <section className={cn(styles.overviewGrid, styles.fadeIn)}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>🔥 Meal Activity</div>
            <Link className={styles.cardAction} href="/stats">
              View Stats →
            </Link>
          </div>

          <div className={styles.heatmapWrap}>
            <div className={styles.heatmapMonthRow}>
              <div />
              {heatmap.map((_, weekIndex) => (
                <div className={styles.monthCell} key={weekIndex}>
                  {monthLabels[weekIndex] ?? ""}
                </div>
              ))}
            </div>

            <div className={styles.heatmapGrid}>
              {["M", "", "W", "", "F", "", ""].map((label, dayIndex) => (
                <div
                  className={styles.dayLabel}
                  key={`label-${dayIndex}`}
                  style={{ gridColumn: 1, gridRow: dayIndex + 1 }}
                >
                  {label}
                </div>
              ))}

              {heatmap.map((week, weekIndex) =>
                week.map((cell, dayIndex) => {
                  const dateLabel = new Date(cell.date).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                    }
                  );

                  return (
                    <button
                      className={styles.heatmapSquare}
                      key={`${weekIndex}-${dayIndex}`}
                      onMouseEnter={(event) =>
                        setTooltip({
                          x: event.clientX,
                          y: event.clientY,
                          text: cell.isFuture
                            ? "Not yet"
                            : `${dateLabel} — ${cell.meals} meal${cell.meals !== 1 ? "s" : ""}`,
                        })
                      }
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        gridColumn: weekIndex + 2,
                        gridRow: dayIndex + 1,
                        background: getHeatColor(cell.meals, cell.isFuture),
                      }}
                      type="button"
                    />
                  );
                })
              )}
            </div>

            <div className={styles.heatmapLegend}>
              <span className={styles.legendLabel}>Less</span>
              {["#E4DDD0", "#A8C8B0", "#6FA882", "#3B5E45"].map((color) => (
                <div
                  className={styles.legendSquare}
                  key={color}
                  style={{ background: color }}
                />
              ))}
              <span className={styles.legendLabel}>More</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>🛒 Grocery List</div>
            <Link className={styles.cardAction} href="/grocery-list">
              Full List →
            </Link>
          </div>

          <div className={styles.grocerySummary}>
            <div>
              <div className={styles.groceryListName}>
                {groceryList?.name ?? "Loading this week's list"}
              </div>
              <div className={styles.groceryMeta}>
                {groceryList
                  ? `Created ${new Date(
                      groceryList.createdAt
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })} · ${groceryList.totalItems} items`
                  : "Fetching current list"}
              </div>
            </div>

            <div>
              <div className={styles.groceryStatRow}>
                <div>
                  <span className={styles.groceryStatBig}>
                    {groceryList?.checkedCount ?? 0}
                  </span>
                  <span className={styles.groceryStatLabel}>
                    of {groceryList?.totalItems ?? 0} collected
                  </span>
                </div>
                <span className={styles.groceryPct}>
                  {groceryList?.completionPercentage ?? 0}%
                </span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${groceryList?.completionPercentage ?? 0}%`,
                  }}
                />
              </div>
            </div>

            <Button asChild variant="accent">
              <Link href="/grocery-list">Open List →</Link>
            </Button>
          </div>
        </div>
      </section>

      {tooltip ? (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </>
  );
}
