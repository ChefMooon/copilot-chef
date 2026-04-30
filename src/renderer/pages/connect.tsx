import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  clearBrowserConnection,
  getBrowserConnection,
  importBrowserConnectionFromLocation,
  saveBrowserConnection,
} from "@/lib/platform";
import { getCachedConfig, resetConfigCache } from "@/lib/config";

type ConnectionState = "idle" | "checking" | "connected" | "error";

function normalizeApiUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

async function verifyConnection(apiUrl: string, token: string): Promise<void> {
  const health = await fetch(`${apiUrl}/api/health`, { cache: "no-store" });
  if (!health.ok) {
    throw new Error("The API health check failed.");
  }

  const probe = await fetch(`${apiUrl}/api/preferences`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (probe.status === 401) {
    throw new Error("The token was rejected.");
  }

  if (!probe.ok) {
    throw new Error("The authenticated probe failed.");
  }
}

export default function ConnectPage() {
  const navigate = useNavigate();
  const imported = useMemo(() => importBrowserConnectionFromLocation(), []);
  const saved = imported ?? getBrowserConnection();
  const cachedConfig = getCachedConfig();
  const [apiUrl, setApiUrl] = useState(saved?.apiUrl ?? cachedConfig?.url ?? "");
  const [token, setToken] = useState(saved?.token ?? cachedConfig?.token ?? "");
  const [state, setState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    const nextApiUrl = normalizeApiUrl(apiUrl);
    const nextToken = token.trim();

    if (!nextApiUrl || !nextToken) {
      setState("error");
      setError("Enter both the API URL and token.");
      return;
    }

    setState("checking");
    setError(null);

    try {
      await verifyConnection(nextApiUrl, nextToken);
      saveBrowserConnection({ apiUrl: nextApiUrl, token: nextToken });
      resetConfigCache();
      setState("connected");
      navigate("/");
    } catch (connectionError) {
      setState("error");
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Could not connect to Copilot Chef."
      );
    }
  }

  function handleDisconnect() {
    clearBrowserConnection();
    resetConfigCache();
    setApiUrl("");
    setToken("");
    setState("idle");
    setError(null);
  }

  useEffect(() => {
    if (imported) {
      void handleConnect();
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-5 px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-green">Browser access</p>
        <h1 className="mt-2 text-3xl font-semibold text-text">Connect Copilot Chef</h1>
      </header>

      <section className="rounded-card border border-cream-dark bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-text">API URL</span>
            <input
              className="mt-1 w-full rounded-md border border-cream-dark px-3 py-2 text-sm outline-none focus:border-green"
              onChange={(event) => setApiUrl(event.target.value)}
              placeholder="http://192.168.1.25:3001"
              type="url"
              value={apiUrl}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-text">Token</span>
            <input
              className="mt-1 w-full rounded-md border border-cream-dark px-3 py-2 text-sm outline-none focus:border-green"
              onChange={(event) => setToken(event.target.value)}
              type="password"
              value={token}
            />
          </label>

          {error && <div className="text-sm font-medium text-red-700">{error}</div>}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={state === "checking"}
              onClick={() => void handleConnect()}
              type="button"
            >
              {state === "checking" ? "Checking..." : "Connect"}
            </Button>
            <Button onClick={handleDisconnect} type="button" variant="outline">
              Disconnect
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}