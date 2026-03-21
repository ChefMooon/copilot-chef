import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { chef } from "@/lib/chat-singletons";
import { MachineAuthError, requireCallerIdentity } from "@/lib/machine-auth";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  answer: z.string().min(1),
  wasFreeform: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    requireCallerIdentity(request);
    const body = await request.json();
    const parsed = bodySchema.parse(body);
    chef.resolveInputRequest(parsed.sessionId, parsed.answer, parsed.wasFreeform);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MachineAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Unable to resolve input request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
