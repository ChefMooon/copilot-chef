import { useChatContext } from "@/context/chat-context";

import { ChatPanel } from "./ChatPanel";
import styles from "./ChatWidget.module.css";

export function ChatWidget() {
  const { isOpen, openChat } = useChatContext();

  return (
    <>
      {isOpen ? <ChatPanel /> : null}
      {!isOpen && (
        <button
          aria-label="Open Copilot Chef chat"
          className={styles.fab}
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
