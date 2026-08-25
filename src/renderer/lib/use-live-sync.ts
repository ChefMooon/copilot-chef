import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getPlatform } from "./platform";

import {
  invalidateDataManagementQueries,
  invalidateQueriesForEntity,
} from "./query-invalidation";
import {
  resyncAfterInterruption,
  startSyncStream,
  stopSyncStream,
  type SyncFrame,
  type SyncStreamStatus,
} from "./sync-stream";

/**
 * Subscribes the app to the server's live-sync channel and translates
 * change events into React Query invalidations. Exactly one stream runs per
 * app instance (guarded inside sync-stream.ts), so this hook is safe to mount
 * in a layout provider even under React strict mode.
 */
export function useLiveSync(enabled: boolean): SyncStreamStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStreamStatus>("connecting");
  const statusRef = useRef<SyncStreamStatus>("connecting");

  useEffect(() => {
    if (!enabled) return;
    const platform = getPlatform();

    const updateStatus = (nextStatus: SyncStreamStatus) => {
      statusRef.current = nextStatus;
      setStatus(nextStatus);
    };

    const onFrame = (frame: SyncFrame) => {
      if (frame.kind === "change") {
        if (frame.entity === "__sweep__") {
          void invalidateDataManagementQueries(queryClient);
        } else {
          void invalidateQueriesForEntity(queryClient, frame.entity);
        }
      }
    };

    const stop = startSyncStream({ onStatus: updateStatus, onFrame });
    const unsubscribeShutdown =
      platform.subscribeShutdown?.(stopSyncStream) ?? (() => {});
    const resync = () => {
      if (statusRef.current === "live") return;
      void invalidateDataManagementQueries(queryClient);
      resyncAfterInterruption({ onStatus: updateStatus, onFrame });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") resync();
    };

    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribeShutdown();
      stop();
    };
  }, [enabled, queryClient]);

  return status;
}

export type { SyncStreamStatus };
