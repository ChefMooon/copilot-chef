import { describe, expect, it } from "vitest";

function relativeLuminance(hexColor: string) {
  const channels = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hexColor.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(firstColor: string, secondColor: string) {
  const firstLuminance = relativeLuminance(firstColor);
  const secondLuminance = relativeLuminance(secondColor);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe("dark theme contrast tokens", () => {
  const background = "#0d1410";
  const card = "#18241d";
  const border = "#607568";
  const header = "#173025";
  const activeNavigation = "#527f60";

  it("keeps structural borders distinguishable from page and card surfaces", () => {
    expect(contrastRatio(border, background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(border, card)).toBeGreaterThanOrEqual(3);
  });

  it("keeps active navigation distinguishable from the title bar", () => {
    expect(contrastRatio(activeNavigation, header)).toBeGreaterThanOrEqual(3);
  });
});

describe("light theme Upcoming Meals boundary contrast tokens", () => {
  const background = "#f5f0e8";
  const card = "#fffdf8";
  const muted = "#ede6d6";
  const border = "#70685a";

  it("keeps Upcoming Meals group and meal boundaries distinguishable", () => {
    expect(contrastRatio(border, muted)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(border, card)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(border, background)).toBeGreaterThanOrEqual(3);
  });
});

describe("settings tab selected-state contrast tokens", () => {
  it("keeps the selected tab legible in light mode", () => {
    expect(contrastRatio("#3b5e45", "#d4e4d8")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#3b5e45", "#f5f0e8")).toBeGreaterThanOrEqual(3);
  });

  it("keeps the selected tab legible in dark mode", () => {
    expect(contrastRatio("#f1f7f1", "#21352c")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#a5d8b3", "#0d1410")).toBeGreaterThanOrEqual(3);
  });
});
