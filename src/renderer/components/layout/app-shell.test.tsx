// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import { AppShell } from "./app-shell";
import styles from "./app-shell.module.css";

const platformMocks = vi.hoisted(() => ({
  runtime: "browser" as "browser" | "electron",
}));
const preloadMocks = vi.hoisted(() => ({
  preloadMealPlanRoute: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/platform", () => ({
  getPlatform: () => ({ runtime: platformMocks.runtime }),
}));

vi.mock("@/lib/meal-plan-route", () => ({
  preloadMealPlanRoute: preloadMocks.preloadMealPlanRoute,
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
    vi.clearAllMocks();

    setViewportWidth(1280);

    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "Win32",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the global header and browser navigation link", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Local Recipe Book" })).toBeTruthy();
  });

  it("shows header settings button on wide layouts", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    const settingsLink = document.querySelector(`.${styles.settingsButton}`);
    expect(settingsLink).not.toBeNull();
    expect(settingsLink).toBeTruthy();
    expect(settingsLink?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
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

    expect(document.querySelector(`.${styles.settingsButton}`)).toBeNull();

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

  it("preloads Meal Plan immediately on focus without awaiting navigation", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    const mealPlanLinks = screen.getAllByRole("link", { name: "Meal Plan" });
    fireEvent.focus(mealPlanLinks[0]);
    fireEvent.click(mealPlanLinks[0]);

    expect(preloadMocks.preloadMealPlanRoute).toHaveBeenCalledTimes(1);
  });

  it("delays mouse intent, ignores touch events, and cancels only pending work", () => {
    vi.useFakeTimers();

    try {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <AppShell>
            <div>content</div>
          </AppShell>
        </MemoryRouter>
      );

      const mealPlanLink = screen.getAllByRole("link", { name: "Meal Plan" })[0];
      fireEvent.pointerEnter(mealPlanLink, { pointerType: "touch" });
      expect(preloadMocks.preloadMealPlanRoute).not.toHaveBeenCalled();

      fireEvent.pointerEnter(mealPlanLink, { pointerType: "mouse" });
      vi.advanceTimersByTime(124);
      expect(preloadMocks.preloadMealPlanRoute).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(preloadMocks.preloadMealPlanRoute).toHaveBeenCalledTimes(1);

      fireEvent.pointerLeave(mealPlanLink);
      expect(preloadMocks.preloadMealPlanRoute).toHaveBeenCalledTimes(1);

      fireEvent.pointerEnter(mealPlanLink, { pointerType: "pen" });
      fireEvent.pointerLeave(mealPlanLink);
      vi.advanceTimersByTime(125);
      expect(preloadMocks.preloadMealPlanRoute).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not treat compatibility mouse movement after touch as intent", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    const mealPlanLink = screen.getAllByRole("link", { name: "Meal Plan" })[0];
    fireEvent.pointerDown(mealPlanLink, { pointerType: "touch" });
    fireEvent.pointerEnter(mealPlanLink, { pointerType: "mouse" });

    expect(preloadMocks.preloadMealPlanRoute).not.toHaveBeenCalled();
  });

  it("contains a rejected preload without blocking the click", async () => {
    preloadMocks.preloadMealPlanRoute.mockRejectedValueOnce(
      new Error("chunk unavailable")
    );

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    const mealPlanLink = screen.getAllByRole("link", { name: "Meal Plan" })[0];
    fireEvent.focus(mealPlanLink);
    fireEvent.click(mealPlanLink);
    await Promise.resolve();

    expect(preloadMocks.preloadMealPlanRoute).toHaveBeenCalledTimes(1);
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
