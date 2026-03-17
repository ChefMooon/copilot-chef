import { parseIngredient } from "parse-ingredient";

import { TO_G, TO_ML } from "./unit-converter";

const UNIT_SYNONYMS: Record<string, string> = {
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  t: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  cup: "cup",
  cups: "cup",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  ml: "ml",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  l: "l",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  "fl oz": "fl oz",
  gram: "g",
  grams: "g",
  g: "g",
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  lb: "lb",
  clove: "clove",
  cloves: "clove",
  slice: "slice",
  slices: "slice",
  piece: "piece",
  pieces: "piece",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
  quart: "qt",
  quarts: "qt",
  qt: "qt",
  pint: "pt",
  pints: "pt",
  pt: "pt",
};

const NAME_NOTE_PATTERNS = [
  /\(optional\)/gi,
  /\boptional\b/gi,
  /\bto taste\b/gi,
  /\broughly chopped\b/gi,
  /\bfinely chopped\b/gi,
  /\bthinly sliced\b/gi,
  /\bdiced\b/gi,
  /\bminced\b/gi,
  /\bgrated\b/gi,
  /\bpeeled\b/gi,
  /\([^)]*\)/g,
];

const CANONICAL_UNITS = new Set([
  ...Object.keys(TO_ML),
  ...Object.keys(TO_G),
  "clove",
  "slice",
  "piece",
  "pinch",
  "dash",
  "qt",
  "pt",
]);

export interface NormalizedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  confidence: "high" | "low";
}

type ParsedIngredient = {
  quantity: number | null;
  quantity2: number | null;
  unitOfMeasureID: string | null;
  unitOfMeasure: string | null;
  description: string;
  isGroupHeader: boolean;
};

function collectNotes(rawName: string) {
  const notes: string[] = [];
  let working = rawName;

  for (const pattern of NAME_NOTE_PATTERNS) {
    const matches = working.match(pattern);
    if (matches) {
      notes.push(...matches.map((entry) => entry.trim()).filter(Boolean));
      working = working.replace(pattern, " ");
    }
  }

  return {
    name: working.replace(/\s+/g, " ").trim().replace(/^[,.-]+|[,.-]+$/g, ""),
    notes: notes.length > 0 ? notes.join("; ") : null,
  };
}

function normalizeUnit(rawUnit: string | null): string | null {
  if (!rawUnit) {
    return null;
  }

  const normalized = rawUnit.trim().toLowerCase();
  return UNIT_SYNONYMS[normalized] ?? null;
}

function parseFirstIngredient(raw: string): ParsedIngredient | null {
  const parsed = parseIngredient(raw, { normalizeUOM: true });
  if (!parsed || parsed.length === 0) {
    return null;
  }

  return parsed[0] as ParsedIngredient;
}

export function normalizeIngredient(raw: string): NormalizedIngredient {
  const parsed = parseFirstIngredient(raw);

  if (!parsed || parsed.isGroupHeader) {
    const fallback = collectNotes(raw);
    return {
      name: fallback.name,
      quantity: null,
      unit: null,
      notes: fallback.notes,
      confidence: "low",
    };
  }

  const normalizedUnit = normalizeUnit(parsed.unitOfMeasureID ?? parsed.unitOfMeasure);
  const nameData = collectNotes(parsed.description ?? raw);

  const hasValidQuantity = typeof parsed.quantity === "number";
  const hasKnownUnit =
    normalizedUnit === null ||
    UNIT_SYNONYMS[normalizedUnit] !== undefined ||
    CANONICAL_UNITS.has(normalizedUnit);

  const confidence: "high" | "low" =
    !hasValidQuantity || !hasKnownUnit || !nameData.name ? "low" : "high";

  return {
    name: nameData.name || raw.trim(),
    quantity: hasValidQuantity ? parsed.quantity : null,
    unit: normalizedUnit,
    notes: nameData.notes,
    confidence,
  };
}

export function normalizeIngredients(raws: string[]): NormalizedIngredient[] {
  return raws.map((raw) => normalizeIngredient(raw));
}
