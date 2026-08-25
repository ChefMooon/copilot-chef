// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SegmentedCodeInput } from "./segmented-code-input";

function renderInput(onChange = vi.fn()) {
  render(
    <SegmentedCodeInput
      id="code"
      label="4-digit code"
      length={4}
      onChange={onChange}
      value=""
    />
  );
  return onChange;
}

afterEach(() => {
  cleanup();
});

describe("SegmentedCodeInput", () => {
  it("renders one input per segment with accessible labels", () => {
    renderInput();
    expect(screen.getByRole("group", { name: /4-digit code/i })).toBeTruthy();
    expect(screen.getByLabelText("Digit 1 of 4")).toBeTruthy();
    expect(screen.getByLabelText("Digit 4 of 4")).toBeTruthy();
  });

  it("advances focus to the next segment when a digit is typed", () => {
    renderInput();
    const first = screen.getByLabelText("Digit 1 of 4") as HTMLInputElement;
    const second = screen.getByLabelText("Digit 2 of 4") as HTMLInputElement;

    fireEvent.focus(first);
    fireEvent.change(first, { target: { value: "7" } });

    expect(document.activeElement).toBe(second);
  });

  it("moves back and clears the previous segment on backspace from an empty segment", () => {
    const onChange = vi.fn();
    let value = "12";
    render(
      <SegmentedCodeInput
        id="code"
        label="4-digit code"
        length={4}
        onChange={(next) => {
          value = next;
          onChange(next);
        }}
        value={value}
      />
    );

    const third = screen.getByLabelText("Digit 3 of 4") as HTMLInputElement;
    const second = screen.getByLabelText("Digit 2 of 4") as HTMLInputElement;

    fireEvent.focus(third);
    fireEvent.keyDown(third, { key: "Backspace" });

    expect(onChange).toHaveBeenCalledWith("1");
    expect(document.activeElement).toBe(second);
  });

  it("distributes pasted digits across segments", () => {
    const onChange = vi.fn();
    render(
      <SegmentedCodeInput
        id="code"
        label="4-digit code"
        length={4}
        onChange={onChange}
        value=""
      />
    );
    const first = screen.getByLabelText("Digit 1 of 4") as HTMLInputElement;

    fireEvent.paste(first, {
      clipboardData: { getData: () => "1234" },
    });

    expect(onChange).toHaveBeenCalledWith("1234");
  });
});
