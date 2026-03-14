import { ChatHistoryService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const historyService = new ChatHistoryService();

export async function GET() {
  const data = await historyService.listSessions();
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await historyService.createSession(body.title);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create session",
      },
      { status: 400 }
    );
  }
}
