// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import { ModalShell } from "./ModalShell";

afterEach(() => {
  cleanup();
});

function renderTooltip(content = "Helpful context") {
  return render(
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button aria-label="Open settings" type="button">
            <span aria-hidden="true">Icon</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe("tooltip primitive", () => {
  it("shows supplementary content on keyboard focus without replacing the name", async () => {
    const { getByRole } = renderTooltip();
    const trigger = getByRole("button", { name: "Open settings" });

    fireEvent.focus(trigger);

    expect(getByRole("button", { name: "Open settings" })).toBe(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Helpful context"
    );
  });

  it("renders through a portal and dismisses on Escape and blur", async () => {
    const { getByRole } = renderTooltip();
    const trigger = getByRole("button", { name: "Open settings" });

    fireEvent.pointerMove(trigger);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.parentElement?.parentElement).toBe(document.body);

    fireEvent.keyDown(trigger, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());

    fireEvent.focus(trigger);
    await screen.findByRole("tooltip");
    fireEvent.blur(trigger);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("supports supplemental disabled-reason text without naming the trigger", async () => {
    const reasonId = "settings-reason";
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-describedby={reasonId}
              aria-disabled="true"
              aria-label="Show QR code"
              type="button"
            />
          </TooltipTrigger>
          <TooltipContent id={reasonId}>Enable LAN access first</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    const trigger = screen.getByRole("button", { name: "Show QR code" });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAttribute("aria-describedby", reasonId);
  });

  it("keeps tooltip content hidden when explicitly disabled", () => {
    const { getByRole } = render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button aria-label="Unavailable action" type="button" />
          </TooltipTrigger>
          <TooltipContent hidden>Unavailable</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(getByRole("button", { name: "Unavailable action" })).toBeVisible();
  });

  it("keeps the dialog open when the first Escape dismisses its tooltip", async () => {
    const onClose = vi.fn();
    render(
      <ModalShell open onClose={onClose} title="Settings">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button aria-label="Advanced settings" type="button" />
            </TooltipTrigger>
            <TooltipContent>More settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ModalShell>
    );

    const trigger = screen.getByRole("button", { name: "Advanced settings" });
    fireEvent.focus(trigger);
    const tooltip = await screen.findByRole("tooltip");

    expect(tooltip.className).toContain("content");
    fireEvent.keyDown(trigger, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });
});
