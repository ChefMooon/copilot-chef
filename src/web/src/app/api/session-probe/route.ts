import { NextRequest, NextResponse } from "next/server";

import { historyService } from "@/lib/chat-singletons";
import { MachineAuthError, requireMachineCallerIdentity } from "@/lib/machine-auth";

/**
 * GET /api/session-probe?chatSessionId=<id>
 *
 * Checks whether a chat session has a live copilotSessionId mapping in the
 * database. Used after a process restart to verify session state before
 * attempting to resume a conversation.
 *
 * Statuses:
 *   "not_found"    — chatSessionId not found for this caller
 *   "disconnected" — session exists but copilotSessionId is null (ended)
 *   "resumable"    — session exists with a copilotSessionId ready to resume
 */
export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const identity = requireMachineCallerIdentity(request);
    const { searchParams } = new URL(request.url);
    const chatSessionId = searchParams.get("chatSessionId");

    if (!chatSessionId) {
      return NextResponse.json(
        { error: "chatSessionId query parameter is required", requestId },
        { status: 400 }
      );
    }

    const session = await historyService.getSession(identity.callerId, chatSessionId);
    if (!session) {
      return NextResponse.json({ status: "not_found", chatSessionId, requestId });
    }

    if (!session.copilotSessionId) {
      return NextResponse.json({ status: "disconnected", chatSessionId, requestId });
    }

    return NextResponse.json({
      status: "resumable",
      sessionId: session.copilotSessionId,
      chatSessionId,
      requestId,
    });
  } catch (error) {
    if (error instanceof MachineAuthError) {
      return NextResponse.json(
        { error: error.message, requestId },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : "Probe failed";
    return NextResponse.json({ error: message, requestId }, { status: 400 });
  }
}
