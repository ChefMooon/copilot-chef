import { MealService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const mealService = new MealService();

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

export async function GET() {
  const { from, to } = getCurrentWeekRange();
  const totalMeals = await mealService.getMealCountInRange(from, to);

  return NextResponse.json({
    data: {
      from,
      to,
      totalMeals,
    },
  });
}
