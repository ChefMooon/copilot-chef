import { MealLogService, MealService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const mealLogService = new MealLogService();
const mealService = new MealService();

export async function GET() {
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

  return NextResponse.json({
    heatmap,
    mealTypeBreakdown,
    cuisineBreakdown,
    weeklyTrend,
    dayOfWeekBreakdown,
    planVsLog,
    topMeals,
    topIngredients,
  });
}
