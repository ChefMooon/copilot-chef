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
    return NextResponse.json(
      { error: "Grocery list not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      date?: string;
      favourite?: boolean;
    };

    const data = await groceryService.updateGroceryList(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update grocery list",
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
    const data = await groceryService.deleteGroceryList(id);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update grocery list",
      },
      { status: 400 }
    );
  }
}
