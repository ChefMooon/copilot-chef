// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewListModal } from "./NewListModal";

describe("NewListModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables Create List while name is empty", async () => {
    render(<NewListModal onClose={() => {}} onCreate={async () => {}} />);

    expect(
      await screen.findByRole("button", { name: "Close create grocery list dialog" })
    ).toBeEnabled();
    const button = await screen.findByRole("button", { name: "Create List" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("e.g. This Week's Shop"), {
      target: { value: "Weekly" },
    });

    expect(button).not.toBeDisabled();
  });

  it("submits null date when ongoing is checked", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<NewListModal onClose={() => {}} onCreate={onCreate} />);

    const nameInput = await screen.findByPlaceholderText("e.g. This Week's Shop");
    fireEvent.change(nameInput, { target: { value: "This Week" } });

    fireEvent.click(screen.getByLabelText("Ongoing list (no date)"));
    fireEvent.click(screen.getByRole("button", { name: "Create List" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        name: "This Week",
        date: null,
      });
    });
  });
});
