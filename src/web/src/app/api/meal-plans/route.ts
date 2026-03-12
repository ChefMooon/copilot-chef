import { MealPlanService } from "@copilot-chef/core";
import { NextRequest, NextResponse } from "next/server";

const mealPlanService = new MealPlanService();

export async function GET(request: NextRequest) {
  const currentOnly = request.nextUrl.searchParams.get("current") === "1";
  const data = currentOnly
    ? await mealPlanService.getCurrentMealPlan()
    : await mealPlanService.listMealPlans();

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await mealPlanService.createMealPlan(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create meal plan"
      },
      { status: 400 }
    );
  }
}
