import { MealService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const mealService = new MealService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await mealService.updateMeal(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update meal"
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await mealService.deleteMeal(id);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete meal"
      },
      { status: 400 }
    );
  }
}
