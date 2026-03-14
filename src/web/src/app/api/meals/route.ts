import { MealService } from "@copilot-chef/core";
import { NextRequest, NextResponse } from "next/server";

const mealService = new MealService();

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "Both from and to query parameters are required" },
      { status: 400 }
    );
  }

  const data = await mealService.listMealsInRange(from, to);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const ingredientsFromJson =
      typeof body?.ingredientsJson === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(body.ingredientsJson);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : undefined;

    const normalizedBody = {
      ...body,
      name: body?.name ?? body?.title,
      mealType: body?.mealType ?? body?.type,
      ingredients: body?.ingredients ?? ingredientsFromJson ?? []
    };

    const data = await mealService.createMeal(normalizedBody);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create meal"
      },
      { status: 400 }
    );
  }
}
