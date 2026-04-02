export type UnitMode = "cup" | "grams";
export type UnitCategory = "volume" | "weight" | "count";

export interface ConvertedQuantity {
  quantity: number | null;
  unit: string | null;
  approximate: boolean;
}

export const TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  "fl oz": 29.5735,
  cup: 236.588,
  pt: 473.176,
  qt: 946.353,
};

export const TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const COUNT_UNITS = new Set(["clove", "slice", "piece", "pinch", "dash"]);

export const DENSITY_G_PER_CUP: Record<string, number> = {
  "all-purpose flour": 125,
  "bread flour": 120,
  "whole wheat flour": 120,
  sugar: 200,
  "brown sugar": 220,
  "powdered sugar": 120,
  "icing sugar": 120,
  butter: 227,
  "olive oil": 216,
  "vegetable oil": 218,
  "coconut oil": 218,
  milk: 244,
  water: 237,
  "rolled oats": 90,
  oat: 90,
  "cocoa powder": 85,
  "cacao powder": 85,
  salt: 273,
  honey: 340,
  "maple syrup": 322,
  rice: 185,
  cornstarch: 128,
  "corn starch": 128,
  "baking soda": 230,
  "baking powder": 192,
};

function roundTo(value: number, decimals = 2) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function normalizeUnit(unit: string | null) {
  return unit ? unit.trim().toLowerCase() : null;
}

function densityFor(ingredientName: string) {
  const normalized = ingredientName.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const [key, density] of Object.entries(DENSITY_G_PER_CUP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return density;
    }
  }

  return null;
}

export function getUnitCategory(unit: string | null): UnitCategory {
  const normalized = normalizeUnit(unit);
  if (!normalized) {
    return "count";
  }

  if (normalized in TO_ML) {
    return "volume";
  }
  if (normalized in TO_G) {
    return "weight";
  }
  if (COUNT_UNITS.has(normalized)) {
    return "count";
  }

  return "count";
}

export function fromMl(ml: number): { quantity: number; unit: string } {
  const abs = Math.abs(ml);
  const quarterTspInMl = TO_ML.tsp / 4;
  if (abs >= TO_ML.qt) return { quantity: roundTo(ml / TO_ML.qt), unit: "qt" };
  if (abs >= TO_ML.pt) return { quantity: roundTo(ml / TO_ML.pt), unit: "pt" };
  if (abs >= TO_ML.cup) {
    return { quantity: roundTo(ml / TO_ML.cup), unit: "cup" };
  }
  if (abs >= TO_ML.tbsp) {
    return { quantity: roundTo(ml / TO_ML.tbsp), unit: "tbsp" };
  }
  if (abs >= quarterTspInMl) {
    return { quantity: roundTo(ml / TO_ML.tsp), unit: "tsp" };
  }
  return { quantity: roundTo(ml), unit: "ml" };
}

export function fromGrams(
  grams: number,
  targetMode: UnitMode
): { quantity: number; unit: string } {
  const abs = Math.abs(grams);
  if (targetMode === "cup") {
    if (abs >= TO_G.lb) {
      return { quantity: roundTo(grams / TO_G.lb), unit: "lb" };
    }
    return { quantity: roundTo(grams / TO_G.oz), unit: "oz" };
  }

  if (abs >= TO_G.kg) {
    return { quantity: roundTo(grams / TO_G.kg), unit: "kg" };
  }
  return { quantity: roundTo(grams), unit: "g" };
}

export function toBaseUnit(
  quantity: number | null,
  unit: string | null,
  _ingredientName: string
): { quantity: number | null; unit: string | null; approximate: boolean } {
  if (quantity === null) {
    return { quantity: null, unit, approximate: false };
  }

  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) {
    return { quantity, unit: null, approximate: false };
  }

  if (normalizedUnit in TO_ML) {
    return {
      quantity: roundTo(quantity * TO_ML[normalizedUnit]),
      unit: "ml",
      approximate: false,
    };
  }

  if (normalizedUnit in TO_G) {
    return {
      quantity: roundTo(quantity * TO_G[normalizedUnit]),
      unit: "g",
      approximate: false,
    };
  }

  if (COUNT_UNITS.has(normalizedUnit)) {
    return { quantity, unit: normalizedUnit, approximate: false };
  }

  return { quantity: null, unit: null, approximate: true };
}

export function convertIngredient(
  quantity: number | null,
  unit: string | null,
  ingredientName: string,
  targetMode: UnitMode
): ConvertedQuantity {
  if (quantity === null || unit === null) {
    return { quantity, unit, approximate: false };
  }

  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) {
    return { quantity, unit, approximate: false };
  }

  const category = getUnitCategory(normalizedUnit);
  if (category === "count") {
    return { quantity, unit: normalizedUnit, approximate: false };
  }

  if (category === "volume") {
    const ml = quantity * TO_ML[normalizedUnit];
    if (targetMode === "cup") {
      const converted = fromMl(ml);
      return {
        quantity: converted.quantity,
        unit: converted.unit,
        approximate: false,
      };
    }

    const density = densityFor(ingredientName);
    if (!density) {
      return { quantity, unit: normalizedUnit, approximate: true };
    }

    const grams = (ml / TO_ML.cup) * density;
    const converted = fromGrams(grams, "grams");
    return {
      quantity: converted.quantity,
      unit: converted.unit,
      approximate: true,
    };
  }

  const grams = quantity * TO_G[normalizedUnit];
  if (targetMode === "grams") {
    const converted = fromGrams(grams, "grams");
    return {
      quantity: converted.quantity,
      unit: converted.unit,
      approximate: false,
    };
  }

  const density = densityFor(ingredientName);
  if (!density) {
    return { quantity, unit: normalizedUnit, approximate: true };
  }

  const cups = grams / density;
  const converted = fromMl(cups * TO_ML.cup);
  return {
    quantity: converted.quantity,
    unit: converted.unit,
    approximate: true,
  };
}
