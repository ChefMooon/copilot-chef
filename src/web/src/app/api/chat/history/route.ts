import { ChatHistoryService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const historyService = new ChatHistoryService();

export async function DELETE() {
  try {
    const data = await historyService.clearHistory();
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to clear chat history"
      },
      { status: 400 }
    );
  }
}