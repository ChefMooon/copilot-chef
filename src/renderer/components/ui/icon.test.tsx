// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { Star } from "@phosphor-icons/react";
import { describe, expect, it } from "vitest";

import { VisualIcon } from "./icon";

describe("VisualIcon", () => {
  it("applies stable visual defaults and forwards caller semantics", () => {
    render(
      <VisualIcon
        aria-hidden="true"
        aria-label="Favourite"
        className="icon-test"
        data-testid="favourite-icon"
        icon={Star}
      />
    );

    const icon = screen.getByTestId("favourite-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("aria-label", "Favourite");
    expect(icon).toHaveAttribute("width", "18");
    expect(icon).toHaveAttribute("height", "18");
    expect(icon).toHaveAttribute("fill", "currentColor");
    expect(icon).toHaveClass("icon-test");
  });

  it("allows explicit visual overrides", () => {
    render(
      <VisualIcon
        data-testid="custom-icon"
        icon={Star}
        size={24}
        weight="bold"
      />
    );

    const icon = screen.getByTestId("custom-icon");
    expect(icon).toHaveAttribute("width", "24");
    expect(icon).toHaveAttribute("height", "24");
  });
});