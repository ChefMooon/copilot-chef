"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { type PageContext, serializePageContext } from "./page-context-types";

export type ChatSize = "compact" | "medium" | "fullscreen";

export type ChatChoice = {
  id: string;
  label: string;
  prompt: string;
};

export type ChatMessageWithChoices = {
  role: "user" | "assistant";
  text: string;
  choices?: ChatChoice[];
};

interface ChatContextValue {
  isOpen: boolean;
  size: ChatSize;
  messages: ChatMessageWithChoices[];
  isTyping: boolean;
  streamingMessage: string;
  showSessionBrowser: boolean;
  openChat: () => void;
  closeChat: () => void;
  setSize: (s: ChatSize) => void;
  sendMessage: (text: string) => Promise<void>;
  setPageContext: (ctx: PageContext) => void;
  toggleSessionBrowser: () => void;
  loadSession: (chatSessionId: string) => Promise<void>;
  clearSession: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

const INITIAL_MESSAGE: ChatMessageWithChoices = {
  role: "assistant",
  text: "Hey Chef! I'm your Copilot. Ask me to plan meals, build a grocery list, suggest recipes, or swap anything on your plan. Type / to see available commands.",
};

function getMinimalContextForPath(path: string): string {
  if (path === "/stats") return "The user is on the Stats page, viewing meal activity statistics.";
  if (path === "/settings") return "The user is on the Settings page, managing household preferences.";
  if (path === "/") return "The user is on the Home page.";
  if (path === "/meal-plan") return "The user is on the Meal Plan page.";
  if (path === "/grocery-list") return "The user is on the Grocery List page.";
  return `The user is on the ${path} page.`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [size, setSize] = useState<ChatSize>("compact");
  const [messages, setMessages] = useState<ChatMessageWithChoices[]>([INITIAL_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [copilotSessionId, setCopilotSessionId] = useState<string | undefined>();
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);

  const pageContextRef = useRef<PageContext | null>(null);
  const lastSentPathRef = useRef<string>("");

  const setPageContext = useCallback((ctx: PageContext) => {
    pageContextRef.current = ctx;
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      setMessages((prev) => [...prev, { role: "user", text }]);
      setIsTyping(true);
      setStreamingMessage("");

      // Include page context only when the page has changed since the last send.
      let pageContextStr: string | undefined;
      if (pathname !== lastSentPathRef.current) {
        pageContextStr = pageContextRef.current
          ? serializePageContext(pageContextRef.current)
          : getMinimalContextForPath(pathname);
        lastSentPathRef.current = pathname;
      }

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            sessionId: copilotSessionId,
            pageContext: pageContextStr,
            pageContextData: pageContextRef.current,
            chatSessionId,
          }),
        });

        if (!response.ok) {
          throw new Error("Chat request failed");
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as {
            sessionId?: string;
            chatSessionId?: string;
            message: string;
            choices?: ChatChoice[];
            action?: {
              domain: "meal" | "grocery";
            };
          };
          if (payload.sessionId) setCopilotSessionId(payload.sessionId);
          if (payload.chatSessionId && !chatSessionId) setChatSessionId(payload.chatSessionId);

          if (payload.action?.domain === "meal") {
            await queryClient.invalidateQueries({ queryKey: ["meals"] });
          }
          if (payload.action?.domain === "grocery") {
            await queryClient.invalidateQueries({ queryKey: ["grocery-lists"] });
          }

          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: payload.message.trim(), choices: payload.choices ?? [] },
          ]);
          return;
        }

        if (!response.body) {
          throw new Error("Chat request failed");
        }

        const newCopilotSessionId = response.headers.get("x-session-id");
        const newChatSessionId = response.headers.get("x-chat-session-id");

        if (newCopilotSessionId) setCopilotSessionId(newCopilotSessionId);
        if (newChatSessionId && !chatSessionId) setChatSessionId(newChatSessionId);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";
        setIsTyping(false);

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          assistantText += decoder.decode(value, { stream: true });
          setStreamingMessage(assistantText);
        }
        assistantText += decoder.decode();

        setMessages((prev) => [...prev, { role: "assistant", text: assistantText.trim(), choices: [] }]);
        setStreamingMessage("");
      } catch {
        setIsTyping(false);
        setStreamingMessage("");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Something went wrong. Please try again.", choices: [] },
        ]);
      }
    },
    [pathname, copilotSessionId, chatSessionId, queryClient]
  );

  const loadSession = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/chat-sessions/${id}`);
      if (!response.ok) return;
      const { data } = (await response.json()) as {
        data: {
          id: string;
          messages: Array<{ role: "user" | "assistant"; content: string }>;
        };
      };
      setChatSessionId(data.id);
      setCopilotSessionId(undefined);
      lastSentPathRef.current = "";
      setMessages([
        INITIAL_MESSAGE,
        ...data.messages.map((m) => ({ role: m.role, text: m.content, choices: [] })),
      ]);
      setShowSessionBrowser(false);
    } catch {
      // no-op
    }
  }, []);

  const clearSession = useCallback(() => {
    setCopilotSessionId(undefined);
    setChatSessionId(undefined);
    setMessages([INITIAL_MESSAGE]);
    lastSentPathRef.current = "";
    setShowSessionBrowser(false);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        size,
        messages,
        isTyping,
        streamingMessage,
        showSessionBrowser,
        openChat: () => setIsOpen(true),
        closeChat: () => setIsOpen(false),
        setSize,
        sendMessage,
        setPageContext,
        toggleSessionBrowser: () => setShowSessionBrowser((prev) => !prev),
        loadSession,
        clearSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

/** Register the current page's context so the chat widget can include it. */
export function useChatPageContext(ctx: PageContext) {
  const { setPageContext } = useChatContext();
  const ctxStr = JSON.stringify(ctx);
  useEffect(() => {
    setPageContext(JSON.parse(ctxStr) as PageContext);
  }, [ctxStr]);
}
