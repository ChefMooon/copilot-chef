import { z } from "zod";

export const RuntimeLanCandidateSchema = z.object({
  name: z.string(),
  address: z.string(),
});

export const RuntimeConfigSchema = z.object({
  mode: z.enum(["local", "remote"]).default("local"),
  lan: z
    .object({
      enabled: z.boolean().default(false),
      candidates: z.array(RuntimeLanCandidateSchema).default([]),
    })
    .default({}),
  api: z
    .object({
      configuredPort: z.number().int().nonnegative().default(3001),
      bindHost: z.string().default("127.0.0.1"),
      advertisedHost: z.string().default("127.0.0.1"),
      port: z.number().int().nonnegative().default(3001),
      url: z.string().default("http://127.0.0.1:3001"),
    })
    .default({}),
  web: z
    .object({
      enabled: z.boolean().default(false),
      configuredPort: z.number().int().nonnegative().default(4173),
      bindHost: z.string().default("127.0.0.1"),
      advertisedHost: z.string().default("127.0.0.1"),
      port: z.number().int().nonnegative().default(4173),
      url: z.string().default("http://127.0.0.1:4173"),
    })
    .default({}),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export type RuntimeConfigInput = {
  settings?: Record<string, unknown>;
  fallbackApiPort?: number;
  fallbackWebPort?: number;
  mode?: RuntimeConfig["mode"];
  lanEnabled?: boolean;
  lanCandidates?: Array<{ name: string; address: string }>;
  apiAdvertisedHost?: string;
  webAdvertisedHost?: string;
  actualApiPort?: number;
  actualWebPort?: number;
};

function getNumberSetting(
  settings: Record<string, unknown> | undefined,
  key: string,
  fallback: number
): number {
  const value = settings?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function getBooleanSetting(
  settings: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean
): boolean {
  const value = settings?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function getStringSetting(
  settings: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  const value = settings?.[key];
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function resolveEffectiveRuntimeConfig(
  input: RuntimeConfigInput = {}
): RuntimeConfig {
  const settings = input.settings ?? {};
  const fallbackApiPort = input.fallbackApiPort ?? 3001;
  const fallbackWebPort = input.fallbackWebPort ?? 4173;
  const mode = input.mode ?? ((settings["server_mode"] as string | undefined) ?? "local");
  const configuredApiPort = getNumberSetting(settings, "server_port", fallbackApiPort);
  const configuredWebPort = getNumberSetting(settings, "lan_web_port", fallbackWebPort);
  const lanEnabled = input.lanEnabled ?? getBooleanSetting(settings, "lan_enabled", false);
  const apiAdvertisedHost =
    input.apiAdvertisedHost ??
    getStringSetting(settings, "lan_advertised_host", "127.0.0.1");
  const webAdvertisedHost =
    input.webAdvertisedHost ??
    getStringSetting(settings, "lan_advertised_host", "127.0.0.1");
  const actualApiPort = input.actualApiPort ?? configuredApiPort;
  const actualWebPort = input.actualWebPort ?? configuredWebPort;

  const apiBindHost = lanEnabled ? "0.0.0.0" : "127.0.0.1";
  const webBindHost = lanEnabled ? "0.0.0.0" : "127.0.0.1";

  return RuntimeConfigSchema.parse({
    mode,
    lan: {
      enabled: lanEnabled,
      candidates: input.lanCandidates ?? [],
    },
    api: {
      configuredPort: configuredApiPort,
      bindHost: apiBindHost,
      advertisedHost: apiAdvertisedHost,
      port: actualApiPort,
      url: `http://${apiAdvertisedHost}:${actualApiPort}`,
    },
    web: {
      enabled: getBooleanSetting(settings, "lan_web_enabled", lanEnabled),
      configuredPort: configuredWebPort,
      bindHost: webBindHost,
      advertisedHost: webAdvertisedHost,
      port: actualWebPort,
      url: `http://${webAdvertisedHost}:${actualWebPort}`,
    },
  });
}
