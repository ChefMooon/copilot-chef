import { Hono } from "hono";
import { mealService } from "../services.js";
import { endOfDay, getUpcomingDateRange, startOfWeek } from "../lib/date.js";

function getCurrentWeekRange() {
  const now = new Date();
  const monday = startOfWeek(now);
  const sunday = endOfDay(new Date(monday.setDate(monday.getDate() + 6)));

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
  const daysQuery = c.req.query("days");
  const { from, to } =
    daysQuery === undefined
      ? getCurrentWeekRange()
      : getUpcomingDateRange(Number(daysQuery));
  const totalSlots = await mealService.getLiveMealCountInRange(from, to);
  return c.json({ data: { from, to, totalSlots } });
});
