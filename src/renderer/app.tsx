import { Outlet } from "react-router";
import { useEffect, useState } from "react";

import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import { ConnectionBanner } from "@/components/layout/connection-banner";
import { useServerConnection } from "@/lib/connection";
import {
  ConfigNotReadyError,
  isServerConfigReady,
  loadServerConfig,
  subscribeConfigUpdates,
} from "@/lib/config";
import { getBrowserConnection, getPlatform } from "@/lib/platform";

type ServerConfig = {
  url: string;
  token: string;
  mode: "local" | "remote";
};

function AppContent({ config }: { config: ServerConfig }) {
  const { status, retry } = useServerConnection(config.url);

  return (
    <>
      <ConnectionBanner status={status} onRetry={retry} />
      <AppShell>
        <Outlet />
      </AppShell>
    </>
  );
}

export function AppLayout() {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [configVersion, setConfigVersion] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;

    const loadConfig = async (attempt = 0) => {
      try {
        const cfg = await loadServerConfig();
        if (cancelled) {
          return;
        }
        setLoadError(null);
        setConfig(cfg);
        setConfigVersion((version) => version + 1);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const isBrowser = getPlatform().runtime === "browser";
        const onConnectRoute = window.location.pathname.startsWith("/connect");

        if (isBrowser && !getBrowserConnection() && !onConnectRoute) {
          window.location.replace("/connect");
          return;
        }

        const shouldRetry =
          attempt < 5 &&
          (!(error instanceof ConfigNotReadyError) ||
            (isBrowser && onConnectRoute));

        if (shouldRetry) {
          retryTimer = window.setTimeout(() => {
            void loadConfig(attempt + 1);
          }, 750);
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load app configuration."
        );
      }
    };

    if (
      getPlatform().runtime === "browser" &&
      !getBrowserConnection() &&
      !window.location.pathname.startsWith("/connect")
    ) {
      window.location.replace("/connect");
      return;
    }

    void loadConfig();

    const unsubscribe = subscribeConfigUpdates(() => {
      void loadConfig();
    });

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      unsubscribe();
    };
  }, []);

  if (!isServerConfigReady(config)) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "system-ui, sans-serif",
          color: "var(--text-muted)",
        }}
      >
        {loadError ?? "Loading..."}
      </div>
    );
  }

  return (
    <QueryProvider key={configVersion}>
      <ToastProvider>
        <AppContent config={config} />
      </ToastProvider>
    </QueryProvider>
  );
}
