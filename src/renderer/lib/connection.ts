import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

const BACKOFF_CAPS_MS = [100, 200, 400, 800, 1600, 3200, 5000];

function getBackoffDelay(attempt: number): number {
  return BACKOFF_CAPS_MS[Math.min(attempt, BACKOFF_CAPS_MS.length - 1)];
}

export function useServerConnection(serverUrl: string) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const attemptRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<ConnectionStatus>("connecting");
  const mountedRef = useRef(false);

  const checkHealth = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${serverUrl}/api/health`, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.ok) {
        setStatus("connected");
        statusRef.current = "connected";
        attemptRef.current = 0;
        return;
      }
    } catch {
      if (controller.signal.aborted || !mountedRef.current) return;
    }

    if (controller.signal.aborted || !mountedRef.current) return;

    setStatus("disconnected");
    statusRef.current = "disconnected";
    const delay = getBackoffDelay(attemptRef.current);
    attemptRef.current++;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setStatus("connecting");
      statusRef.current = "connecting";
      void checkHealth();
    }, delay);
  }, [serverUrl]);

  const retry = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    attemptRef.current = 0;
    setStatus("connecting");
    statusRef.current = "connecting";
    void checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    mountedRef.current = true;
    void checkHealth();

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [checkHealth]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && statusRef.current !== "connected") {
        retry();
      }
    };

    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [retry]);

  return { status, retry };
}
