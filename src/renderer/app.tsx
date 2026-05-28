import { Outlet } from "react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { listMealSubTypeDefinitions, listMealTypeProfiles } from "@/lib/api";

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
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ["meal-types", "profiles"],
      staleTime: 5 * 60 * 1000,
      queryFn: listMealTypeProfiles,
    });
    void queryClient.prefetchQuery({
      queryKey: ["meal-sub-types"],
      staleTime: 5 * 60 * 1000,
      queryFn: listMealSubTypeDefinitions,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ConnectionBanner status={status} onRetry={retry} />
      <AppShell>
        <Outlet />
      </AppShell>
    </>
  );
}

export function PublicBrowserLayout() {
  return (
    <QueryProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </QueryProvider>
  );
}

export function AuthenticatedAppLayout() {
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

        if (isBrowser && !getBrowserConnection()) {
          window.location.replace("/connect");
          return;
        }

        const shouldRetry =
          attempt < 5 && !(error instanceof ConfigNotReadyError);

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
