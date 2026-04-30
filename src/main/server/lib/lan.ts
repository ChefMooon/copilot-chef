import { createConnection } from "node:net";
import { networkInterfaces } from "node:os";

import { getSetting } from "../../settings/store";

export const LOOPBACK_HOST = "127.0.0.1";
export const LAN_BIND_HOST = "0.0.0.0";
export const DEFAULT_WEB_PORT = 4173;

export type LanIpv4Candidate = {
  name: string;
  address: string;
};

export type LanRuntimeSettings = {
  lanEnabled: boolean;
  apiBindHost: string;
  apiAdvertisedHost: string;
  apiPort: number;
  apiUrl: string;
  webEnabled: boolean;
  webBindHost: string;
  webAdvertisedHost: string;
  webPort: number;
  webUrl: string;
  allowedOrigins: string[];
  candidates: LanIpv4Candidate[];
};

export async function probeLanReachability(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: 1500 });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(false));
  });
}

function getBooleanSetting(key: string, fallback: boolean): boolean {
  const value = getSetting(key);
  return typeof value === "boolean" ? value : fallback;
}

function getNumberSetting(key: string, fallback: number): number {
  const value = getSetting(key);
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function getStringSetting(key: string): string | undefined {
  const value = getSetting(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getStringArraySetting(key: string): string[] {
  const value = getSetting(key);
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getLanIpv4Candidates(): LanIpv4Candidate[] {
  const interfaces = networkInterfaces();
  const candidates: LanIpv4Candidate[] = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      candidates.push({ name, address: address.address });
    }
  }

  return candidates;
}

function buildOrigin(host: string, port: number): string {
  return `http://${host}:${port}`;
}

export function resolveLanRuntimeSettings(apiPortFallback: number): LanRuntimeSettings {
  const lanEnabled = getBooleanSetting("lan_enabled", false);
  const candidates = getLanIpv4Candidates();
  const advertisedOverride = getStringSetting("lan_advertised_host");
  const advertisedHost = lanEnabled
    ? advertisedOverride ?? candidates[0]?.address ?? LOOPBACK_HOST
    : LOOPBACK_HOST;
  const apiPort = getNumberSetting(
    "lan_api_port",
    getNumberSetting("server_port", apiPortFallback)
  );
  const webPort = getNumberSetting("lan_web_port", DEFAULT_WEB_PORT);
  const webEnabled = getBooleanSetting("lan_web_enabled", lanEnabled);
  const apiBindHost = lanEnabled ? LAN_BIND_HOST : LOOPBACK_HOST;
  const webBindHost = lanEnabled && webEnabled ? LAN_BIND_HOST : LOOPBACK_HOST;
  const webAdvertisedHost = lanEnabled ? advertisedHost : LOOPBACK_HOST;
  const staticOrigins = [
    buildOrigin(LOOPBACK_HOST, webPort),
    buildOrigin("localhost", webPort),
    buildOrigin(webAdvertisedHost, webPort),
  ];

  return {
    lanEnabled,
    apiBindHost,
    apiAdvertisedHost: advertisedHost,
    apiPort,
    apiUrl: buildOrigin(advertisedHost, apiPort),
    webEnabled,
    webBindHost,
    webAdvertisedHost,
    webPort,
    webUrl: buildOrigin(webAdvertisedHost, webPort),
    allowedOrigins: Array.from(
      new Set([
        "http://localhost:5173",
        "app://localhost",
        "null",
        ...staticOrigins,
        ...getStringArraySetting("lan_allowed_origins"),
      ])
    ),
    candidates,
  };
}