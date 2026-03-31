#!/usr/bin/env node
import { loadServerConfig } from "@copilot-chef/shared";
import { bootstrapDatabase } from "@copilot-chef/core";
import { createApp } from "./app.js";
import { serve } from "@hono/node-server";
import { checkForUpdate } from "./updater.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8")) as { version: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function runStart() {
  const config = loadServerConfig();
  process.env["DATABASE_URL"] = config.database.url;
  if (config.copilotModel) {
    process.env["COPILOT_MODEL"] = config.copilotModel;
  }

  await bootstrapDatabase();
  const app = createApp(config);

  const { port, host } = config.server;
  serve({ fetch: app.fetch, port, hostname: host }, (info) => {
    console.info(`[server] listening on http://${info.address}:${info.port}`);
  });
}

function runVersion() {
  console.log(`copilot-chef-server ${getVersion()}`);
}

async function runConfig() {
  const config = loadServerConfig();
  console.log(JSON.stringify(config, null, 2));
}

async function runDbStatus() {
  try {
    const config = loadServerConfig();
    process.env["DATABASE_URL"] = config.database.url;
    await bootstrapDatabase();
    console.log("[db] database is initialized and healthy");
  } catch (error) {
    console.error("[db] database error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function runCheckUpdate() {
  const version = getVersion();
  console.log(`[update] current version: ${version}`);
  const update = await checkForUpdate(version);
  if (update.hasUpdate) {
    console.log(`[update] update available: ${update.latestVersion}`);
    console.log(`[update] download: ${update.releaseUrl}`);
  } else {
    console.log("[update] already up to date");
  }
}

const [, , command, subcommand] = process.argv;

switch (command) {
  case "start":
  case undefined:
    runStart().catch((err) => {
      console.error("[server] fatal error:", err);
      process.exit(1);
    });
    break;

  case "version":
  case "--version":
  case "-v":
    runVersion();
    break;

  case "config":
    runConfig().catch((err) => {
      console.error("[config] error:", err);
      process.exit(1);
    });
    break;

  case "db":
    switch (subcommand) {
      case "status":
        runDbStatus().catch((err) => {
          console.error("[db] error:", err);
          process.exit(1);
        });
        break;

      default:
        console.error(`[cli] unknown db subcommand: ${subcommand ?? "(none)"}`);
        console.error("Usage: copilot-chef-server db status");
        process.exit(1);
    }
    break;

  case "update":
  case "check-update":
    runCheckUpdate().catch((err) => {
      console.error("[update] error:", err);
      process.exit(1);
    });
    break;

  default:
    console.error(`[cli] unknown command: ${command}`);
    console.error("Usage: copilot-chef-server [start|version|config|db status|check-update]");
    process.exit(1);
}
