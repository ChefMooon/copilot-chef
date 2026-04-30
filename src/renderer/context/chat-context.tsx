import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { type PageContext, serializePageContext } from "./page-context-types";
import {
  getActivePageContext,
  getMinimalContextForPath,
} from "./page-context-routing";
import { getCachedConfig } from "@/lib/config";
import { createUuid } from "@/lib/uuid";

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

export type PendingInputRequest = {
  requestId: string;
  question: string;
  choices: string[];
  allowFreeform: boolean;
  retryCount: number;
};

interface ChatContextValue {
  isOpen: boolean;
  size: ChatSize;
  messages: ChatMessageWithChoices[];
  isTyping: boolean;
  streamingMessage: string;
  showSessionBrowser: boolean;
  pendingInputRequest: PendingInputRequest | null;
  openChat: () => void;
  closeChat: () => void;
  setSize: (s: ChatSize) => void;
  sendMessage: (text: string) => Promise<void>;
  setPageContext: (ctx: PageContext) => void;
  toggleSessionBrowser: () => void;
  loadSession: (chatSessionId: string) => Promise<void>;
  clearSession: () => void;
  respondToInputRequest: (answer: string, wasFreeform: boolean) => Promise<void>;
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

const SENTINEL_PREFIX = "\x00COPILOT_CHEF_EVENT\x00";

function getApiUrl(path: string): string {
  const config = getCachedConfig();
  const base = config?.url ?? "http://127.0.0.1:3001";
  return `${base}${path}`;
}

function getAuthHeaders(): Record<string, string> {
  const config = getCachedConfig();
  const token = config?.token ?? "";
  if (!token) return {};
  return { "Authorization": `Bearer ${token}` };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const pathname = location.pathname;
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [size, setSize] = useState<ChatSize>("compact");
  const [messages, setMessages] = useState<ChatMessageWithChoices[]>([
    INITIAL_MESSAGE,
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [copilotSessionId, setCopilotSessionId] = useState<
    string | undefined
  >();
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);
  const [pendingInputRequest, setPendingInputRequest] =
    useState<PendingInputRequest | null>(null);

  const pageContextRef = useRef<PageContext | null>(null);
  const pageContextPathRef = useRef<string | null>(null);

  const setPageContext = useCallback((ctx: PageContext) => {
    pageContextRef.current = ctx;
    pageContextPathRef.current = pathname;
  }, [pathname]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      if (pendingInputRequest) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Please answer the active follow-up question before sending a new message.",
            choices: [],
          },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { role: "user", text }]);
      setIsTyping(true);
      setStreamingMessage("");

      const activePageContext = getActivePageContext(
        pathname,
        pageContextRef.current,
        pageContextPathRef.current
      );
      const pageContextStr = activePageContext
        ? serializePageContext(activePageContext)
        : getMinimalContextForPath(pathname);

      try {
        const response = await fetch(getApiUrl("/api/chat"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            message: text,
            sessionId: copilotSessionId,
            pageContext: pageContextStr,
            pageContextData: activePageContext,
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
            status?: "ok" | "needs_input";
            needsInput?: {
              requestId: string;
              question: string;
              choices: string[];
              allowFreeform: boolean;
              retryCount?: number;
            };
            action?: {
              domain: "meal" | "grocery" | "recipe";
            };
          };
          if (payload.sessionId) setCopilotSessionId(payload.sessionId);
          if (payload.chatSessionId && !chatSessionId)
            setChatSessionId(payload.chatSessionId);

          if (payload.action?.domain === "meal") {
            await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
            await queryClient.refetchQueries({
              queryKey: ["meals"],
              exact: false,
              type: "active",
            });
          }
          if (payload.action?.domain === "grocery") {
            await queryClient.invalidateQueries({
              queryKey: ["grocery-lists"],
              exact: false,
            });
          }
          if (payload.action?.domain === "recipe") {
            await queryClient.invalidateQueries({
              queryKey: ["recipes"],
              exact: false,
            });
          }

          if (payload.needsInput) {
            setPendingInputRequest({
              requestId: payload.needsInput.requestId,
              question: payload.needsInput.question,
              choices: payload.needsInput.choices,
              allowFreeform: payload.needsInput.allowFreeform,
              retryCount: payload.needsInput.retryCount ?? 0,
            });
          } else {
            setPendingInputRequest(null);
          }

          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: payload.message.trim(),
              choices: payload.choices ?? [],
            },
          ]);
          return;
        }

        if (!response.body) {
          throw new Error("Chat request failed");
        }

        const newCopilotSessionId = response.headers.get("x-session-id");
        const newChatSessionId = response.headers.get("x-chat-session-id");

        if (newCopilotSessionId) setCopilotSessionId(newCopilotSessionId);
        if (newChatSessionId && !chatSessionId)
          setChatSessionId(newChatSessionId);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";
        let sentinelBuffer = "";
        const updatedDomains = new Set<"meal" | "grocery" | "recipe">();
        setIsTyping(false);

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          let chunk = decoder.decode(value, { stream: true });

          if (sentinelBuffer) {
            chunk = sentinelBuffer + chunk;
            sentinelBuffer = "";
          }

          let sentinelIdx = chunk.indexOf(SENTINEL_PREFIX);
          while (sentinelIdx >= 0) {
            if (sentinelIdx > 0) {
              assistantText += chunk.slice(0, sentinelIdx);
              setStreamingMessage(assistantText);
            }

            const afterPrefix = chunk.slice(
              sentinelIdx + SENTINEL_PREFIX.length
            );
            const closeBrace = afterPrefix.indexOf("}");
            if (closeBrace < 0) {
              sentinelBuffer = chunk.slice(sentinelIdx);
              chunk = "";
              break;
            }

            const jsonStr = afterPrefix.slice(0, closeBrace + 1);
            try {
              const event = JSON.parse(jsonStr) as {
                type: string;
                question: string;
                choices: string[];
                allowFreeform: boolean;
                domain?: string;
              };
              if (event.type === "input_request") {
                setPendingInputRequest({
                  requestId: createUuid(),
                  question: event.question,
                  choices: event.choices,
                  allowFreeform: event.allowFreeform,
                  retryCount: 0,
                });
              } else if (
                event.type === "domain_update" &&
                (event.domain === "meal" ||
                  event.domain === "grocery" ||
                  event.domain === "recipe")
              ) {
                updatedDomains.add(event.domain);
              }
            } catch {
              // Malformed sentinel — skip
            }

            chunk = afterPrefix.slice(closeBrace + 1);
            sentinelIdx = chunk.indexOf(SENTINEL_PREFIX);
          }

          if (chunk) {
            assistantText += chunk;
            setStreamingMessage(assistantText);
          }
        }
        assistantText += decoder.decode();

        if (updatedDomains.has("meal")) {
          await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
          await queryClient.refetchQueries({
            queryKey: ["meals"],
            exact: false,
            type: "active",
          });
        }
        if (updatedDomains.has("grocery")) {
          await queryClient.invalidateQueries({ queryKey: ["grocery-lists"], exact: false });
        }
        if (updatedDomains.has("recipe")) {
          await queryClient.invalidateQueries({ queryKey: ["recipes"], exact: false });
        }

        if (pathname === "/meal-plan" && updatedDomains.size === 0) {
          await queryClient.invalidateQueries({ queryKey: ["meals"], exact: false });
          await queryClient.refetchQueries({
            queryKey: ["meals"],
            exact: false,
            type: "active",
          });
        }

        const finalAssistantText = assistantText.trim()
          ? assistantText.trim()
          : updatedDomains.size > 0
            ? "Done. I applied your update."
            : "Done.";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: finalAssistantText, choices: [] },
        ]);
        setStreamingMessage("");
      } catch {
        setIsTyping(false);
        setStreamingMessage("");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Something went wrong. Please try again.",
            choices: [],
          },
        ]);
      }
    },
    [pathname, copilotSessionId, chatSessionId, pendingInputRequest, queryClient]
  );

  const loadSession = useCallback(async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/chat-sessions/${id}`), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return;
      const { data } = (await response.json()) as {
        data: {
          id: string;
          copilotSessionId: string | null;
          pendingInput: {
            requestId: string;
            question: string;
            choices: string[];
            allowFreeform: boolean;
            retryCount: number;
          } | null;
          messages: Array<{ role: "user" | "assistant"; content: string }>;
        };
      };
      setChatSessionId(data.id);
      setCopilotSessionId(data.copilotSessionId ?? undefined);
      setPendingInputRequest(
        data.pendingInput
          ? {
              requestId: data.pendingInput.requestId,
              question: data.pendingInput.question,
              choices: data.pendingInput.choices,
              allowFreeform: data.pendingInput.allowFreeform,
              retryCount: data.pendingInput.retryCount,
            }
          : null
      );
      setMessages([
        INITIAL_MESSAGE,
        ...data.messages.map((m) => ({
          role: m.role,
          text: m.content,
          choices: [],
        })),
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
    setPendingInputRequest(null);
    setShowSessionBrowser(false);
  }, []);

  const respondToInputRequest = useCallback(
    async (answer: string, wasFreeform: boolean) => {
      if (!copilotSessionId || !chatSessionId) {
        return;
      }

      const currentPending = pendingInputRequest;
      const maxRetries = 3;
      let attemptedReset = false;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          const response = await fetch(
            getApiUrl("/api/chat/respond-to-input"),
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders(),
              },
              body: JSON.stringify({
                sessionId: copilotSessionId,
                chatSessionId,
                answer,
                wasFreeform,
              }),
            }
          );

          if (response.ok) {
            setPendingInputRequest(null);
            return;
          }

          if (response.status === 401 || response.status === 403) {
            throw new Error("Authentication failed while resolving your input.");
          }

          if (response.status === 404 && !attemptedReset) {
            attemptedReset = true;
            setCopilotSessionId(undefined);
            continue;
          }

          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < maxRetries
          ) {
            const backoffMs = 250 * 2 ** attempt;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          throw new Error(
            `Failed to resolve input request (${response.status})`
          );
        } catch (error) {
          if (attempt < maxRetries) {
            const backoffMs = 250 * 2 ** attempt;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          setPendingInputRequest(currentPending ?? null);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text:
                error instanceof Error
                  ? error.message
                  : "I couldn't process that response right now. Please try again.",
              choices: [],
            },
          ]);
          return;
        }
      }
    },
    [chatSessionId, copilotSessionId, pendingInputRequest]
  );

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        size,
        messages,
        isTyping,
        streamingMessage,
        showSessionBrowser,
        pendingInputRequest,
        openChat: () => setIsOpen(true),
        closeChat: () => setIsOpen(false),
        setSize,
        sendMessage,
        setPageContext,
        toggleSessionBrowser: () => setShowSessionBrowser((prev) => !prev),
        loadSession,
        clearSession,
        respondToInputRequest,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatPageContext(ctx: PageContext) {
  const { setPageContext } = useChatContext();
  const ctxStr = JSON.stringify(ctx);
  useEffect(() => {
    setPageContext(JSON.parse(ctxStr) as PageContext);
  }, [ctxStr, setPageContext]);
}
