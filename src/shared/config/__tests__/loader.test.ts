import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { loadServerConfig, loadClientConfig } from "../loader";

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
copilot_model = "gpt-4o"

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
    expect(config.auth.copilotModel).toBe("gpt-4o");
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
    expect(config.auth.copilotModel).toBe("gpt-4o-mini");
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
