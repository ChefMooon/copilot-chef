import { useEffect, useState } from "react";

import { useChatContext } from "@/context/chat-context";
import { getCachedConfig } from "@/lib/config";

import styles from "./ChatPanel.module.css";

type SessionSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage: { role: string; content: string; createdAt: string } | null;
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getApiBase() {
  return getCachedConfig()?.url ?? "http://localhost:3001";
}

function getAuthHeaders(): Record<string, string> {
  const apiKey = getCachedConfig()?.token ?? "";
  if (!apiKey) return {};
  return { "Authorization": `Bearer ${apiKey}` };
}

export function SessionBrowser() {
  const { loadSession, clearSession } = useChatContext();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${getApiBase()}/api/chat-sessions`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(({ data }: { data: SessionSummary[] }) => setSessions(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    await fetch(`${getApiBase()}/api/chat-sessions/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className={styles.sessionBrowser}>
      <div className={styles.sessionBrowserHeader}>
        <span className={styles.sessionBrowserTitle}>Chat History</span>
        <button
          className={styles.newChatBtn}
          onClick={clearSession}
          type="button"
        >
          + New Chat
        </button>
      </div>

      {loading ? (
        <div className={styles.sessionLoading}>Loading…</div>
      ) : sessions.length === 0 ? (
        <div className={styles.sessionEmpty}>No previous chats yet</div>
      ) : (
        <ul className={styles.sessionList}>
          {sessions.map((session) => (
            <li
              className={styles.sessionItem}
              key={session.id}
              onClick={() => void loadSession(session.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadSession(session.id);
              }}
            >
              <div className={styles.sessionItemMain}>
                <span className={styles.sessionItemTitle}>
                  {session.title?.trim() || "Chat session"}
                </span>
                <span className={styles.sessionItemTime}>
                  {relativeTime(session.updatedAt)}
                </span>
              </div>
              {session.lastMessage ? (
                <span className={styles.sessionItemPreview}>
                  {session.lastMessage.content.slice(0, 72)}
                  {session.lastMessage.content.length > 72 ? "…" : ""}
                </span>
              ) : null}
              <button
                aria-label="Delete session"
                className={styles.sessionDeleteBtn}
                onClick={(e) => void handleDelete(session.id, e)}
                type="button"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
