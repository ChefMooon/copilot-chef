import { MealPlanService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const mealPlanService = new MealPlanService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await mealPlanService.getMealPlan(id);

  if (!data) {
    return NextResponse.json({ error: "Meal plan not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
