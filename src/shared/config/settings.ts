import { z } from "zod";

import { parseCustomThemeProfile, type CustomThemeProfileV1 } from "./theme";

export const AppSettingKeySchema = z.enum([
  "server_mode",
  "server_port",
  "remote_server_url",
  "remote_api_key",
  "app_close_to_tray",
  "app_launch_at_login",
  "app_launch_minimized",
  "app_remember_window_state",
  "lan_enabled",
  "lan_web_enabled",
  "lan_web_port",
  "lan_api_port",
  "lan_advertised_host",
  "lan_allowed_origins",
  "machine_api_key",
  "machine_api_key_updated_at",
  "updates_check_on_startup",
  "ui_theme",
  "ui_custom_theme_profile",
]);

export const AppSettingValueSchema = z.union([
  z.literal("local"),
  z.literal("remote"),
  z.number(),
  z.string(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

export const AppSettingDefaults = {
  server_mode: "local" as const,
  server_port: 3001,
  remote_server_url: "",
  remote_api_key: "",
  app_close_to_tray: true,
  app_launch_at_login: false,
  app_launch_minimized: false,
  app_remember_window_state: false,
  lan_enabled: false,
  lan_web_enabled: false,
  lan_web_port: 4173,
  lan_api_port: 3001,
  lan_advertised_host: "",
  lan_allowed_origins: [] as string[],
  machine_api_key: "",
  machine_api_key_updated_at: "",
  updates_check_on_startup: true,
  ui_theme: "system" as const,
  ui_custom_theme_profile: null as CustomThemeProfileV1 | null,
} as const;

export type AppSettingKey = keyof typeof AppSettingDefaults;
export type AppSettingValue = (typeof AppSettingDefaults)[AppSettingKey];
export type AppSettingTheme = "light" | "dark" | "system";

const APP_SETTING_TYPES = {
  server_mode: "enum",
  server_port: "number",
  remote_server_url: "string",
  remote_api_key: "string",
  app_close_to_tray: "boolean",
  app_launch_at_login: "boolean",
  app_launch_minimized: "boolean",
  app_remember_window_state: "boolean",
  lan_enabled: "boolean",
  lan_web_enabled: "boolean",
  lan_web_port: "number",
  lan_api_port: "number",
  lan_advertised_host: "string",
  lan_allowed_origins: "string[]",
  machine_api_key: "string",
  machine_api_key_updated_at: "string",
  updates_check_on_startup: "boolean",
  ui_theme: "theme",
  ui_custom_theme_profile: "custom-theme-profile",
} as const;

export const APP_SETTING_DEFAULTS = AppSettingDefaults;

export function normalizeStoredAppSetting<Key extends AppSettingKey>(
  key: Key,
  value: unknown
): AppSettingValue {
  const defaultValue = APP_SETTING_DEFAULTS[key];

  switch (APP_SETTING_TYPES[key]) {
    case "enum": {
      if (value === "local" || value === "remote") {
        return value;
      }
      return defaultValue;
    }
    case "number": {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      return defaultValue;
    }
    case "boolean": {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const lower = value.trim().toLowerCase();
        if (lower === "true" || lower === "1") return true;
        if (lower === "false" || lower === "0") return false;
      }
      return defaultValue;
    }
    case "string": {
      if (typeof value === "string") {
        return value;
      }
      return defaultValue;
    }
    case "string[]": {
      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string");
      }
      return defaultValue;
    }
    case "theme": {
      return resolveUiThemePreference(value);
    }
    case "custom-theme-profile": {
      return parseCustomThemeProfile(value);
    }
    default:
      return defaultValue;
  }
}

export function resolveUiThemePreference(value: unknown): AppSettingTheme {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function isAvailableThemePreference(value: unknown): value is AppSettingTheme {
  return value === "light" || value === "dark" || value === "system";
}
