const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "¼": "1/4",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

const FRACTION_DISPLAY_LOOKUP: Array<{ value: number; label: string }> = [
  { value: 1 / 8, label: "⅛" },
  { value: 1 / 4, label: "¼" },
  { value: 1 / 3, label: "⅓" },
  { value: 3 / 8, label: "⅜" },
  { value: 1 / 2, label: "½" },
  { value: 5 / 8, label: "⅝" },
  { value: 2 / 3, label: "⅔" },
  { value: 3 / 4, label: "¾" },
  { value: 7 / 8, label: "⅞" },
];

function normalizeFractionText(value: string): string {
  let normalized = value.trim();
  for (const [symbol, replacement] of Object.entries(UNICODE_FRACTIONS)) {
    normalized = normalized.replaceAll(symbol, ` ${replacement} `);
  }
  return normalized.replace(/\s+/g, " ").trim();
}

function parseSimpleFraction(value: string): number | null {
  const match = value.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (!match) {
    return null;
  }

  const numerator = Number.parseInt(match[1], 10);
  const denominator = Number.parseInt(match[2], 10);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function roundTo(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function parseFraction(value: string): number | null {
  const normalized = normalizeFractionText(value);
  if (!normalized) {
    return null;
  }

  const mixedMatch = normalized.match(/^(-?\d+)\s+(-?\d+\s*\/\s*\d+)$/);
  if (mixedMatch) {
    const whole = Number.parseInt(mixedMatch[1], 10);
    const fractional = parseSimpleFraction(mixedMatch[2]);
    if (fractional == null || !Number.isFinite(whole)) {
      return null;
    }

    const sign = whole < 0 ? -1 : 1;
    return roundTo(whole + sign * Math.abs(fractional));
  }

  const simpleFraction = parseSimpleFraction(normalized);
  if (simpleFraction != null) {
    return roundTo(simpleFraction);
  }

  const asNumber = Number.parseFloat(normalized);
  if (!Number.isFinite(asNumber)) {
    return null;
  }

  return roundTo(asNumber);
}

export function formatFraction(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  const negative = value < 0;
  const absValue = Math.abs(value);
  const whole = Math.floor(absValue);
  const fractional = absValue - whole;

  const nearest = FRACTION_DISPLAY_LOOKUP.reduce((best, candidate) => {
    const currentDiff = Math.abs(candidate.value - fractional);
    const bestDiff = Math.abs(best.value - fractional);
    return currentDiff < bestDiff ? candidate : best;
  });

  const tolerance = 0.02;
  const useFraction = Math.abs(nearest.value - fractional) <= tolerance && fractional > 0;

  let output = "";
  if (useFraction) {
    output = whole > 0 ? `${whole}${nearest.label}` : nearest.label;
  } else if (Number.isInteger(absValue)) {
    output = String(whole);
  } else {
    output = String(roundTo(absValue, 2));
  }

  return negative ? `-${output}` : output;
}
