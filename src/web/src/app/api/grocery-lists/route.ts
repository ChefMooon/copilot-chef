import { GroceryService } from "@copilot-chef/core";
import { NextRequest, NextResponse } from "next/server";

const groceryService = new GroceryService();

export async function GET(request: NextRequest) {
  const currentOnly = request.nextUrl.searchParams.get("current") === "1";
  const data = currentOnly
    ? await groceryService.getCurrentGroceryList()
    : await groceryService.listGroceryLists();

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await groceryService.createGroceryList(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create grocery list",
      },
      { status: 400 }
    );
  }
}
