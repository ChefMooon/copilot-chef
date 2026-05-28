// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AccessibleHeatmapCell,
  getHeatmapCellA11yMetadata,
} from "./accessible-heatmap-cell";

describe("accessible heatmap cell", () => {
  it("builds an explicit metadata contract for completed days", () => {
    const metadata = getHeatmapCellA11yMetadata({
      date: "2026-05-28",
      meals: 2,
      isFuture: false,
    });

    expect(metadata.ariaLabel).toBe("May 28, 2026: 2 meals");
    expect(metadata.tooltipText).toBe("May 28, 2026 — 2 meals");
  });

  it("builds future-day metadata with not-yet wording", () => {
    const metadata = getHeatmapCellA11yMetadata({
      date: "2026-05-29",
      meals: 0,
      isFuture: true,
    });

    expect(metadata.ariaLabel).toBe("May 29, 2026: Not yet");
    expect(metadata.tooltipText).toBe("Not yet");
  });

  it("surfaces label and tooltip callbacks through the shared primitive", () => {
    const onMouseEnterTooltip = vi.fn();
    const onMouseLeaveTooltip = vi.fn();

    render(
      <AccessibleHeatmapCell
        cell={{ date: "2026-05-28", meals: 1, isFuture: false }}
        className="square"
        onMouseEnterTooltip={onMouseEnterTooltip}
        onMouseLeaveTooltip={onMouseLeaveTooltip}
        style={{ gridColumn: 2, gridRow: 3, background: "#6FA882" }}
      />
    );

    const button = screen.getByRole("button", { name: "May 28, 2026: 1 meal" });
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);

    expect(onMouseEnterTooltip).toHaveBeenCalledOnce();
    expect(onMouseEnterTooltip.mock.calls[0]?.[1]).toBe("May 28, 2026 — 1 meal");
    expect(onMouseLeaveTooltip).toHaveBeenCalledOnce();
  });
});