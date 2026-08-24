import { getCachedConfig } from "./config";
import { getPlatform } from "./platform";

export type SyncStreamStatus = "connecting" | "live" | "retrying" | "polling";

export type SyncFrame =
  | { kind: "hello"; revision: number }
  | { kind: "change"; entity: string; id?: string; action: string; revision: number }
  | { kind: "heartbeat" };

type SyncStreamCallbacks = {
  onStatus: (status: SyncStreamStatus) => void;
  onFrame: (frame: SyncFrame) => void;
};

const MAX_RAPID_FAILURES = 3;
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const POLL_INTERVAL_MS = 20_000;
const POLL_JITTER_MS = 5_000;

const globalForSync = globalThis as typeof globalThis & {
  __localRecipeBookSyncStream?: {
    started: boolean;
    lastSeenRevision: number | null;
    rapidFailures: number;
    pollTimer: ReturnType<typeof setTimeout> | null;
    retryTimer: ReturnType<typeof setTimeout> | null;
    abortController: AbortController | null;
  };
};

/**
 * Module-level singleton state: exactly one stream per app instance, guarding
 * against React strict-mode double-mounts and duplicate provider mounts.
 */
const syncState =
  globalForSync.__localRecipeBookSyncStream ??
  ({
    started: false,
    lastSeenRevision: null,
    rapidFailures: 0,
    pollTimer: null,
    retryTimer: null,
    abortController: null,
  } as NonNullable<typeof globalForSync.__localRecipeBookSyncStream>);

globalForSync.__localRecipeBookSyncStream = syncState;

function getApiBase(): string {
  const config = getCachedConfig();
  return config?.url?.trim().replace(/\/+$/, "") ?? "";
}

function getAuthHeaders(): Record<string, string> {
  const token = getCachedConfig()?.token?.trim() ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jitter(base: number, spread: number): number {
  return base + Math.random() * spread;
}

function stopPolling(): void {
  if (syncState.pollTimer) {
    clearTimeout(syncState.pollTimer);
    syncState.pollTimer = null;
  }
}

function schedulePoll(callbacks: SyncStreamCallbacks): void {
  stopPolling();
  syncState.pollTimer = setTimeout(() => {
    void pollRevisionOnce(callbacks);
  }, jitter(POLL_INTERVAL_MS, POLL_JITTER_MS));
}

async function pollRevisionOnce(callbacks: SyncStreamCallbacks): Promise<void> {
  try {
    const response = await fetch(`${getApiBase()}/api/sync/revision`, {
      cache: "no-store",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`revision probe failed: ${response.status}`);
    const body = (await response.json()) as { revision: number };
    observeRevision(body.revision, callbacks);
    schedulePoll(callbacks);
  } catch {
    // Server unreachable; keep polling at the same cadence.
    schedulePoll(callbacks);
  }
}

/** Compare a served revision to the last seen value; sweep on any mismatch. */
function observeRevision(
  revision: number,
  callbacks: SyncStreamCallbacks
): void {
  handleRevisionObservation(revision, syncState.lastSeenRevision, (entity) => {
    callbacks.onFrame({ kind: "change", entity, action: "bulk", revision });
  });
  syncState.lastSeenRevision = Math.max(syncState.lastSeenRevision ?? 0, revision);
}

/**
 * Pure decision rule shared by the stream and the poller. A served revision
 * different from last seen triggers a sweep; a LOWER served revision is
 * treated as "unknown" and also sweeps rather than being ignored.
 */
export function handleRevisionObservation(
  revision: number,
  lastSeen: number | null,
  sweep: (entity: string) => void
): void {
  if (lastSeen !== null && lastSeen !== revision) {
    sweep("__sweep__");
  }
}

async function runStream(callbacks: SyncStreamCallbacks): Promise<void> {
  const controller = new AbortController();
  syncState.abortController = controller;

  try {
    const response = await fetch(`${getApiBase()}/api/events`, {
      cache: "no-store",
      headers: { ...getAuthHeaders(), Accept: "text/event-stream" },
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`event stream rejected: ${response.status}`);
    }

    callbacks.onStatus("live");
    syncState.rapidFailures = 0;
    stopPolling();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        let eventName = "message";
        let data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }

        if (eventName === "hello") {
          const parsed = JSON.parse(data) as { revision: number };
          observeRevision(parsed.revision, callbacks);
          syncState.lastSeenRevision = parsed.revision;
          callbacks.onFrame({ kind: "hello", revision: parsed.revision });
        } else if (eventName === "change") {
          const parsed = JSON.parse(data) as {
            entity: string;
            id?: string;
            action: string;
            revision: number;
          };
          syncState.lastSeenRevision = Math.max(
            syncState.lastSeenRevision ?? 0,
            parsed.revision
          );
          callbacks.onFrame({
            kind: "change",
            entity: parsed.entity,
            id: parsed.id,
            action: parsed.action,
            revision: parsed.revision,
          });
        } else if (eventName === "heartbeat") {
          callbacks.onFrame({ kind: "heartbeat" });
        }
      }
    }
  } finally {
    if (syncState.abortController === controller) {
      syncState.abortController = null;
    }
  }
}

function scheduleReconnect(callbacks: SyncStreamCallbacks): void {
  const delay = Math.min(
    BASE_RETRY_DELAY_MS * 2 ** Math.min(syncState.rapidFailures, 5),
    MAX_RETRY_DELAY_MS
  );
  callbacks.onStatus("retrying");
  syncState.retryTimer = setTimeout(() => {
    syncState.retryTimer = null;
    void startInternal(callbacks);
  }, jitter(delay, delay * 0.3));
}

async function startInternal(callbacks: SyncStreamCallbacks): Promise<void> {
  try {
    await runStream(callbacks);
    // Stream ended cleanly (server restart/stop): reconnect with backoff.
    syncState.rapidFailures += 1;
    if (syncState.rapidFailures >= MAX_RAPID_FAILURES) {
      callbacks.onStatus("polling");
      schedulePoll(callbacks);
    }
    scheduleReconnect(callbacks);
  } catch {
    syncState.rapidFailures += 1;
    if (syncState.rapidFailures >= MAX_RAPID_FAILURES) {
      callbacks.onStatus("polling");
      schedulePoll(callbacks);
    }
    scheduleReconnect(callbacks);
  }
}

/**
 * Start the singleton live-sync stream. Subsequent calls are no-ops.
 * Returns a stop function; calling it tears down the stream and polling.
 */
export function startSyncStream(callbacks: SyncStreamCallbacks): () => void {
  if (syncState.started) return () => {};
  syncState.started = true;

  // Browser/PWA only in remote contexts; desktop renderer uses the same API.
  void getPlatform();

  void startInternal(callbacks);

  return () => {
    // Intentionally not stopping on unmount: the stream outlives component
    // lifecycles so strict-mode double-mounts do not churn connections.
  };
}

/** Force a reconnect + full sweep (used on visibility regain while degraded). */
export function resyncAfterInterruption(
  _callbacks: SyncStreamCallbacks
): void {
  syncState.lastSeenRevision = null;
  if (syncState.abortController) {
    syncState.abortController.abort();
  }
}
