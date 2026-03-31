import { type ConnectionStatus } from "@/lib/connection";

import styles from "./connection-banner.module.css";

interface ConnectionBannerProps {
  status: ConnectionStatus;
  onRetry: () => void;
}

export function ConnectionBanner({ status, onRetry }: ConnectionBannerProps) {
  if (status === "connected") return null;

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.dot} data-status={status} />
      <span className={styles.message}>
        {status === "connecting"
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
