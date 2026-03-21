import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { chef, historyService } from "@/lib/chat-singletons";
import { MachineAuthError, requireCallerIdentity } from "@/lib/machine-auth";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  chatSessionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const identity = requireCallerIdentity(request);
    const body = await request.json();
    const parsed = bodySchema.parse(body);

    const session = await historyService.getSession(
      identity.callerId,
      parsed.chatSessionId
    );
    if (!session) {
      return NextResponse.json(
        { error: "Session not found", requestId },
        { status: 404 }
      );
    }

    if (session.copilotSessionId && session.copilotSessionId !== parsed.sessionId) {
      return NextResponse.json(
        { error: "Session not found", requestId },
        { status: 404 }
      );
    }

    if (!session.copilotSessionId) {
      return NextResponse.json({ ok: true, requestId, alreadyEnded: true });
    }

    const ended = await chef.endSession(parsed.sessionId);
    await historyService.clearCopilotSessionId(
      identity.callerId,
      parsed.chatSessionId
    );

    console.info("[chat-end-session] ended", {
      requestId,
      callerId: identity.callerId,
      sessionId: parsed.sessionId,
      chatSessionId: parsed.chatSessionId,
    });

    return NextResponse.json({ ok: true, requestId, endedAt: ended.endedAt });
  } catch (error) {
    if (error instanceof MachineAuthError) {
      return NextResponse.json(
        { error: error.message, requestId },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unable to end session";
    return NextResponse.json({ error: message, requestId }, { status: 400 });
  }
}
