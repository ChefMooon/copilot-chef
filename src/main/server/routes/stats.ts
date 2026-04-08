import { Hono } from "hono";
import { mealService } from "../services.js";

function getCurrentWeekRange() {
  const now = new Date();
  const monday = new Date(now);
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    from: monday.toISOString(),
    to: sunday.toISOString(),
  };
}

export const statsRoutes = new Hono();

statsRoutes.get("/stats", async (c) => {
  const [
    heatmap,
    mealTypeBreakdown,
    cuisineBreakdown,
    weeklyTrend,
    dayOfWeekBreakdown,
    planningWindow,
    topMeals,
    topIngredients,
  ] = await Promise.all([
    mealService.getHeatmap(52),
    mealService.getMealTypeBreakdown(),
    mealService.getCuisineBreakdown(),
    mealService.getWeeklyTrend(12),
    mealService.getDayOfWeekBreakdown(),
    mealService.getPlanningWindowStats(30),
    mealService.getTopMeals(10),
    mealService.getTopIngredients(15),
  ]);

  return c.json({
    data: {
      heatmap,
      mealTypeBreakdown,
      cuisineBreakdown,
      weeklyTrend,
      dayOfWeekBreakdown,
      planningWindow,
      topMeals,
      topIngredients,
    },
  });
});

statsRoutes.get("/stats/meal-summary", async (c) => {
  const { from, to } = getCurrentWeekRange();
  const totalMeals = await mealService.getMealCountInRange(from, to);
  return c.json({ data: { from, to, totalMeals } });
});
