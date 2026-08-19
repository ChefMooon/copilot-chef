// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DropIntentPopover } from "./DropIntentPopover";

describe("DropIntentPopover", () => {
  afterEach(() => {
    cleanup();
  });

  it("clamps position near viewport edges", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 240,
    });

    render(
      <DropIntentPopover
        anchor={{ x: 310, y: 230 }}
        isOpen
        onCancel={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const panel = screen.getByRole("dialog", {
      name: /Choose drop behavior/i,
    }) as HTMLDivElement;

    expect(panel.style.left).toBe("28px");
    expect(panel.style.top).toBe("88px");
    expect(panel.style.transform).toBe("");
  });

  it("calls action handlers", async () => {
    const onCancel = vi.fn();
    const onSelect = vi.fn();

    render(
      <DropIntentPopover
        anchor={{ x: 20, y: 20 }}
        isOpen
        onCancel={onCancel}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Insert here/i }));
    fireEvent.click(screen.getByRole("button", { name: /Swap/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onSelect).toHaveBeenNthCalledWith(1, "insert");
    expect(onSelect).toHaveBeenNthCalledWith(2, "swap");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("dismisses on outside pointer and Escape", () => {
    const onCancel = vi.fn();

    render(
      <DropIntentPopover
        anchor={{ x: 20, y: 20 }}
        isOpen
        onCancel={onCancel}
        onSelect={vi.fn()}
      />
    );

    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("disables actions while applying", () => {
    render(
      <DropIntentPopover
        anchor={{ x: 20, y: 20 }}
        isApplying
        isOpen
        onCancel={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Insert here/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Swap/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeDisabled();
  });
});
