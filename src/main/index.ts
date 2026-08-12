import { app, shell, BrowserWindow, Tray, Menu, nativeImage } from "electron";
import { join, resolve } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";

import { registerIpcHandlers } from "./ipc/index";
import { LocalRecipeBookRuntime } from "./runtime";
import { getSetting, ensureSetting } from "./settings/store";
import { setupAutoUpdater } from "./updates/service";
import { createShutdownGate } from "./shutdown";

// ── Constants ────────────────────────────────────────────────
const DEFAULT_WINDOW_WIDTH = 1200;
const DEFAULT_WINDOW_HEIGHT = 800;
const MIN_WINDOW_WIDTH = 900;
const MIN_WINDOW_HEIGHT = 600;

// ── Module-level refs ────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const runtime = new LocalRecipeBookRuntime();
const shutdownGate = createShutdownGate({
  requestRuntimeQuit: () => runtime.requestQuit(),
  quit: () => app.quit(),
  onError: (error) => {
    console.error("[copilot-chef] application shutdown failed:", error);
  },
});

// ── Resource helpers ─────────────────────────────────────────
function getResourcePath(...segments: string[]): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, ...segments);
  }
  return resolve(__dirname, "../../", ...segments);
}

// ── Window ───────────────────────────────────────────────────
function createWindow(): BrowserWindow {
  const windowIconPath = getResourcePath(
    "resources",
    process.platform === "win32" ? "icon.ico" : "icon.png"
  );

  const isMac = process.platform === "darwin";

  const win = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    title: "Local Recipe Book",
    icon: windowIconPath,
    frame: isMac,
    titleBarStyle: isMac ? "hiddenInset" : undefined,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => {
    if (getSetting("app_launch_minimized") !== true) {
      win.show();
    }
  });

  // External links → system browser
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // Close-to-tray
  win.on("close", (e) => {
    if (shutdownGate.isQuitting()) {
      return;
    }

    if (getSetting("app_close_to_tray") === true) {
      e.preventDefault();
      win.hide();
      updateTrayMenu();
      return;
    }

    e.preventDefault();
    shutdownGate.request();
  });

  // Load renderer
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

// ── Tray ─────────────────────────────────────────────────────
function createTray(): Tray {
  const iconPath = getResourcePath("resources", "icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const newTray = new Tray(icon);
  newTray.setToolTip("Local Recipe Book");

  newTray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      updateTrayMenu();
    }
  });

  updateTrayMenu(newTray);
  return newTray;
}

function updateTrayMenu(trayRef?: Tray): void {
  const t = trayRef ?? tray;
  if (!t) return;

  const visible = mainWindow?.isVisible() ?? false;
  const menu = Menu.buildFromTemplate([
    {
      label: visible ? "Hide Local Recipe Book" : "Show Local Recipe Book",
      click: () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow?.show();
          mainWindow?.focus();
        }
        updateTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);
  t.setContextMenu(menu);
}

// ── App lifecycle ────────────────────────────────────────────
app.whenReady().then(async () => {
  // Remove default menu bar (File/Edit/View/Window/Help)
  Menu.setApplicationMenu(null);

  // Set app user model id (Windows)
  electronApp.setAppUserModelId("com.copilot-chef.app");

  // Dev: install devtools, optimize
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Initialize default settings
  ensureSetting("app_close_to_tray", true);
  ensureSetting("app_launch_at_login", false);
  ensureSetting("app_launch_minimized", false);
  ensureSetting("updates_check_on_startup", true);
  ensureSetting("home_upcoming_days", 7);
  ensureSetting("home_upcoming_layout", "list");
  ensureSetting("home_upcoming_detail", "standard");
  ensureSetting("home_upcoming_compact", false);
  ensureSetting("home_show_upcoming_meals", true);
  ensureSetting("home_show_meal_activity", true);
  ensureSetting("home_show_grocery_list", true);
  ensureSetting("home_show_greeting_subtitle", true);
  ensureSetting("meal_bank_sidecar_placement", "right");
  ensureSetting("meal_bank_collapsed", false);
  ensureSetting("recipe_default_sort", "updated_desc");
  ensureSetting("lan_enabled", false);
  ensureSetting("lan_api_host", "127.0.0.1");
  ensureSetting("lan_api_port", getSetting("server_port") ?? 3001);
  ensureSetting("lan_web_enabled", false);
  ensureSetting("lan_web_host", "127.0.0.1");
  ensureSetting("lan_web_port", 4173);
  ensureSetting("lan_allowed_origins", []);

  // Start in-process Hono server (unless remote mode)
  const serverMode = getSetting("server_mode") ?? "local";
  if (serverMode === "local") {
    try {
      const result = await runtime.start();
      console.info(
        `[copilot-chef] server started on ${result.apiUrl ?? "unknown"}`
      );
      if (result.webUrl) {
        console.info(
          `[copilot-chef] browser UI started on ${result.webUrl}`
        );
      }
    } catch (err) {
      console.error("[copilot-chef] server startup failed:", err);
    }
  }

  // Register IPC handlers
  registerIpcHandlers();

  // Create window + tray
  mainWindow = createWindow();
  tray = createTray();

  // Auto-updater (production only)
  if (app.isPackaged) {
    setupAutoUpdater(mainWindow, {
      checkOnStartup: getSetting("updates_check_on_startup") !== false,
    });
  }
});

app.on("before-quit", (event) => {
  if (shutdownGate.isFinalQuitRequested()) {
    return;
  }

  event.preventDefault();
  shutdownGate.request();
});

app.on("window-all-closed", () => {
  // Window close is coordinated by the close handler so runtime cleanup
  // completes before Electron exits.
});

app.on("activate", () => {
  // macOS: re-create window when dock icon clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});
