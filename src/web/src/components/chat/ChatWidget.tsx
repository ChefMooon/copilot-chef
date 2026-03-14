"use client";

import { useChatContext } from "@/context/chat-context";

import { ChatPanel } from "./ChatPanel";
import styles from "./ChatWidget.module.css";

export function ChatWidget() {
  const { isOpen, openChat, closeChat } = useChatContext();

  return (
    <>
      {isOpen ? <ChatPanel /> : null}
      <button
        aria-label={isOpen ? "Close Copilot Chef chat" : "Open Copilot Chef chat"}
        className={`${styles.fab} ${isOpen ? styles.fabOpen : ""}`}
        onClick={() => (isOpen ? closeChat() : openChat())}
        title={isOpen ? "Close chat" : "Chat with Copilot Chef"}
        type="button"
      >
        {isOpen ? "✕" : "💬"}
      </button>
    </>
  );
}
