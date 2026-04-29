import type { MealPayload } from "./types";
import type { MenuLayout } from "./schemas/menu-export-schemas";

export type MenuMeal = {
  id: string;
  name: string;
  mealType: string;
  mealTypeLabel: string;
  mealTypeSortOrder: number;
  description: string | null;
  notes: string | null;
  cuisine: string | null;
  ingredients: string[];
  linkedRecipeTitle: string | null;
};

export type MenuDay = {
  key: string;
  label: string;
  weekday: string;
  meals: MenuMeal[];
};

export type MenuDocument = {
  title: string;
  from: string;
  to: string;
  layout: MenuLayout;
  generatedAt: string;
  days: MenuDay[];
};

type BuildMenuDocumentInput = {
  meals: MealPayload[];
  from: string;
  to: string;
  layout: MenuLayout;
  includeEmptyDays?: boolean;
  title?: string;
  generatedAt?: string;
};

const FALLBACK_MEAL_TYPE_ORDER = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "SNACK",
];

function normalizeDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function eachDate(from: string, to: string) {
  const start = normalizeDate(from);
  const end = normalizeDate(to);
  const dates: Date[] = [];
  let cursor = start;

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
}

function titleCaseMealType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatIngredient(ingredient: MealPayload["ingredients"][number]) {
  return [ingredient.quantity, ingredient.unit, ingredient.name]
    .filter((part) => part !== null && `${part}`.trim().length > 0)
    .join(" ");
}

function toMenuMeal(meal: MealPayload): MenuMeal {
  const fallbackOrder = FALLBACK_MEAL_TYPE_ORDER.indexOf(meal.mealType);
  const mealTypeSortOrder = meal.mealTypeDefinition?.sortOrder ?? (fallbackOrder >= 0 ? fallbackOrder : 999);

  return {
    id: meal.id,
    name: meal.name,
    mealType: meal.mealType,
    mealTypeLabel: meal.mealTypeDefinition?.name ?? titleCaseMealType(meal.mealType),
    mealTypeSortOrder,
    description: meal.linkedRecipe?.description ?? meal.description,
    notes: meal.notes,
    cuisine: meal.linkedRecipe?.cuisine ?? meal.cuisine,
    ingredients: (meal.linkedRecipe?.ingredients ?? meal.ingredients).map(formatIngredient),
    linkedRecipeTitle: meal.linkedRecipe?.title ?? null,
  };
}

export function buildMenuDocument({
  meals,
  from,
  to,
  layout,
  includeEmptyDays = true,
  title,
  generatedAt = new Date().toISOString(),
}: BuildMenuDocumentInput): MenuDocument {
  const mealsByDate = new Map<string, MealPayload[]>();

  for (const meal of meals) {
    if (!meal.date) {
      continue;
    }

    const key = dateKey(normalizeDate(meal.date));
    mealsByDate.set(key, [...(mealsByDate.get(key) ?? []), meal]);
  }

  const days = eachDate(from, to).map((date) => {
    const key = dateKey(date);
    const dayMeals = (mealsByDate.get(key) ?? [])
      .map(toMenuMeal)
      .sort(
        (left, right) =>
          left.mealTypeSortOrder - right.mealTypeSortOrder ||
          left.mealTypeLabel.localeCompare(right.mealTypeLabel) ||
          left.name.localeCompare(right.name)
      );

    return {
      key,
      label: formatDateLabel(date),
      weekday: formatWeekday(date),
      meals: dayMeals,
    };
  }).filter((day) => includeEmptyDays || day.meals.length > 0);

  return {
    title: title?.trim() || "Meal Plan Menu",
    from: dateKey(normalizeDate(from)),
    to: dateKey(normalizeDate(to)),
    layout,
    generatedAt,
    days,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{[\]}()#+.!|-])/g, "\\$1");
}

function escapeCsv(value: string | null | undefined) {
  const text = value ?? "";
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function layoutClass(layout: MenuLayout) {
  return `menu-${layout}`;
}

function renderMealHtml(meal: MenuMeal, detailed: boolean) {
  const description = detailed && meal.description ? `<p>${escapeHtml(meal.description)}</p>` : "";
  const notes = detailed && meal.notes ? `<p><strong>Notes:</strong> ${escapeHtml(meal.notes)}</p>` : "";
  const cuisine = detailed && meal.cuisine ? `<span>${escapeHtml(meal.cuisine)}</span>` : "";
  const ingredients =
    detailed && meal.ingredients.length > 0
      ? `<ul>${meal.ingredients.map((ingredient) => `<li>${escapeHtml(ingredient)}</li>`).join("")}</ul>`
      : "";

  return `<article class="menu-meal"><div class="menu-meal-heading"><span>${escapeHtml(meal.mealTypeLabel)}</span><h3>${escapeHtml(meal.name)}</h3></div>${cuisine ? `<div class="menu-meta">${cuisine}</div>` : ""}${description}${notes}${ingredients}</article>`;
}

export function formatMenuAsHtml(document: MenuDocument) {
  const detailed = document.layout === "card" || document.layout === "restaurant";
  const body = document.days
    .map((day) => {
      const meals = day.meals.length
        ? day.meals.map((meal) => renderMealHtml(meal, detailed)).join("")
        : `<p class="menu-empty">No meals planned.</p>`;
      return `<section class="menu-day"><header><p>${escapeHtml(day.weekday)}</p><h2>${escapeHtml(day.label)}</h2></header><div class="menu-meals">${meals}</div></section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(document.title)}</title>
  <style>
    body { margin: 0; padding: 32px; color: #1f241f; background: #fffdf8; font-family: Georgia, "Times New Roman", serif; }
    .menu-document { max-width: 1100px; margin: 0 auto; }
    .menu-title { margin: 0; font-size: 34px; line-height: 1.1; }
    .menu-range { margin: 8px 0 28px; color: #5f665f; font-family: Arial, sans-serif; }
    .menu-days { display: grid; gap: 18px; }
    .menu-classic-grid .menu-days { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    .menu-day { break-inside: avoid; border: 1px solid #ded6c7; background: #ffffff; padding: 16px; }
    .menu-day header p { margin: 0; color: #a4572b; font: 700 11px Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
    .menu-day header h2 { margin: 4px 0 14px; font-size: 20px; }
    .menu-meals { display: grid; gap: 12px; }
    .menu-card .menu-meals, .menu-restaurant .menu-meals { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .menu-meal { border-top: 1px solid #ece4d6; padding-top: 10px; }
    .menu-meal:first-child { border-top: 0; padding-top: 0; }
    .menu-meal-heading span { color: #3b5e45; font: 700 11px Arial, sans-serif; text-transform: uppercase; }
    .menu-meal-heading h3 { margin: 3px 0 4px; font-size: 17px; }
    .menu-meal p, .menu-meal li, .menu-empty { color: #333; font: 14px/1.45 Arial, sans-serif; }
    .menu-meal ul { margin: 8px 0 0 18px; padding: 0; }
    .menu-meta { color: #6f5b44; font: 700 12px Arial, sans-serif; }
    .menu-restaurant { text-align: center; }
    .menu-restaurant .menu-day { border: 0; border-top: 2px solid #1f241f; background: transparent; }
    @media print { body { padding: 0; background: #fff; color: #000; } .menu-day, .menu-meal { break-inside: avoid; } }
  </style>
</head>
<body>
  <main class="menu-document ${layoutClass(document.layout)}">
    <h1 class="menu-title">${escapeHtml(document.title)}</h1>
    <p class="menu-range">${escapeHtml(document.days[0]?.label ?? document.from)} - ${escapeHtml(document.days.at(-1)?.label ?? document.to)}</p>
    <div class="menu-days">${body}</div>
  </main>
</body>
</html>`;
}

export function formatMenuAsMarkdown(document: MenuDocument) {
  const lines = [`# ${escapeMarkdown(document.title)}`, ""];
  lines.push(`_${escapeMarkdown(document.days[0]?.label ?? document.from)} - ${escapeMarkdown(document.days.at(-1)?.label ?? document.to)}_`, "");

  for (const day of document.days) {
    lines.push(`## ${escapeMarkdown(day.weekday)}, ${escapeMarkdown(day.label)}`, "");

    if (day.meals.length === 0) {
      lines.push("No meals planned.", "");
      continue;
    }

    for (const meal of day.meals) {
      lines.push(`- **${escapeMarkdown(meal.mealTypeLabel)}:** ${escapeMarkdown(meal.name)}`);
      if (meal.description) lines.push(`  - ${escapeMarkdown(meal.description)}`);
      if (meal.notes) lines.push(`  - Notes: ${escapeMarkdown(meal.notes)}`);
    }

    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function formatMenuAsCsv(document: MenuDocument) {
  const rows = [["Date", "Weekday", "Meal Type", "Meal", "Cuisine", "Description", "Notes", "Ingredients"]];

  for (const day of document.days) {
    if (day.meals.length === 0) {
      rows.push([day.key, day.weekday, "", "", "", "", "", ""]);
      continue;
    }

    for (const meal of day.meals) {
      rows.push([
        day.key,
        day.weekday,
        meal.mealTypeLabel,
        meal.name,
        meal.cuisine ?? "",
        meal.description ?? "",
        meal.notes ?? "",
        meal.ingredients.join("; "),
      ]);
    }
  }

  return `${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}

export function formatMenuDocument(document: MenuDocument, format: "html" | "markdown" | "csv") {
  if (format === "markdown") return formatMenuAsMarkdown(document);
  if (format === "csv") return formatMenuAsCsv(document);
  return formatMenuAsHtml(document);
}
