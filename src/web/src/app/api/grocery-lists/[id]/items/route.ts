import { GroceryService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const groceryService = new GroceryService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      name: string;
      qty?: string;
      unit?: string;
      category?: string;
      notes?: string;
      meal?: string;
      checked?: boolean;
    };

    const data = await groceryService.createGroceryItem(id, body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create grocery item"
      },
      { status: 400 }
    );
  }
}
