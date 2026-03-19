/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteConfirmationModal } from "./DeleteConfirmationModal";

afterEach(() => {
  cleanup();
});

describe("DeleteConfirmationModal", () => {
  it("focuses Delete Meal button on open so Enter confirms by default", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      React.createElement(DeleteConfirmationModal, {
        mealName: "Pasta",
        isOpen: true,
        isLoading: false,
        onConfirm,
        onCancel,
      })
    );

    const deleteButton = await screen.findByRole("button", {
      name: "Delete Meal",
    });

    await waitFor(() => {
      expect(deleteButton).toHaveFocus();
    });
  });

  it("calls onCancel when Escape is pressed", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      React.createElement(DeleteConfirmationModal, {
        mealName: "Soup",
        isOpen: true,
        isLoading: false,
        onConfirm,
        onCancel,
      })
    );

    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
