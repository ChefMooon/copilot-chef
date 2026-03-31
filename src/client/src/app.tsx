import { Outlet } from "react-router";
import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import { ConnectionBanner } from "@/components/layout/connection-banner";
import { useServerConnection } from "@/lib/connection";
import { loadClientConfig } from "@/lib/config";
import { launchServer } from "@/lib/server-launcher";
import { type ClientConfig } from "@copilot-chef/shared";

async function checkForClientUpdate() {
  try {
    const update = await check();
    if (update?.available) {
      await update.downloadAndInstall();
      await relaunch();
    }
  } catch {
    // Update check is best-effort; ignore network or signature errors
  }
}

function AppContent({ config }: { config: ClientConfig }) {
  const { status, retry } = useServerConnection(config.connection.serverUrl);

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
  const [config, setConfig] = useState<ClientConfig | null>(null);

  useEffect(() => {
    loadClientConfig().then((cfg) => {
      setConfig(cfg);
      if (cfg.connection.autoLaunchServer) {
        void launchServer(cfg);
      }
      if (cfg.updates.checkOnStartup) {
        void checkForClientUpdate();
      }
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
