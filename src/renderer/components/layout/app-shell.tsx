import { Link, useLocation } from "react-router";
import { type PropsWithChildren, useEffect, useState } from "react";

import { ChatProvider } from "@/context/chat-context";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { getPlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";

import styles from "./app-shell.module.css";

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Meal Plan", href: "/meal-plan" },
  { label: "Recipes", href: "/recipes" },
  { label: "Grocery List", href: "/grocery-list" },
  { label: "Stats", href: "/stats" },
];

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const pathname = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const platform = getPlatform();
  const isElectron = platform.runtime === "electron";
  const isMac = isElectron && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const isWindows = isElectron && navigator.platform.startsWith("Win");
  const isLinux = isElectron && navigator.platform.startsWith("Linux");

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isElectron || !platform.isWindowMaximized) {
      setIsMaximized(false);
      return;
    }

    let mounted = true;

    const syncMaximized = async () => {
      const next = await platform.isWindowMaximized?.();
      if (mounted) {
        setIsMaximized(Boolean(next));
      }
    };

    const syncMaximizedOnResize = () => {
      void syncMaximized();
    };

    void syncMaximized();
    window.addEventListener("resize", syncMaximizedOnResize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", syncMaximizedOnResize);
    };
  }, [isElectron, platform]);

  const handleToggleMaximize = async () => {
    await platform.toggleMaximizeWindow?.();
    const next = await platform.isWindowMaximized?.();
    setIsMaximized(Boolean(next));
  };

  return (
    <ChatProvider>
      <header className={cn(styles.header, isMac && styles.headerMac)}>
        <Link className={cn(styles.logo, styles.noDrag)} to="/">
          Copilot Chef
        </Link>

        <nav className={cn(styles.navDesktop, styles.noDrag)}>
          {navigationItems.map((item) => (
            <Link
              className={cn(
                styles.navLink,
                pathname === item.href && styles.navLinkActive
              )}
              to={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={cn(styles.navRight, styles.noDrag)}>
          <button
            aria-label="Open navigation"
            className={styles.hamburger}
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <span className={styles.hamburgerBar} />
            <span className={styles.hamburgerBar} />
            <span className={styles.hamburgerBar} />
          </button>

          <Link
            className={cn(
              styles.settingsButton,
              pathname === "/settings" && styles.settingsButtonActive
            )}
            to="/settings"
            title="Settings"
          >
            ⚙
          </Link>

          {isElectron && !isMac ? (
            <div
              className={cn(
                styles.windowControls,
                isWindows && styles.windowControlsWindows,
                isLinux && styles.windowControlsLinux
              )}
            >
              <button
                aria-label="Minimize window"
                className={cn(
                  styles.windowControlButton,
                  isWindows && styles.windowControlButtonWindows,
                  isLinux && styles.windowControlButtonLinux
                )}
                onClick={() => {
                  void platform.minimizeWindow?.();
                }}
                title="Minimize"
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn(styles.windowControlIcon, styles.iconMinimize)}
                />
              </button>
              <button
                aria-label={isMaximized ? "Restore window" : "Maximize window"}
                className={cn(
                  styles.windowControlButton,
                  isWindows && styles.windowControlButtonWindows,
                  isLinux && styles.windowControlButtonLinux
                )}
                onClick={() => {
                  void handleToggleMaximize();
                }}
                title={isMaximized ? "Restore" : "Maximize"}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    styles.windowControlIcon,
                    isMaximized ? styles.iconRestore : styles.iconMaximize
                  )}
                />
              </button>
              <button
                aria-label="Close window"
                className={cn(
                  styles.windowControlButton,
                  styles.windowControlClose,
                  isWindows && styles.windowControlButtonWindows,
                  isWindows && styles.windowControlCloseWindows,
                  isLinux && styles.windowControlButtonLinux,
                  isLinux && styles.windowControlCloseLinux
                )}
                onClick={() => {
                  void platform.closeWindow?.();
                }}
                title="Close"
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn(styles.windowControlIcon, styles.iconClose)}
                />
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className={cn(styles.mobileMenu, menuOpen && styles.mobileMenuOpen)}>
        {navigationItems.map((item) => (
          <Link
            className={cn(
              styles.mobileNavLink,
              pathname === item.href && styles.mobileNavLinkActive
            )}
            to={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
        <Link
          className={cn(
            styles.mobileNavLink,
            pathname === "/settings" && styles.mobileNavLinkActive
          )}
          to="/settings"
        >
          Settings
        </Link>
      </div>

      <main className={styles.page}>{children}</main>
      <ChatWidget />
    </ChatProvider>
  );
}
