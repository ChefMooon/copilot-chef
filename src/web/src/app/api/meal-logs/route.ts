import { MealLogService } from "@copilot-chef/core";
import { NextRequest, NextResponse } from "next/server";

const mealLogService = new MealLogService();

export async function GET(request: NextRequest) {
  const weeks = Number(request.nextUrl.searchParams.get("weeks") ?? "13");
  const recent = Number(request.nextUrl.searchParams.get("recent") ?? "0");

  const data = recent > 0 ? await mealLogService.listRecent(recent) : await mealLogService.getHeatmap(weeks);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await mealLogService.recordMealLog(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to record meal log"
      },
      { status: 400 }
    );
  }
}
