"use client";

import { useEffect } from "react";

import { useChatContext } from "@/context/chat-context";

import { ActivityHeatmap } from "./ActivityHeatmap";
import { CuisineChart } from "./CuisineChart";
import { DayOfWeekChart } from "./DayOfWeekChart";
import { MealTypeChart } from "./MealTypeChart";
import { PlanVsLogCard } from "./PlanVsLogCard";
import { StatKpiRow } from "./StatKpiRow";
import { TopIngredientsList } from "./TopIngredientsList";
import { TopMealsList } from "./TopMealsList";
import { WeeklyTrendChart } from "./WeeklyTrendChart";

type HeatmapCell = { date: string; meals: number; isFuture: boolean };

export type StatsPayload = {
  heatmap: {
    weeks: HeatmapCell[][];
    monthStarts: Record<string, number>;
    totalMeals: number;
    activeDays: number;
    streak: number;
  };
  mealTypeBreakdown: { mealType: string; count: number }[];
  cuisineBreakdown: { cuisine: string; count: number }[];
  weeklyTrend: { weekLabel: string; meals: number }[];
  dayOfWeekBreakdown: { day: string; count: number }[];
  planningWindow: {
    totalMeals: number;
    activeDays: number;
    avgMealsPerActiveDay: number;
  };
  topMeals: { mealName: string; count: number }[];
  topIngredients: { ingredient: string; count: number }[];
};

type Props = {
  stats: StatsPayload;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted after:h-px after:flex-1 after:bg-[#E4DDD0] after:content-['']">
      {children}
    </div>
  );
}

export function StatsDashboard({ stats }: Props) {
  const { setPageContext } = useChatContext();

  useEffect(() => {
    setPageContext({ page: "stats" });
  }, [setPageContext]);

  const avgMealsPerActiveDay =
    stats.heatmap.activeDays > 0
      ? (stats.heatmap.totalMeals / stats.heatmap.activeDays).toFixed(1)
      : "—";

  const kpiCards = [
    { label: "Tracked meals", value: stats.heatmap.totalMeals },
    { label: "Active days", value: stats.heatmap.activeDays },
    {
      label: "Current streak",
      value: stats.heatmap.streak,
      sub: stats.heatmap.streak === 1 ? "day" : "days",
    },
    { label: "Avg meals / active day", value: avgMealsPerActiveDay },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange-500">
          Stats
        </p>
        <h1 className="font-serif text-3xl font-bold text-text">
          Meal Activity
        </h1>
        <p className="mt-1 text-sm font-medium text-text-muted">
          A full year of meal tracking, patterns, and planning insights.
        </p>
      </div>

      <StatKpiRow cards={kpiCards} />

      <SectionLabel>52-Week Heatmap</SectionLabel>
      <div className="rounded-card border border-green/10 bg-white p-6 shadow-card">
        <ActivityHeatmap
          monthStarts={stats.heatmap.monthStarts}
          weeks={stats.heatmap.weeks}
        />
      </div>

      <SectionLabel>Trends</SectionLabel>
      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyTrendChart data={stats.weeklyTrend} />
        <DayOfWeekChart data={stats.dayOfWeekBreakdown} />
      </div>

      <SectionLabel>Breakdown</SectionLabel>
      <div className="grid gap-4 lg:grid-cols-2">
        <MealTypeChart data={stats.mealTypeBreakdown} />
        <CuisineChart data={stats.cuisineBreakdown} />
      </div>

      <SectionLabel>Planning</SectionLabel>
      <div className="grid gap-4 lg:grid-cols-2">
        <PlanVsLogCard
          activeDays={stats.planningWindow.activeDays}
          avgMealsPerActiveDay={stats.planningWindow.avgMealsPerActiveDay}
          totalMeals={stats.planningWindow.totalMeals}
        />
        <TopMealsList meals={stats.topMeals} />
      </div>

      <SectionLabel>Ingredients</SectionLabel>
      <TopIngredientsList ingredients={stats.topIngredients} />
    </div>
  );
}
