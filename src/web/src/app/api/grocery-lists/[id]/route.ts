import { GroceryService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const groceryService = new GroceryService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await groceryService.getGroceryList(id);

  if (!data) {
    return NextResponse.json({ error: "Grocery list not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { itemId: string; checked: boolean };
    const data = await groceryService.toggleItem(body.itemId, body.checked);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update grocery list"
      },
      { status: 400 }
    );
  }
}
