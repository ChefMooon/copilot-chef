// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import { AppShell } from "./app-shell";
import styles from "./app-shell.module.css";

const platformMocks = vi.hoisted(() => ({
  runtime: "browser" as "browser" | "electron",
}));

vi.mock("@/lib/platform", () => ({
  getPlatform: () => ({ runtime: platformMocks.runtime }),
}));

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
};

describe("AppShell", () => {
  beforeEach(() => {
    platformMocks.runtime = "browser";

    setViewportWidth(1280);

    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "Win32",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows header settings button on wide layouts", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByText("⚙")).toBeTruthy();
  });

  it("hides header settings on narrow layouts and keeps settings in hamburger menu", () => {
    setViewportWidth(900);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.queryByText("⚙")).toBeNull();

    const menu = document.querySelector(`.${styles.mobileMenu}`);
    expect(menu).toBeTruthy();
    expect(menu?.classList.contains(styles.mobileMenuOpen)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(menu?.classList.contains(styles.mobileMenuOpen)).toBe(true);
    expect(within(menu as HTMLElement).getByRole("link", { name: "Settings" })).toBeTruthy();
  });

  it("closes the mobile menu after navigating", () => {
    setViewportWidth(900);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    const menu = document.querySelector(`.${styles.mobileMenu}`);
    expect(menu).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(menu?.classList.contains(styles.mobileMenuOpen)).toBe(true);

    fireEvent.click(within(menu as HTMLElement).getByRole("link", { name: "Meal Plan" }));

    expect(menu?.classList.contains(styles.mobileMenuOpen)).toBe(false);
  });

  it("keeps custom window controls in narrow desktop electron layout with hamburger", () => {
    platformMocks.runtime = "electron";
    setViewportWidth(900);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Open navigation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Minimize window" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Maximize window" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close window" })).toBeTruthy();
  });

  it("does not render custom window controls in browser runtime", () => {
    platformMocks.runtime = "browser";
    setViewportWidth(900);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Minimize window" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Maximize window" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close window" })).toBeNull();
  });
});
