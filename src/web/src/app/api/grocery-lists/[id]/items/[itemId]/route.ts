import { GroceryService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const groceryService = new GroceryService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const body = (await request.json()) as {
      name?: string;
      qty?: string | null;
      unit?: string | null;
      category?: string;
      notes?: string | null;
      meal?: string | null;
      checked?: boolean;
    };

    const data = await groceryService.updateGroceryItem(id, itemId, body);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update grocery item",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const data = await groceryService.deleteGroceryItem(id, itemId);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete grocery item",
      },
      { status: 400 }
    );
  }
}
