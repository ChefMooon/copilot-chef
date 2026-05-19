import { Suspense, lazy } from "react";

import { useChatContext } from "@/context/chat-context";

import styles from "./ChatWidget.module.css";

const ChatPanel = lazy(async () => {
  const module = await import("./ChatPanel");
  return { default: module.ChatPanel };
});

export function ChatWidget() {
  const { isOpen, openChat } = useChatContext();

  return (
    <>
      {isOpen ? (
        <Suspense fallback={null}>
          <ChatPanel />
        </Suspense>
      ) : null}
      {!isOpen && (
        <button
          aria-label="Open Copilot Chef chat"
          className={styles.fab}
          data-print-hidden="true"
          onClick={openChat}
          title="Chat with Copilot Chef"
          type="button"
        >
          🍳
        </button>
      )}
    </>
  );
}
