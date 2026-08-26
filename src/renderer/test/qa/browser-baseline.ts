import { computeAccessibleName } from "dom-accessibility-api";
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
  const disabled =
    "disabled" in element ? (element as HTMLInputElement).disabled : false;
  expect(disabled).toBe(false);
  expect(element.tabIndex).toBeGreaterThanOrEqual(0);
}

export function expectNamedControl(
  control: HTMLElement,
  name: string | RegExp
) {
  const accessibleName = computeAccessibleName(control);

  if (typeof name === "string") {
    expect(accessibleName.toLowerCase()).toContain(name.toLowerCase());
    return;
  }

  expect(accessibleName).toMatch(name);
}

export function expectMinimumHitArea(
  control: HTMLElement,
  minimum: 32 | 40 = 32
) {
  const bounds = control.getBoundingClientRect();

  expect(bounds.width).toBeGreaterThanOrEqual(minimum);
  expect(bounds.height).toBeGreaterThanOrEqual(minimum);
}

export function expectTooltipPolicy(
  control: HTMLElement,
  options: { describedBy?: boolean; text?: string } = {}
) {
  expect(computeAccessibleName(control)).not.toBe("");

  if (options.describedBy) {
    expect(control.getAttribute("aria-describedby")).toBeTruthy();
  }

  if (options.text) {
    expect(options.text.trim()).not.toBe(computeAccessibleName(control));
  }
}
