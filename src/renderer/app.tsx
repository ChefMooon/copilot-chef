import { Outlet } from "react-router";
import { useEffect, useState } from "react";

import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import { ConnectionBanner } from "@/components/layout/connection-banner";
import { useServerConnection } from "@/lib/connection";
import { loadServerConfig } from "@/lib/config";
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

  useEffect(() => {
    if (
      getPlatform().runtime === "browser" &&
      !getBrowserConnection() &&
      !window.location.pathname.startsWith("/connect")
    ) {
      window.location.replace("/connect");
      return;
    }

    loadServerConfig().then((cfg) => {
      setConfig(cfg);
    });
  }, []);

  if (!config) {
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
        Loading…
      </div>
    );
  }

  return (
    <QueryProvider>
      <ToastProvider>
        <AppContent config={config} />
      </ToastProvider>
    </QueryProvider>
  );
}
