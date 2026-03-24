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
  const startedAt = Date.now();

  let responseStatus = 500;
  const retries = 0;
  let hasSessionId = false;
  let hasChatSessionId = false;
  let ownerId = "web-default";
  let parsedBody: z.infer<typeof bodySchema> | null = null;

  try {
    const identity = requireMachineCallerIdentity(request);
    ownerId = identity.callerId;

    const body = await request.json();
    parsedBody = bodySchema.parse(body);
    hasSessionId = Boolean(parsedBody.sessionId);
    hasChatSessionId = Boolean(parsedBody.chatSessionId);

    const session = await historyService.getSession(ownerId, parsedBody.chatSessionId);
    if (!session || session.copilotSessionId !== parsedBody.sessionId) {
      try {
        await historyService.clearPendingInputState(ownerId, parsedBody.chatSessionId);
      } catch {
        // best-effort for already-missing sessions
      }
      responseStatus = 404;
      return NextResponse.json(
        {
          error: "Session expired",
          retryable: true,
          retryPolicy: "retry_once_after_reset",
          requestId,
        },
        { status: 404 }
      );
    }

    await historyService.markPendingInputAttempt(ownerId, parsedBody.chatSessionId, {
      requestId,
      state: "completing_input",
    });

    chef.resolveInputRequest(
      parsedBody.sessionId,
      parsedBody.answer,
      parsedBody.wasFreeform
    );

    await historyService.clearPendingInputState(ownerId, parsedBody.chatSessionId);
    await historyService.setSessionState(ownerId, parsedBody.chatSessionId, "completed");

    responseStatus = 200;
    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    if (parsedBody?.chatSessionId) {
      try {
        await historyService.markPendingInputAttempt(ownerId, parsedBody.chatSessionId, {
          requestId,
          errorCode: "resolve_failed",
          incrementRetry: true,
          state: "failed",
        });
      } catch {
        // best-effort state update
      }
    }

    if (error instanceof MachineAuthError) {
      responseStatus = error.status;
      return NextResponse.json(
        { error: error.message, requestId },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unable to resolve input request";
    responseStatus = 400;
    return NextResponse.json({ error: message, requestId }, { status: 400 });
  } finally {
    console.info("[chat-respond-to-input] outcome", {
      requestId,
      endpoint: "/api/chat/respond-to-input",
      statusCode: responseStatus,
      responseMode: "json",
      latencyMs: Date.now() - startedAt,
      retries,
      hadPendingInput: true,
      hasSessionId,
      hasChatSessionId,
    });
  }
}
