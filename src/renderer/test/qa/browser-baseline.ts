import { expect } from "vitest";

export function expectPrimaryHeading(name: RegExp | string) {
  const heading = document.querySelector("h1");
  expect(heading).toBeTruthy();
  expect(heading?.textContent ?? "").toMatch(name);
}

export function expectMainLandmark() {
  const main = document.querySelector("main");
  expect(main).toBeTruthy();
}

export function expectKeyboardFocusable(element: HTMLElement) {
  const disabled = "disabled" in element ? (element as HTMLInputElement).disabled : false;
  expect(disabled).toBe(false);
  expect(element.tabIndex).toBeGreaterThanOrEqual(0);
}

export function expectNamedControl(control: HTMLElement, name: string | RegExp) {
  const label = control.getAttribute("aria-label") ?? "";
  const placeholder = control.getAttribute("placeholder") ?? "";
  const text = `${label} ${placeholder}`.trim();

  if (typeof name === "string") {
    expect(text.toLowerCase()).toContain(name.toLowerCase());
    return;
  }

  expect(text).toMatch(name);
}
