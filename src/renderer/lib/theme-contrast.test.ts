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
