import { Link, useLocation } from "react-router";
import { type PropsWithChildren, useEffect, useState } from "react";

import { ChatProvider } from "@/context/chat-context";
import { ChatWidget } from "@/components/chat/ChatWidget";
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <ChatProvider>
      <header className={styles.header}>
        <Link className={styles.logo} to="/">
          Copilot Chef
        </Link>

        <nav className={styles.navDesktop}>
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

        <div className={styles.navRight}>
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
