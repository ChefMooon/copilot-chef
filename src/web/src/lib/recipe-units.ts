export type UnitMode = "cup" | "grams";

type ConvertedQuantity = {
  quantity: number | null;
  unit: string | null;
  approximate: boolean;
};

const TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  "fl oz": 29.5735,
  cup: 236.588,
  pt: 473.176,
  qt: 946.353,
};

const TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const DENSITY_G_PER_CUP: Record<string, number> = {
  "all-purpose flour": 125,
  "bread flour": 120,
  sugar: 200,
  "brown sugar": 220,
  butter: 227,
  "olive oil": 216,
  "vegetable oil": 218,
  milk: 244,
  water: 237,
  "rolled oats": 90,
  "cocoa powder": 85,
  salt: 273,
  honey: 340,
  rice: 185,
  cornstarch: 128,
  "baking soda": 230,
  "baking powder": 192,
};

const COUNT_UNITS = new Set(["clove", "slice", "piece", "pinch", "dash"]);

function roundTo(value: number, decimals = 2) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function fromMl(ml: number) {
  const abs = Math.abs(ml);
  if (abs >= TO_ML.qt) return { quantity: roundTo(ml / TO_ML.qt), unit: "qt" };
  if (abs >= TO_ML.pt) return { quantity: roundTo(ml / TO_ML.pt), unit: "pt" };
  if (abs >= TO_ML.cup) return { quantity: roundTo(ml / TO_ML.cup), unit: "cup" };
  if (abs >= TO_ML.tbsp) {
    return { quantity: roundTo(ml / TO_ML.tbsp), unit: "tbsp" };
  }
  if (abs >= TO_ML.tsp) return { quantity: roundTo(ml / TO_ML.tsp), unit: "tsp" };
  return { quantity: roundTo(ml), unit: "ml" };
}

function fromGrams(grams: number) {
  const abs = Math.abs(grams);
  if (abs >= TO_G.kg) return { quantity: roundTo(grams / TO_G.kg), unit: "kg" };
  return { quantity: roundTo(grams), unit: "g" };
}

function densityFor(name: string) {
  const normalized = name.trim().toLowerCase();
  for (const [key, density] of Object.entries(DENSITY_G_PER_CUP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return density;
    }
  }
  return null;
}

export function convertIngredient(
  quantity: number | null,
  unit: string | null,
  ingredientName: string,
  targetMode: UnitMode
): ConvertedQuantity {
  if (quantity == null || !unit) {
    return { quantity, unit, approximate: false };
  }

  const normalizedUnit = unit.toLowerCase().trim();
  if (COUNT_UNITS.has(normalizedUnit)) {
    return { quantity, unit: normalizedUnit, approximate: false };
  }

  if (normalizedUnit in TO_ML) {
    const ml = quantity * TO_ML[normalizedUnit];
    if (targetMode === "cup") {
      const converted = fromMl(ml);
      return { ...converted, approximate: false };
    }
    const density = densityFor(ingredientName);
    if (!density) {
      return { quantity, unit: normalizedUnit, approximate: true };
    }
    const grams = (ml / TO_ML.cup) * density;
    const converted = fromGrams(grams);
    return { ...converted, approximate: true };
  }

  if (normalizedUnit in TO_G) {
    const grams = quantity * TO_G[normalizedUnit];
    if (targetMode === "grams") {
      const converted = fromGrams(grams);
      return { ...converted, approximate: false };
    }
    const density = densityFor(ingredientName);
    if (!density) {
      return { quantity, unit: normalizedUnit, approximate: true };
    }
    const cups = grams / density;
    const converted = fromMl(cups * TO_ML.cup);
    return { ...converted, approximate: true };
  }

  return { quantity, unit: normalizedUnit, approximate: false };
}
