import { type ConnectionStatus } from "@/lib/connection";
import { type SyncStreamStatus } from "@/lib/sync-stream";

import styles from "./connection-banner.module.css";

interface ConnectionBannerProps {
  status: ConnectionStatus;
  onRetry: () => void;
  syncStatus?: SyncStreamStatus;
}

const SYNC_STATUS_LABELS: Record<SyncStreamStatus, string> = {
  connecting: "Live sync connecting…",
  live: "",
  retrying: "Live sync reconnecting…",
  polling: "Live sync in compatibility mode (polling)…",
};

export function ConnectionBanner({ status, onRetry, syncStatus }: ConnectionBannerProps) {
  const syncMessage = syncStatus ? SYNC_STATUS_LABELS[syncStatus] : "";

  if (status === "connected" && !syncMessage) return null;

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.dot} data-status={status} />
      <span className={styles.message}>
        {status === "connected"
          ? syncMessage
          : status === "connecting"
            ? "Connecting to server…"
            : "Server connection lost. Retrying…"}
      </span>
      {status === "disconnected" && (
        <button className={styles.retryBtn} onClick={onRetry} type="button">
          Retry now
        </button>
      )}
    </div>
  );
}
