import { ChatHistoryService, CopilotChef, PreferenceService, chatRequestSchema } from "@copilot-chef/core";
import { NextResponse } from "next/server";

// Module-level singletons — preserved for the lifetime of the Next.js process.
const chef = new CopilotChef();
const historyService = new ChatHistoryService();
const preferenceService = new PreferenceService();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatRequestSchema.parse(body);

    // Check history persistence preference before calling Copilot.
    const prefs = await preferenceService.getPreferences();
    const shouldPersist = prefs?.persistChatHistory ?? true;

    let activeChatSessionId = parsed.chatSessionId;
    if (shouldPersist) {
      if (!activeChatSessionId) {
        const newSession = await historyService.createSession();
        activeChatSessionId = newSession.id;
      }
      await historyService.addMessage(activeChatSessionId, "user", parsed.message);
    }

    const { sessionId, stream } = await chef.chat(
      parsed.message,
      parsed.sessionId ?? undefined,
      parsed.pageContext
    );

    // Tee the stream: one branch for the client, one to capture and save the full response.
    const [clientStream, captureStream] = stream.tee();

    const snapshotId = activeChatSessionId;
    (async () => {
      const reader = captureStream.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      fullText += decoder.decode();
      if (shouldPersist && snapshotId) {
        await historyService.addMessage(snapshotId, "assistant", fullText.trim());
      }
    })().catch(console.error);

    return new Response(clientStream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "x-session-id": sessionId,
        ...(activeChatSessionId ? { "x-chat-session-id": activeChatSessionId } : {}),
      },
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
