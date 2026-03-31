import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CopilotClient } from "@github/copilot-sdk";

let client: CopilotClient | undefined;
let startPromise: Promise<CopilotClient> | undefined;

function getCliPath(): string {
  const moduleDir =
    typeof __dirname !== "undefined"
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
  const initCwd = process.env["INIT_CWD"];
  const candidates = [
    initCwd
      ? resolve(initCwd, "node_modules", "@github", "copilot", "npm-loader.js")
      : "",
    resolve(
      process.cwd(),
      "node_modules",
      "@github",
      "copilot",
      "npm-loader.js"
    ),
    resolve(
      process.cwd(),
      "..",
      "node_modules",
      "@github",
      "copilot",
      "npm-loader.js"
    ),
    resolve(
      process.cwd(),
      "..",
      "..",
      "node_modules",
      "@github",
      "copilot",
      "npm-loader.js"
    ),
    resolve(
      process.cwd(),
      "..",
      "..",
      "..",
      "node_modules",
      "@github",
      "copilot",
      "npm-loader.js"
    ),
    resolve(
      moduleDir,
      "..",
      "..",
      "..",
      "..",
      "..",
      "node_modules",
      "@github",
      "copilot",
      "npm-loader.js"
    ),
    resolve(
      moduleDir,
      "..",
      "..",
      "..",
      "..",
      "node_modules",
      "@github",
      "copilot",
      "npm-loader.js"
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to locate @github/copilot npm-loader.js. Checked: ${candidates.join(", ")}`
  );
}

export async function getClient(): Promise<CopilotClient> {
  if (client && client.getState() === "connected") {
    return client;
  }

  if (!startPromise) {
    startPromise = (async () => {
      const c = new CopilotClient({
        cliPath: getCliPath(),
        autoStart: true,
        autoRestart: true,
      });
      await c.start();
      client = c;
      return c;
    })().finally(() => {
      startPromise = undefined;
    });
  }

  return startPromise;
}

export async function resetClient(): Promise<CopilotClient> {
  if (client) {
    try {
      await client.stop();
    } catch {
      // best-effort
    }
    client = undefined;
  }

  return getClient();
}

export async function stopClient(): Promise<void> {
  if (client) {
    await client.stop();
    client = undefined;
  }
}
