// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModalShell } from "./ModalShell";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("ModalShell", () => {
  it("renders its accessible header, body, and split footer", () => {
    render(
      <ModalShell
        open
        onClose={vi.fn()}
        eyebrow="Groceries"
        title="Create list"
        subtitle="Add the items you need."
        footerLeft={<button type="button">Cancel</button>}
        footerRight={<button type="button">Create</button>}
      >
        <label>
          Name <input aria-label="Name" />
        </label>
      </ModalShell>
    );

    const dialog = screen.getByRole("dialog", { name: "Create list" });
    expect(dialog).toHaveAccessibleDescription("Add the items you need.");
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes from the close button, overlay, and Escape, then restores focus", () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = render(
      <ModalShell open onClose={onClose} title="Dialog">
        <button type="button">Action</button>
      </ModalShell>
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("prevents close while disabled", () => {
    const onClose = vi.fn();
    render(
      <ModalShell open onClose={onClose} title="Saving" closeDisabled>
        Content
      </ModalShell>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
    fireEvent.mouseDown(dialog.parentElement!);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();
  });

  it("supports hidden footers and explicit panel widths", () => {
    render(
      <ModalShell
        open
        onClose={vi.fn()}
        title="Wide dialog"
        width="min(1100px, calc(100vw - 2rem))"
        hideFooter
        footerRight={<button type="button">Hidden action</button>}
      >
        Content
      </ModalShell>
    );

    const dialog = screen.getByRole("dialog", { name: "Wide dialog" });
    expect(dialog).toHaveStyle({ width: "min(1100px, calc(100vw - 2rem))" });
    expect(screen.queryByRole("button", { name: "Hidden action" })).not.toBeInTheDocument();
  });
});