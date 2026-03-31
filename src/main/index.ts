import { app, shell, BrowserWindow, Tray, Menu, nativeImage } from "electron";
import { join, resolve } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";

import { registerIpcHandlers } from "./ipc/index";
import { startServer, stopServer } from "./server/start";
import { getSetting, ensureSetting } from "./settings/store";
import { setupAutoUpdater } from "./updates/service";

// ── Constants ────────────────────────────────────────────────
const DEFAULT_WINDOW_WIDTH = 1200;
const DEFAULT_WINDOW_HEIGHT = 800;
const MIN_WINDOW_WIDTH = 900;
const MIN_WINDOW_HEIGHT = 600;

// ── Module-level refs ────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

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

  const win = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    title: "Copilot Chef",
    icon: windowIconPath,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => {
    win.show();
  });

  // External links → system browser
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // Close-to-tray
  win.on("close", (e) => {
    if (!quitting && getSetting("app_close_to_tray") === true) {
      e.preventDefault();
      win.hide();
      updateTrayMenu();
    }
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
  newTray.setToolTip("Copilot Chef");

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
      label: visible ? "Hide Copilot Chef" : "Show Copilot Chef",
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
        quitting = true;
        app.quit();
      },
    },
  ]);
  t.setContextMenu(menu);
}

// ── App lifecycle ────────────────────────────────────────────
app.whenReady().then(async () => {
  // Set app user model id (Windows)
  electronApp.setAppUserModelId("com.copilot-chef.app");

  // Dev: install devtools, optimize
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Initialize default settings
  ensureSetting("app_close_to_tray", true);
  ensureSetting("app_minimize_to_tray", true);
  ensureSetting("updates_check_on_startup", true);

  // Start in-process Hono server (unless remote mode)
  const serverMode = getSetting("server_mode") ?? "local";
  if (serverMode === "local") {
    try {
      const serverInfo = await startServer();
      console.info(
        `[copilot-chef] server started on http://127.0.0.1:${serverInfo.port}`
      );
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

app.on("before-quit", async () => {
  quitting = true;
  await stopServer();
});

app.on("window-all-closed", () => {
  // Keep running in tray on Windows/Linux
  if (process.platform === "darwin") {
    // macOS: standard behavior, app stays in dock
  }
  // Don't quit — tray keeps the app alive
});

app.on("activate", () => {
  // macOS: re-create window when dock icon clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});
