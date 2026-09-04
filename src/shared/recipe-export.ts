import type { RecipeIterationPayload, RecipePayload } from "./types";

export const RECIPE_EXPORT_LAYOUT = "basic-recipe" as const;

export type RecipeExportLayout = typeof RECIPE_EXPORT_LAYOUT;

export type RecipeExportSelection = {
  description: boolean;
  ingredients: boolean;
  instructions: boolean;
  cookNotes: boolean;
  basicMetadata: boolean;
  sourceTags: boolean;
  personalStatus: boolean;
  lineage: boolean;
};

export const DEFAULT_RECIPE_EXPORT_SELECTION: RecipeExportSelection = {
  description: true,
  ingredients: true,
  instructions: true,
  cookNotes: true,
  basicMetadata: true,
  sourceTags: true,
  personalStatus: false,
  lineage: false,
};

export type RecipeExportIngredient = {
  name: string;
  quantity: string | null;
  unit: string | null;
  approximate: boolean;
  group: string;
  notes: string | null;
  order: number;
};

export type RecipeExportIngredientGroup = {
  name: string | null;
  ingredients: RecipeExportIngredient[];
};

export type RecipeExportMetadata = {
  difficulty: string | null;
  cuisine: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
};

export type RecipeExportSourceTags = {
  label: string | null;
  url: string | null;
  tags: string[];
};

export type RecipeExportPersonalStatus = {
  favourite: boolean;
  rating: number | null;
  origin: string | null;
  lastMadeAt: string | null;
};

export type RecipeExportLineage = {
  sourceRecipe: { id: string; title: string } | null;
  derivedRecipes: Array<{ id: string; title: string }>;
};

export type RecipeExportDocument = {
  layout: RecipeExportLayout;
  generatedAt: string;
  identity: {
    id: string;
    title: string;
  };
  description?: string;
  ingredients?: RecipeExportIngredientGroup[];
  instructions?: string[];
  cookNotes?: string;
  basicMetadata?: RecipeExportMetadata;
  sourceTags?: RecipeExportSourceTags;
  personalStatus?: RecipeExportPersonalStatus;
  lineage?: RecipeExportLineage;
};

export type RecipeExportQuantity = {
  quantity: number | null;
  unit: string | null;
  approximate: boolean;
};

export type RecipeExportBuildInput = {
  recipe: RecipePayload;
  servings: number;
  unitMode: string;
  selection?: RecipeExportSelection;
  iterations?: RecipeIterationPayload[];
  generatedAt?: string;
  convertQuantity?: (
    quantity: number | null,
    unit: string | null,
    ingredientName: string,
    unitMode: string
  ) => RecipeExportQuantity;
  formatQuantity?: (quantity: number) => string;
};

function defaultFormatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(Math.round(quantity * 100) / 100);
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function hasIngredientData(ingredient: RecipeExportIngredient): boolean {
  return Boolean(ingredient.name.trim() || ingredient.quantity || ingredient.unit || ingredient.notes);
}

export function buildRecipeDocument({
  recipe,
  servings,
  unitMode,
  selection = DEFAULT_RECIPE_EXPORT_SELECTION,
  iterations = [],
  generatedAt = new Date().toISOString(),
  convertQuantity = (quantity, unit) => ({ quantity, unit, approximate: false }),
  formatQuantity = defaultFormatQuantity,
}: RecipeExportBuildInput): RecipeExportDocument {
  const safeServings = Math.max(1, servings || recipe.servings || 1);
  const scale = safeServings / Math.max(1, recipe.servings || 1);
  const ingredients = recipe.ingredients
    .map((ingredient) => {
      const converted = convertQuantity(
        ingredient.quantity == null ? null : ingredient.quantity * scale,
        ingredient.unit,
        ingredient.name,
        unitMode
      );
      return {
        name: ingredient.name,
        quantity: converted.quantity == null ? null : formatQuantity(converted.quantity),
        unit: converted.unit,
        approximate: converted.approximate,
        group: ingredient.group?.trim() ?? "",
        notes: ingredient.notes,
        order: ingredient.order,
      } satisfies RecipeExportIngredient;
    })
    .filter(hasIngredientData)
    .sort((left, right) => left.order - right.order);

  const ingredientGroups = Array.from(
    ingredients.reduce((groups, ingredient) => {
      const group = groups.get(ingredient.group) ?? [];
      group.push(ingredient);
      groups.set(ingredient.group, group);
      return groups;
    }, new Map<string, RecipeExportIngredient[]>()),
  ).map(([name, groupedIngredients]) => ({
    name: name || null,
    ingredients: groupedIngredients,
  }));

  const document: RecipeExportDocument = {
    layout: RECIPE_EXPORT_LAYOUT,
    generatedAt,
    identity: { id: recipe.id, title: recipe.title },
  };

  if (selection.description && hasText(recipe.description)) document.description = recipe.description.trim();
  if (selection.ingredients && ingredientGroups.length) document.ingredients = ingredientGroups;
  if (selection.instructions && recipe.instructions.some(hasText)) {
    document.instructions = recipe.instructions.filter(hasText).map((step) => step.trim());
  }
  if (selection.cookNotes && hasText(recipe.cookNotes)) document.cookNotes = recipe.cookNotes.trim();
  if (selection.basicMetadata) {
    document.basicMetadata = {
      difficulty: recipe.difficulty,
      cuisine: recipe.cuisine,
      servings: safeServings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
    };
  }
  if (selection.sourceTags && (hasText(recipe.sourceLabel) || hasText(recipe.sourceUrl) || recipe.tags.length)) {
    document.sourceTags = {
      label: recipe.sourceLabel,
      url: recipe.sourceUrl,
      tags: recipe.tags.filter(hasText).map((tag) => tag.trim()),
    };
  }
  if (selection.personalStatus) {
    document.personalStatus = {
      favourite: recipe.favourite,
      rating: recipe.rating,
      origin: hasText(recipe.origin) ? recipe.origin : null,
      lastMadeAt: recipe.lastMadeAt,
    };
  }
  if (selection.lineage && (recipe.sourceRecipe || iterations.length)) {
    document.lineage = {
      sourceRecipe: recipe.sourceRecipe ?? null,
      derivedRecipes: iterations.map(({ id, title }) => ({ id, title })),
    };
  }

  return document;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_[\]{}()#+.!|-])/g, "\\$1");
}

function escapeMarkdownUrl(value: string): string {
  return value.replace(/([\\)])/g, "\\$1");
}

function escapeCsv(value: string | number | boolean | null | undefined): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function safeSourceLink(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function ingredientText(ingredient: RecipeExportIngredient): string {
  const quantity = ingredient.quantity ? `${ingredient.approximate ? "~" : ""}${ingredient.quantity}` : "";
  return [quantity, ingredient.unit ?? "", ingredient.name].filter(Boolean).join(" ");
}

function metadataEntries(document: RecipeExportDocument): Array<[string, string | number | boolean | null]> {
  const entries: Array<[string, string | number | boolean | null]> = [];
  const metadata = document.basicMetadata;
  if (metadata) {
    entries.push(["difficulty", metadata.difficulty], ["cuisine", metadata.cuisine], ["servings", metadata.servings], ["prepTime", metadata.prepTime], ["cookTime", metadata.cookTime]);
  }
  const source = document.sourceTags;
  if (source) {
    entries.push(["sourceLabel", source.label], ["sourceUrl", source.url]);
    if (source.tags.length) entries.push(["tags", source.tags.join(", ")]);
  }
  const personal = document.personalStatus;
  if (personal) {
    entries.push(["favourite", personal.favourite], ["rating", personal.rating], ["origin", personal.origin], ["lastMadeAt", personal.lastMadeAt]);
  }
  const lineage = document.lineage;
  if (lineage?.sourceRecipe) entries.push(["sourceRecipe", `${lineage.sourceRecipe.title} (${lineage.sourceRecipe.id})`]);
  if (lineage?.derivedRecipes.length) entries.push(["derivedRecipes", lineage.derivedRecipes.map((recipe) => `${recipe.title} (${recipe.id})`).join(", ")]);
  return entries.filter(([, value]) => value !== null && value !== "");
}

export function formatRecipeAsHtml(document: RecipeExportDocument): string {
  const sections: string[] = [];
  if (document.description) sections.push(`<section><h2>Description</h2><p>${escapeHtml(document.description)}</p></section>`);
  if (document.ingredients) {
    const groups = document.ingredients.map((group) => `<div class="ingredient-group">${group.name ? `<h3>${escapeHtml(group.name)}</h3>` : ""}<ul>${group.ingredients.map((ingredient) => `<li><span>${escapeHtml(ingredientText(ingredient))}</span>${ingredient.notes ? ` <small>${escapeHtml(ingredient.notes)}</small>` : ""}</li>`).join("")}</ul></div>`).join("");
    sections.push(`<section><h2>Ingredients</h2>${groups}</section>`);
  }
  if (document.instructions) sections.push(`<section><h2>Instructions</h2><ol>${document.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></section>`);
  if (document.cookNotes) sections.push(`<section><h2>Cook Notes</h2><p>${escapeHtml(document.cookNotes)}</p></section>`);
  if (document.basicMetadata) sections.push(`<section><h2>Recipe Details</h2><dl>${metadataEntries({ ...document, basicMetadata: document.basicMetadata }).slice(0, 5).map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`).join("")}</dl></section>`);
  if (document.sourceTags) {
    const source = document.sourceTags;
    const sourceValue = source.url && safeSourceLink(source.url) ? `<a href="${escapeHtml(safeSourceLink(source.url) as string)}">${escapeHtml(source.url)}</a>` : escapeHtml(source.url ?? "");
    sections.push(`<section><h2>Source &amp; Tags</h2>${source.label ? `<p>${escapeHtml(source.label)}</p>` : ""}${source.url ? `<p>${sourceValue}</p>` : ""}${source.tags.length ? `<p>${source.tags.map(escapeHtml).join(", ")}</p>` : ""}</section>`);
  }
  if (document.personalStatus) sections.push(`<section><h2>Personal Status</h2><dl>${metadataEntries({ ...document, basicMetadata: undefined, sourceTags: undefined, lineage: undefined }).map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`).join("")}</dl></section>`);
  if (document.lineage) sections.push(`<section><h2>Lineage</h2><p>${escapeHtml(metadataEntries({ ...document, basicMetadata: undefined, sourceTags: undefined, personalStatus: undefined }).map(([, value]) => String(value)).join("; "))}</p></section>`);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(document.identity.title)}</title><style>body{margin:0;padding:32px;color:#2c2416;background:#fffdf8;font-family:Arial,sans-serif;line-height:1.5}.recipe-document{max-width:860px;margin:0 auto}h1,h2,h3{font-family:Georgia,serif}h1{font-size:34px;line-height:1.1;margin:0}h2{border-bottom:1px solid #ede6d6;padding-bottom:6px}section{break-inside:avoid;margin-top:24px}li{margin:6px 0}small{color:#7a6a58}dt{color:#7a6a58;font-weight:700;float:left;clear:left;width:140px}dd{margin-left:150px}@media print{body{padding:0;background:#fff}.recipe-document{max-width:none}section{break-inside:avoid}}</style></head><body><main class="recipe-document layout-${document.layout}"><h1>${escapeHtml(document.identity.title)}</h1>${sections.join("")}</main></body></html>`;
}

export function formatRecipeAsMarkdown(document: RecipeExportDocument): string {
  const lines = [`# ${escapeMarkdown(document.identity.title)}`, ""];
  if (document.description) lines.push(escapeMarkdown(document.description), "");
  if (document.ingredients) {
    lines.push("## Ingredients", "");
    for (const group of document.ingredients) {
      if (group.name) lines.push(`### ${escapeMarkdown(group.name)}`, "");
      for (const ingredient of group.ingredients) lines.push(`- ${escapeMarkdown(ingredientText(ingredient))}${ingredient.notes ? ` (${escapeMarkdown(ingredient.notes)})` : ""}`);
      lines.push("");
    }
  }
  if (document.instructions) {
    lines.push("## Instructions", "");
    document.instructions.forEach((step, index) => lines.push(`${index + 1}. ${escapeMarkdown(step)}`));
    lines.push("");
  }
  if (document.cookNotes) lines.push("## Cook Notes", "", escapeMarkdown(document.cookNotes), "");
  for (const [heading, entries] of [["Recipe Details", document.basicMetadata], ["Source & Tags", document.sourceTags], ["Personal Status", document.personalStatus], ["Lineage", document.lineage]] as const) {
    if (!entries) continue;
    lines.push(`## ${heading}`, "");
    const sectionDocument = { ...document, basicMetadata: heading === "Recipe Details" ? document.basicMetadata : undefined, sourceTags: heading === "Source & Tags" ? document.sourceTags : undefined, personalStatus: heading === "Personal Status" ? document.personalStatus : undefined, lineage: heading === "Lineage" ? document.lineage : undefined };
    for (const [key, value] of metadataEntries(sectionDocument)) {
      const renderedValue = key === "sourceUrl" && typeof value === "string" && safeSourceLink(value)
        ? `[${value}](${escapeMarkdownUrl(safeSourceLink(value) as string)})`
        : escapeMarkdown(String(value));
      lines.push(`- ${escapeMarkdown(key)}: ${renderedValue}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

export const RECIPE_EXPORT_CSV_COLUMNS = ["section", "type", "key", "value", "group", "quantity", "unit", "notes", "order"] as const;

export function formatRecipeAsCsv(document: RecipeExportDocument): string {
  const rows: Array<Array<string | number | boolean | null>> = [Array.from(RECIPE_EXPORT_CSV_COLUMNS)];
  for (const [key, value] of metadataEntries(document)) rows.push(["metadata", "field", key, value, "", "", "", "", ""]);
  if (document.ingredients) for (const group of document.ingredients) for (const ingredient of group.ingredients) rows.push(["ingredients", "ingredient", "", "", group.name ?? "", ingredient.quantity, ingredient.unit, ingredient.notes, ingredient.order]);
  if (document.instructions) document.instructions.forEach((step, index) => rows.push(["instructions", "instruction", "", step, "", "", "", "", index + 1]));
  return `${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}

export function formatRecipeDocument(document: RecipeExportDocument, format: "html" | "markdown" | "csv"): string {
  if (format === "markdown") return formatRecipeAsMarkdown(document);
  if (format === "csv") return formatRecipeAsCsv(document);
  return formatRecipeAsHtml(document);
}
