import { MealLogService, MealService } from "@copilot-chef/core";

import {
  StatsDashboard,
  type StatsPayload,
} from "@/components/stats/StatsDashboard";

const mealLogService = new MealLogService();
const mealService = new MealService();

export default async function StatsPage() {
  const [
    heatmap,
    mealTypeBreakdown,
    cuisineBreakdown,
    weeklyTrend,
    dayOfWeekBreakdown,
    planVsLog,
    topMeals,
    topIngredients,
  ] = await Promise.all([
    mealLogService.getHeatmap(52),
    mealLogService.getMealTypeBreakdown(),
    mealLogService.getCuisineBreakdown(),
    mealLogService.getWeeklyTrend(12),
    mealLogService.getDayOfWeekBreakdown(),
    mealLogService.getPlanVsLogStats(30),
    mealLogService.getTopMeals(10),
    mealService.getTopIngredients(15),
  ]);

  const stats: StatsPayload = {
    heatmap,
    mealTypeBreakdown,
    cuisineBreakdown,
    weeklyTrend,
    dayOfWeekBreakdown,
    planVsLog,
    topMeals,
    topIngredients,
  };

  return <StatsDashboard stats={stats} />;
}
