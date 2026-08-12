import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { loadServerConfig, loadClientConfig } from "../loader";
import {
  APP_SETTING_DEFAULTS,
  normalizeStoredAppSetting,
  resolveUiThemePreference,
} from "../settings";
import { parseCustomThemeProfile } from "../theme";

let tmpDir: string;

function writeTempFile(filename: string, content: string): string {
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "copilot-chef-config-test-")
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  // Clean up env vars
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("COPILOT_CHEF_")) {
      delete process.env[key];
    }
  }
});

describe("loadServerConfig", () => {
  it("parses a valid TOML file", () => {
    const toml = `
[server]
port = 4000
host = "0.0.0.0"
log_level = "debug"

[database]
url = "file:./test.db"

[auth]
tokens = ["secret-1", "secret-2"]

[updates]
feed_url = "https://example.com/releases"
check_on_startup = false

[cors]
origins = ["http://localhost:3000"]
`;
    const filePath = writeTempFile("copilot-chef-server.toml", toml);
    const config = loadServerConfig(filePath);

    expect(config.server.port).toBe(4000);
    expect(config.server.host).toBe("0.0.0.0");
    expect(config.server.logLevel).toBe("debug");
    expect(config.database.url).toBe("file:./test.db");
    expect(config.auth.tokens).toEqual(["secret-1", "secret-2"]);
    expect(config.updates.feedUrl).toBe("https://example.com/releases");
    expect(config.updates.checkOnStartup).toBe(false);
    expect(config.cors.origins).toEqual(["http://localhost:3000"]);
  });

  it("uses defaults when no config file exists", () => {
    const config = loadServerConfig(path.join(tmpDir, "nonexistent.toml"));

    expect(config.server.port).toBe(3001);
    expect(config.server.host).toBe("127.0.0.1");
    expect(config.server.logLevel).toBe("info");
    expect(config.database.url).toBe("file:./data/copilot-chef.db");
    expect(config.auth.tokens).toEqual([]);
    expect(config.updates.checkOnStartup).toBe(true);
  });

  it("applies env var overrides over TOML values", () => {
    const toml = `
[server]
port = 4000

[database]
url = "file:./toml.db"
`;
    const filePath = writeTempFile("copilot-chef-server.toml", toml);
    process.env.COPILOT_CHEF_SERVER_PORT = "5000";
    process.env.COPILOT_CHEF_DATABASE_URL = "file:./override.db";
    const config = loadServerConfig(filePath);

    expect(config.server.port).toBe(5000);
    expect(config.database.url).toBe("file:./override.db");
  });

  it("uses COPILOT_CHEF_DATABASE_URL override", () => {
    process.env.COPILOT_CHEF_DATABASE_URL = "file:./prefixed.db";
    const config = loadServerConfig(path.join(tmpDir, "nonexistent.toml"));

    expect(config.database.url).toBe("file:./prefixed.db");
  });

  it("ignores unrelated env vars", () => {
    process.env.CHEF_DATABASE_URL = "file:./compat.db";
    const config = loadServerConfig(path.join(tmpDir, "nonexistent.toml"));

    expect(config.database.url).toBe("file:./data/copilot-chef.db");
  });

  it("defaults database.url when config and env are missing", () => {
    const config = loadServerConfig(path.join(tmpDir, "nonexistent.toml"));

    expect(config.database.url).toBe("file:./data/copilot-chef.db");
  });

  it("coerces comma-separated env tokens to array", () => {
    process.env.COPILOT_CHEF_DATABASE_URL = "file:./db.db";
    process.env.COPILOT_CHEF_AUTH_TOKENS = "token-a,token-b,token-c";
    const config = loadServerConfig(path.join(tmpDir, "nonexistent.toml"));

    expect(config.auth.tokens).toEqual(["token-a", "token-b", "token-c"]);
  });
});

describe("loadClientConfig", () => {
  it("parses a valid TOML file", () => {
    const toml = `
[connection]
server_url = "http://192.168.1.100:3001"
api_key = "my-key"
auto_launch_server = false
server_binary_path = "/usr/local/bin/copilot-chef-server"

[updates]
check_on_startup = false

[ui]
theme = "dark"
`;
    const filePath = writeTempFile("copilot-chef-client.toml", toml);
    const config = loadClientConfig(filePath);

    expect(config.connection.serverUrl).toBe("http://192.168.1.100:3001");
    expect(config.connection.apiKey).toBe("my-key");
    expect(config.connection.autoLaunchServer).toBe(false);
    expect(config.connection.serverBinaryPath).toBe(
      "/usr/local/bin/copilot-chef-server"
    );
    expect(config.updates.checkOnStartup).toBe(false);
    expect(config.ui.theme).toBe("dark");
  });

  it("uses defaults when no config file exists", () => {
    const config = loadClientConfig(path.join(tmpDir, "nonexistent.toml"));

    expect(config.connection.serverUrl).toBe("http://localhost:3001");
    expect(config.connection.apiKey).toBe("");
    expect(config.connection.autoLaunchServer).toBe(true);
    expect(config.connection.serverBinaryPath).toBe("");
    expect(config.updates.checkOnStartup).toBe(true);
    expect(config.ui.theme).toBe("system");
  });

  it("applies env var overrides", () => {
    process.env.COPILOT_CHEF_CLIENT_SERVER_URL = "http://remote:9000";
    process.env.COPILOT_CHEF_CLIENT_API_KEY = "env-key";
    const config = loadClientConfig(path.join(tmpDir, "nonexistent.toml"));

    expect(config.connection.serverUrl).toBe("http://remote:9000");
    expect(config.connection.apiKey).toBe("env-key");
  });
});

describe("typed settings contract", () => {
  it("normalizes legacy or malformed stored values to the documented defaults", () => {
    expect(APP_SETTING_DEFAULTS.ui_theme).toBe("system");
    expect(normalizeStoredAppSetting("server_mode", "remote")).toBe("remote");
    expect(normalizeStoredAppSetting("server_mode", "invalid")).toBe("local");
    expect(normalizeStoredAppSetting("app_close_to_tray", "yes")).toBe(true);
    expect(normalizeStoredAppSetting("lan_enabled", undefined)).toBe(false);
    expect(normalizeStoredAppSetting("ui_theme", "dark")).toBe("dark");
    expect(APP_SETTING_DEFAULTS.app_launch_at_login).toBe(false);
    expect(APP_SETTING_DEFAULTS.app_launch_minimized).toBe(false);
    expect(normalizeStoredAppSetting("app_launch_at_login", "true")).toBe(true);
    expect(normalizeStoredAppSetting("app_launch_minimized", "invalid")).toBe(false);
  });

  it("resolves the effective renderer theme for light, dark, and system values", () => {
    expect(resolveUiThemePreference("light")).toBe("light");
    expect(resolveUiThemePreference("dark")).toBe("dark");
    expect(resolveUiThemePreference("system")).toBe("system");
    expect(resolveUiThemePreference("banana")).toBe("system");
    expect(resolveUiThemePreference(null)).toBe("system");
  });

  it("accepts versioned custom theme profiles and rejects malformed profiles", () => {
    const profile = {
      version: 1,
      id: "sage-night",
      name: "Sage Night",
      tokens: {
        background: "#101613",
        surface: "#18241d",
        surfaceMuted: "#21352c",
        surfaceElevated: "#233329",
        foreground: "#eef4ee",
        foregroundMuted: "#adbea8",
        border: "#2c3932",
        primary: "#8bbf9b",
        primaryForeground: "#101613",
        accent: "#e29a68",
        accentForeground: "#101613",
        success: "#7db18d",
        warning: "#e29a68",
        danger: "#e88484",
        focus: "#93c8a6",
        overlay: "#10161399",
        chartGrid: "#2c3932",
        chartSeries: ["#8bbf9b", "#e29a68"],
        heatmap: {
          empty: "#233329",
          low: "#3d624b",
          medium: "#5f936f",
          high: "#8bbf9b",
          future: "#2c3932",
        },
      },
    };

    expect(parseCustomThemeProfile(profile)).toEqual(profile);
    expect(parseCustomThemeProfile({ ...profile, version: 2 })).toBeNull();
    expect(parseCustomThemeProfile({ ...profile, tokens: { ...profile.tokens, background: "white" } })).toBeNull();
    expect(normalizeStoredAppSetting("ui_custom_theme_profile", profile)).toEqual(profile);
    expect(APP_SETTING_DEFAULTS.ui_custom_theme_profile).toBeNull();
  });
});
