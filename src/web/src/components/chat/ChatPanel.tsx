"use client";

import { useEffect, useRef, useState } from "react";

import { useChatContext, type ChatSize } from "@/context/chat-context";

import { SessionBrowser } from "./SessionBrowser";
import { SlashCommandMenu } from "./SlashCommandMenu";
import type { SlashCommand } from "./slash-commands";
import styles from "./ChatPanel.module.css";

const SIZE_ICONS: Record<ChatSize, string> = {
  compact: "▬",
  medium: "◻",
  fullscreen: "⤢",
};

const SIZE_LABELS: Record<ChatSize, string> = {
  compact: "Compact",
  medium: "Medium",
  fullscreen: "Fullscreen",
};

export function ChatPanel() {
  const {
    size,
    setSize,
    messages,
    isTyping,
    streamingMessage,
    showSessionBrowser,
    toggleSessionBrowser,
    closeChat,
    sendMessage,
    clearSession,
  } = useChatContext();

  const [input, setInput] = useState("");
  const [showSlash, setShowSlash] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, streamingMessage]);

  function handleInputChange(value: string) {
    setInput(value);
    setShowSlash(value.startsWith("/"));
  }

  function handleSlashSelect(cmd: SlashCommand) {
    setInput("");
    setShowSlash(false);
    void sendMessage(cmd.prompt);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isTyping) return;
    setInput("");
    setShowSlash(false);
    void sendMessage(text);
  }

  const panelSizeClass =
    size === "compact"
      ? styles.panelCompact
      : size === "medium"
        ? styles.panelMedium
        : styles.panelFullscreen;

  return (
    <div
      className={`${styles.panel} ${panelSizeClass}`}
      role="dialog"
      aria-label="Copilot Chef chat"
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerAvatar}>🤖</span>
          <span className={styles.headerTitle}>Copilot Chef</span>
        </div>
        <div className={styles.headerActions}>
          <button
            aria-label="Chat history"
            className={`${styles.iconBtn} ${showSessionBrowser ? styles.iconBtnActive : ""}`}
            onClick={toggleSessionBrowser}
            title="Chat history"
            type="button"
          >
            🕐
          </button>
          <button
            aria-label="New chat"
            className={styles.iconBtn}
            onClick={clearSession}
            title="New chat"
            type="button"
          >
            ✏️
          </button>
          {(["compact", "medium", "fullscreen"] as const).map((s) => (
            <button
              aria-label={`${SIZE_LABELS[s]} size`}
              className={`${styles.sizeBtn} ${size === s ? styles.sizeBtnActive : ""}`}
              key={s}
              onClick={() => setSize(s)}
              title={SIZE_LABELS[s]}
              type="button"
            >
              {SIZE_ICONS[s]}
            </button>
          ))}
          <button
            aria-label="Close chat"
            className={styles.iconBtn}
            onClick={closeChat}
            title="Close"
            type="button"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {showSessionBrowser ? (
          <SessionBrowser />
        ) : (
          <div className={styles.messages} role="log" aria-live="polite">
            {messages.map((msg, idx) => (
              <div
                className={`${styles.bubble} ${msg.role === "assistant" ? styles.assistantBubble : styles.userBubble}`}
                key={idx}
              >
                {msg.text}
                {msg.role === "assistant" &&
                msg.choices &&
                msg.choices.length > 0 ? (
                  <div className={styles.inlineChoices}>
                    {msg.choices.map((choice) => (
                      <button
                        className={styles.inlineChoiceBtn}
                        key={choice.id}
                        onClick={() => void sendMessage(choice.prompt)}
                        type="button"
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {isTyping ? (
              <div aria-label="Typing" className={styles.typingIndicator}>
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
              </div>
            ) : null}

            {streamingMessage ? (
              <div className={`${styles.bubble} ${styles.assistantBubble}`}>
                {streamingMessage}
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area — hidden when session browser is open */}
      {!showSessionBrowser ? (
        <div className={styles.inputArea}>
          {showSlash ? (
            <SlashCommandMenu
              onClose={() => setShowSlash(false)}
              onSelect={handleSlashSelect}
              query={input.slice(1)}
            />
          ) : null}
          <div className={styles.inputRow}>
            <textarea
              aria-label="Chat message"
              className={styles.chatInput}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !showSlash) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask me anything… or type / for commands"
              ref={textareaRef}
              rows={1}
              value={input}
            />
            <button
              aria-label="Send message"
              className={styles.sendBtn}
              disabled={!input.trim() || isTyping}
              onClick={handleSend}
              type="button"
            >
              ➤
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
