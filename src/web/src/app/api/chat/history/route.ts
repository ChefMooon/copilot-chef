import { ChatHistoryService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

import { MachineAuthError, requireCallerIdentity } from "@/lib/machine-auth";

const historyService = new ChatHistoryService();

export async function DELETE(request: Request) {
  try {
    const identity = requireCallerIdentity(request);
    const data = await historyService.clearHistory(identity.callerId);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof MachineAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to clear chat history",
      },
      { status: 400 }
    );
  }
}
