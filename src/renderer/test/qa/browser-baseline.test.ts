// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  expectMinimumHitArea,
  expectNamedControl,
  expectTooltipPolicy,
} from "./browser-baseline";

describe("browser QA control contract", () => {
  it("checks the computed accessible name instead of raw attributes", () => {
    const label = document.createElement("label");
    label.textContent = "Server address";
    const input = document.createElement("input");
    input.id = "server-address";
    label.htmlFor = input.id;
    document.body.append(label, input);

    expectNamedControl(input, "server address");
  });

  it("checks the configured minimum hit area", () => {
    const button = document.createElement("button");
    button.getBoundingClientRect = () =>
      DOMRect.fromRect({ width: 40, height: 40 });

    expectMinimumHitArea(button, 40);
  });

  it("requires tooltip text to supplement a named control", () => {
    const button = document.createElement("button");
    button.setAttribute("aria-label", "Show QR code");
    button.setAttribute("aria-describedby", "qr-reason");

    expectTooltipPolicy(button, {
      describedBy: true,
      text: "Enable LAN access first",
    });
    expect(() =>
      expectTooltipPolicy(button, { text: "Show QR code" })
    ).toThrow();
  });
});
