import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { SegmentedCodeInput } from "@/components/ui/segmented-code-input";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import {
  clearBrowserConnection,
  getBrowserConnectionMetadata,
  getBrowserConnection,
  importBrowserConnectionFromLocation,
  markBrowserConnectionStale,
  saveBrowserConnection,
  getPlatform,
} from "@/lib/platform";
import {
  getCachedConfig,
  loadServerConfig,
  resetConfigCache,
} from "@/lib/config";

type ConnectionState = "idle" | "checking" | "connected" | "error";

class TokenRejectedError extends Error {
  constructor() {
    super(
      "The saved token was rejected. Scan the current QR code or paste a new connection link from the desktop app."
    );
    this.name = "TokenRejectedError";
  }
}

function normalizeApiUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function composeApiUrl(host: string, port: string): string {
  return normalizeApiUrl(`http://${host.trim()}:${port.trim() || "3001"}`);
}

function parseApiUrlParts(url: string): { host: string; port: string } {
  try {
    const parsed = new URL(
      normalizeApiUrl(url).startsWith("http") ? normalizeApiUrl(url) : `http://${normalizeApiUrl(url)}`,
    );
    return {
      host: parsed.hostname,
      port: parsed.port || "3001",
    };
  } catch {
    return { host: "", port: "3001" };
  }
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
    throw new TokenRejectedError();
  }

  if (!probe.ok) {
    throw new Error("The authenticated probe failed.");
  }
}

export default function ConnectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const platform = getPlatform();
  const imported = useMemo(() => importBrowserConnectionFromLocation(), []);
  const saved = imported ?? getBrowserConnection();
  const metadata = getBrowserConnectionMetadata();
  const cachedConfig = getCachedConfig();
  const initialUrl = saved?.apiUrl ?? cachedConfig?.url ?? "";
  const [host, setHost] = useState(parseApiUrlParts(initialUrl).host);
  const [port, setPort] = useState(parseApiUrlParts(initialUrl).port);
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState(saved?.token ?? cachedConfig?.token ?? "");
  const [pairingCode, setPairingCode] = useState("");
  const [issuedPairingCode, setIssuedPairingCode] = useState<string | null>(null);
  const [issuedPairingExpiry, setIssuedPairingExpiry] = useState<string | null>(null);
  const [hasSavedConnection, setHasSavedConnection] = useState(Boolean(saved));
  const [state, setState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(metadata.staleReason);

  async function handleConnect() {
    const nextApiUrl = composeApiUrl(host, port);
    const nextToken = token.trim();

    if (!host.trim() || !nextToken) {
      setState("error");
      setError("Enter the server address and token.");
      return;
    }

    if (!/^\d{1,5}$/.test(port.trim()) || Number(port) < 1 || Number(port) > 65535) {
      setState("error");
      setError("Enter a valid port (1-65535).");
      return;
    }

    setState("checking");
    setError(null);

    try {
      await verifyConnection(nextApiUrl, nextToken);
      saveBrowserConnection({ apiUrl: nextApiUrl, token: nextToken });
      setHasSavedConnection(true);
      resetConfigCache();
      await loadServerConfig();
      queryClient.clear();
      setState("connected");
      navigate("/");
    } catch (connectionError) {
      if (connectionError instanceof TokenRejectedError) {
        markBrowserConnectionStale(connectionError.message);
      }

      setState("error");
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Could not connect to Local Recipe Book."
      );
    }
  }

  async function handlePair() {
    const nextApiUrl = composeApiUrl(host, port);
    const nextPairingCode = pairingCode;
    if (!host.trim() || !nextPairingCode) {
      setState("error");
      setError("Enter the server address and pairing code.");
      return;
    }

    if (!/^\d{1,5}$/.test(port.trim()) || Number(port) < 1 || Number(port) > 65535) {
      setState("error");
      setError("Enter a valid port (1-65535).");
      return;
    }

    setState("checking");
    setError(null);
    try {
      const connection = await platform.redeemBrowserPairingCode(
        nextApiUrl,
        nextPairingCode
      );
      await verifyConnection(connection.apiUrl, connection.token);
      saveBrowserConnection(connection);
      setHasSavedConnection(true);
      resetConfigCache();
      await loadServerConfig();
      queryClient.clear();
      setState("connected");
      navigate("/");
    } catch (connectionError) {
      setState("error");
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Could not pair this app."
      );
    }
  }

  async function handleCreatePairingCode() {
    setState("checking");
    setError(null);
    try {
      const result = await platform.createBrowserPairingCode();
      if (!result) throw new Error("Connect this browser before creating a pairing code.");
      setIssuedPairingCode(result.code);
      setIssuedPairingExpiry(result.expiresAt);
      setState("idle");
    } catch (connectionError) {
      setState("error");
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Could not create a pairing code."
      );
    }
  }

  async function handleCopyIssuedPairingCode() {
    if (!issuedPairingCode) return;
    try {
      await navigator.clipboard.writeText(issuedPairingCode);
    } catch {
      setError("Could not copy pairing code.");
    }
  }

  function handleDisconnect() {
    clearBrowserConnection();
    setHasSavedConnection(false);
    resetConfigCache();
    queryClient.clear();
    setHost("");
    setPort("3001");
    setToken("");
    setState("idle");
    setError(null);
  }

  useEffect(() => {
    if (imported) {
      void handleConnect();
    }
  }, []);

  // Auto-submit pairing when the full code has been entered.
  useEffect(() => {
    if (pairingCode.length === 4 && state !== "checking") {
      void handlePair();
    }
  }, [pairingCode]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-5 px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-green">
          Browser access
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-text">
          Connect Local Recipe Book
        </h1>
        {hasSavedConnection ? (
          <p className="mt-2 text-sm text-text-muted">
            This browser has a saved connection. Use it to stay signed in from
            bookmarks or paste a new token if access was reset.
          </p>
        ) : null}
      </header>

      <section className="rounded-card border border-cream-dark bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-text">Server address</span>
            <input
              className="mt-1 w-full rounded-md border border-cream-dark px-3 py-2 text-sm outline-none focus:border-green"
              onChange={(event) => setHost(event.target.value)}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text").trim();
                const match = /^https?:\/\/([^/:]+):(\d{1,5})/.exec(pasted);
                if (match) {
                  event.preventDefault();
                  setHost(match[1]);
                  setPort(match[2]);
                }
              }}
              placeholder="192.168.1.25"
              type="text"
              value={host}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-text">Port</span>
            <input
              className="mt-1 w-full rounded-md border border-cream-dark px-3 py-2 text-sm outline-none focus:border-green"
              inputMode="numeric"
              onChange={(event) => setPort(event.target.value.replace(/\D/g, "").slice(0, 5))}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text").trim();
                const match = /^https?:\/\/([^/:]+):(\d{1,5})/.exec(pasted);
                if (match) {
                  event.preventDefault();
                  setHost(match[1]);
                  setPort(match[2]);
                }
              }}
              placeholder="3001"
              type="text"
              value={port}
            />
          </label>

          <div className="border-t border-cream-dark pt-4">
            <label className="block">
              <span className="text-sm font-semibold text-text">
                Pair installed app
              </span>
              <div className="mt-1">
                <SegmentedCodeInput
                  id="pairing-code"
                  label="4-digit pairing code"
                  length={4}
                  onChange={setPairingCode}
                  value={pairingCode}
                />
              </div>
            </label>
            <p className="mt-2 text-xs text-text-muted">
              Open the current pairing code on the desktop app or in your connected browser.
            </p>
            <Button
              className="mt-3"
              disabled={state === "checking"}
              onClick={() => void handlePair()}
              type="button"
              variant="outline"
            >
              Pair with code
            </Button>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-text">Token</span>
            <div className="relative mt-1">
              <input
                className="w-full rounded-md border border-cream-dark px-3 py-2 pr-10 text-sm outline-none focus:border-green"
                onChange={(event) => setToken(event.target.value)}
                type={showToken ? "text" : "password"}
                value={token}
              />
              <button
                aria-label={showToken ? "Hide token" : "Show token"}
                aria-pressed={showToken}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text"
                onClick={() => setShowToken((visible) => !visible)}
                type="button"
              >
                {showToken ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && (
            <div className="text-sm font-medium text-red-700">{error}</div>
          )}

          {hasSavedConnection ? (
            <div className="border-t border-cream-dark pt-4">
              <p className="text-sm font-semibold text-text">Pair an installed app</p>
              <Button
                className="mt-2"
                disabled={state === "checking"}
                onClick={() => void handleCreatePairingCode()}
                type="button"
                variant="outline"
              >
                Create one-time pairing code
              </Button>
              {issuedPairingCode ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="rounded-md bg-cream px-3 py-2 text-sm tracking-widest">
                    {issuedPairingCode}
                  </code>
                  <Button onClick={() => void handleCopyIssuedPairingCode()} type="button" variant="outline">
                    Copy code
                  </Button>
                  <span className="text-xs text-text-muted">
                    Expires {new Date(issuedPairingExpiry ?? "").toLocaleTimeString()}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={state === "checking"}
              onClick={() => void handleConnect()}
              type="button"
            >
              {state === "checking"
                ? "Checking..."
                : hasSavedConnection
                  ? "Use saved connection"
                  : "Connect"}
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
