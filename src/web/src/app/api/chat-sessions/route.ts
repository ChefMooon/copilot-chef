import { ChatHistoryService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

import { MachineAuthError, requireMachineCallerIdentity } from "@/lib/machine-auth";

const historyService = new ChatHistoryService();

export async function GET(request: Request) {
  try {
    const identity = requireMachineCallerIdentity(request);
    const data = await historyService.listSessions(identity.callerId);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof MachineAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Unable to list sessions";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const identity = requireMachineCallerIdentity(request);
    const body = await request.json().catch(() => ({}));
    const data = await historyService.createSession(identity.callerId, body.title);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof MachineAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create session",
      },
      { status: 400 }
    );
  }
}
