import { app } from "electron";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSetting } from "./settings/store";

export type LifecycleStatus = {
  supported: boolean;
  launchAtLogin: boolean;
  launchMinimized: boolean;
  reason?: string;
};

function isLoginItemSupported(): boolean {
  return app.isPackaged && (process.platform === "win32" || process.platform === "darwin");
}

function getLinuxAutostartPath(): string {
  return join(app.getPath("appData"), "autostart", "local-recipe-book.desktop");
}

async function getLinuxLaunchAtLogin(): Promise<boolean> {
  try {
    const path = getLinuxAutostartPath();
    const { access } = await import("node:fs/promises");
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function getLifecycleStatus(): Promise<LifecycleStatus> {
  const launchMinimized = getSetting("app_launch_minimized") === true;

  if (isLoginItemSupported()) {
    return {
      supported: true,
      launchAtLogin: app.getLoginItemSettings().openAtLogin,
      launchMinimized,
    };
  }

  if (app.isPackaged && process.platform === "linux") {
    return {
      supported: true,
      launchAtLogin: await getLinuxLaunchAtLogin(),
      launchMinimized,
    };
  }

  return {
    supported: false,
    launchAtLogin: false,
    launchMinimized: false,
    reason: app.isPackaged ? "Launch at login is unavailable on this platform." : "Launch at login is unavailable in development builds.",
  };
}

export async function setLaunchAtLogin(enabled: boolean): Promise<LifecycleStatus> {
  if (isLoginItemSupported()) {
    app.setLoginItemSettings({ openAtLogin: enabled });
    return getLifecycleStatus();
  }

  if (app.isPackaged && process.platform === "linux") {
    const path = getLinuxAutostartPath();
    if (enabled) {
      const autostartDirectory = join(app.getPath("appData"), "autostart");
      await mkdir(autostartDirectory, { recursive: true });
      await writeFile(
        path,
        [
          "[Desktop Entry]",
          "Type=Application",
          "Name=Local Recipe Book",
          `Exec=${process.execPath}`,
          "Terminal=false",
          "X-GNOME-Autostart-enabled=true",
          "",
        ].join("\n"),
        "utf8"
      );
    } else {
      await rm(path, { force: true });
    }
    return getLifecycleStatus();
  }

  return getLifecycleStatus();
}
