import { app } from "electron";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const SETTINGS_FILE = "settings.json";

let settings: Record<string, unknown> = {};
let settingsPath: string | null = null;

function getSettingsPath(): string {
  if (settingsPath) return settingsPath;
  const userDataPath = app.getPath("userData");
  settingsPath = join(userDataPath, SETTINGS_FILE);
  return settingsPath;
}

function loadSettings(): void {
  const path = getSettingsPath();
  if (!existsSync(path)) {
    settings = {};
    return;
  }
  try {
    const raw = readFileSync(path, "utf-8");
    settings = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    settings = {};
  }
}

function saveSettings(): void {
  const path = getSettingsPath();
  const dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(settings, null, 2), "utf-8");
}

export function getSetting(key: string): unknown {
  if (Object.keys(settings).length === 0) {
    loadSettings();
  }
  return settings[key];
}

export function setSetting(key: string, value: unknown): void {
  if (Object.keys(settings).length === 0) {
    loadSettings();
  }
  settings[key] = value;
  saveSettings();
}

export function ensureSetting(key: string, defaultValue: unknown): void {
  if (getSetting(key) === undefined) {
    setSetting(key, defaultValue);
  }
}

export function getAllSettings(): Record<string, unknown> {
  if (Object.keys(settings).length === 0) {
    loadSettings();
  }
  return { ...settings };
}
