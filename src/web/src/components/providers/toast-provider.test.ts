/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "./toast-provider";

function ToastHarness({ onUndo }: { onUndo: () => void }) {
  const { toast } = useToast();

  return React.createElement(
    "button",
    {
      onClick: () => {
        toast({
          title: "Restored Lemon Pasta",
          description: "Meal restored.",
          duration: 5000,
          action: {
            label: "Undo",
            onClick: onUndo,
          },
        });
      },
      type: "button",
    },
    "Trigger Toast"
  );
}

afterEach(() => {
  cleanup();
});

describe("ToastProvider", () => {
  it("renders toast content, applies custom duration, and runs action callback", async () => {
    const onUndo = vi.fn();

    const { container } = render(
      React.createElement(
        ToastProvider,
        null,
        React.createElement(ToastHarness, { onUndo })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Trigger Toast" }));

    expect(await screen.findByText("Restored Lemon Pasta")).toBeInTheDocument();
    expect(screen.getByText("Meal restored.")).toBeInTheDocument();

    const toastRoot = container.querySelector("[data-duration='5000']");
    expect(toastRoot).not.toBeNull();

    const undoButton = screen.getByRole("button", { name: "Undo" });
    const progressFill = undoButton.querySelector("span[aria-hidden='true']");
    expect(progressFill).not.toBeNull();
    expect(progressFill?.getAttribute("style")).toContain(
      "toast-progress-fill 5000ms"
    );

    fireEvent.click(undoButton);
    expect(onUndo).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        screen.queryByText("Restored Lemon Pasta")
      ).not.toBeInTheDocument();
    });
  });

  it("closes toast when the top-right close button is clicked", async () => {
    const onUndo = vi.fn();

    render(
      React.createElement(
        ToastProvider,
        null,
        React.createElement(ToastHarness, { onUndo })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Trigger Toast" }));
    expect(await screen.findByText("Restored Lemon Pasta")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close toast" }));

    await waitFor(() => {
      expect(
        screen.queryByText("Restored Lemon Pasta")
      ).not.toBeInTheDocument();
    });

    expect(onUndo).not.toHaveBeenCalled();
  });
});
