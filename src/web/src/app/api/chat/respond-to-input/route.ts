import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { chef, historyService } from "@/lib/chat-singletons";
import { MachineAuthError, requireMachineCallerIdentity } from "@/lib/machine-auth";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  chatSessionId: z.string().min(1),
  answer: z.string().min(1),
  wasFreeform: z.boolean(),
});

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const identity = requireMachineCallerIdentity(request);
    const body = await request.json();
    const parsed = bodySchema.parse(body);

    const session = await historyService.getSession(
      identity.callerId,
      parsed.chatSessionId
    );
    if (!session || session.copilotSessionId !== parsed.sessionId) {
      return NextResponse.json(
        { error: "Session not found", requestId },
        { status: 404 }
      );
    }

    console.info("[chat-respond-to-input] resolve", {
      requestId,
      callerId: identity.callerId,
      sessionId: parsed.sessionId,
      chatSessionId: parsed.chatSessionId,
    });

    chef.resolveInputRequest(parsed.sessionId, parsed.answer, parsed.wasFreeform);
    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    if (error instanceof MachineAuthError) {
      return NextResponse.json(
        { error: error.message, requestId },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unable to resolve input request";
    return NextResponse.json({ error: message, requestId }, { status: 400 });
  }
}
