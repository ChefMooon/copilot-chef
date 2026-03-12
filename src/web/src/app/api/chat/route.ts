import { CopilotChef, chatRequestSchema } from "@copilot-chef/core";
import { NextResponse } from "next/server";

// Module-level singleton — sessions are preserved for the lifetime of the
// Next.js server process. A new session is created lazily on the first message.
const chef = new CopilotChef();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatRequestSchema.parse(body);

    // chat() creates a Copilot SDK session on the first call (no sessionId),
    // then reuses it for follow-up messages via the returned sessionId.
    const { sessionId, stream } = await chef.chat(
      parsed.message,
      parsed.sessionId ?? undefined
    );

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "x-session-id": sessionId
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to handle chat request";
    const stack = process.env.NODE_ENV !== "production" && error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      { error: message, stack },
      { status: 400 }
    );
  }
}
