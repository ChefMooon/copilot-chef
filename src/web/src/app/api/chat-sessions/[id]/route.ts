import { ChatHistoryService } from "@copilot-chef/core";
import { type NextRequest, NextResponse } from "next/server";

import { MachineAuthError, requireCallerIdentity } from "@/lib/machine-auth";

const historyService = new ChatHistoryService();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const identity = requireCallerIdentity(request);
    const { id } = await context.params;
    const data = await historyService.getSession(identity.callerId, id);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof MachineAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Unable to load session";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const identity = requireCallerIdentity(request);
    const { id } = await context.params;
    const data = await historyService.deleteSession(identity.callerId, id);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof MachineAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to delete session",
      },
      { status: 400 }
    );
  }
}
