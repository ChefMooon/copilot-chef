import { GroceryService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const groceryService = new GroceryService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { itemIds: string[] };

    if (!Array.isArray(body.itemIds)) {
      throw new Error("itemIds must be an array");
    }

    const data = await groceryService.reorderGroceryItems(id, body.itemIds);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reorder grocery items",
      },
      { status: 400 }
    );
  }
}
