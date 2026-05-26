#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const ipcIndexPath = path.join(repoRoot, "src", "main", "ipc", "index.ts");
const updatesServicePath = path.join(repoRoot, "src", "main", "updates", "service.ts");
const ipcDocPath = path.join(repoRoot, "docs", "ipc-channels.md");

function collectByRegex(content, regex) {
  const values = new Set();
  for (const match of content.matchAll(regex)) {
    if (match[1]) {
      values.add(match[1]);
    }
  }
  return values;
}

function collectDocChannels(docContent) {
  const values = new Set();
  const lines = docContent.split(/\r?\n/);

  // Match table rows where the first column is a backticked channel name.
  const firstColumnChannel = /^\|\s*`([A-Za-z0-9:-]+)`\s*\|/;
  for (const line of lines) {
    const match = line.match(firstColumnChannel);
    if (match?.[1]) {
      values.add(match[1]);
    }
  }

  return values;
}

function asSortedArray(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function printList(title, values) {
  if (values.length === 0) return;
  console.error(`\n${title}`);
  for (const value of values) {
    console.error(`- ${value}`);
  }
}

async function main() {
  const [ipcIndexContent, updatesServiceContent, ipcDocContent] = await Promise.all([
    readFile(ipcIndexPath, "utf8"),
    readFile(updatesServicePath, "utf8"),
    readFile(ipcDocPath, "utf8"),
  ]);

  const codeChannels = new Set([
    ...collectByRegex(ipcIndexContent, /ipcMain\.handle\(\s*"([^"]+)"/g),
    ...collectByRegex(updatesServiceContent, /ipcMain\.handle\(\s*"([^"]+)"/g),
    ...collectByRegex(updatesServiceContent, /webContents\.send\("([^"]+)"/g),
  ]);

  const docChannels = collectDocChannels(ipcDocContent);

  const missingInDocs = asSortedArray([...codeChannels].filter((c) => !docChannels.has(c)));
  const staleInDocs = asSortedArray([...docChannels].filter((c) => !codeChannels.has(c)));

  if (missingInDocs.length === 0 && staleInDocs.length === 0) {
    console.log("IPC channel docs check passed: docs/ipc-channels.md is in sync with code channel names.");
    return;
  }

  console.error("IPC channel docs drift detected.");
  printList("Channels in code but missing from docs/ipc-channels.md:", missingInDocs);
  printList("Channels in docs/ipc-channels.md but not found in code:", staleInDocs);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("Failed to run IPC docs drift check.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
