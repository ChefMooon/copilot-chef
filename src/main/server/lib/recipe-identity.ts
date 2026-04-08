export function collapseRecipeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeRecipeTitle(title: string) {
  return collapseRecipeWhitespace(title);
}

export function normalizeRecipeTitle(title: string) {
  return sanitizeRecipeTitle(title).toLowerCase();
}

export function normalizeRecipeSourceUrl(sourceUrl: string | null | undefined) {
  const trimmed = sourceUrl?.trim();
  if (!trimmed) {
    return null;
  }

  return new URL(trimmed).toString();
}

export function buildDuplicateRecipeTitle(baseTitle: string, copyNumber: number) {
  const normalizedBaseTitle = sanitizeRecipeTitle(baseTitle) || "Untitled Recipe";

  if (copyNumber <= 1) {
    return `${normalizedBaseTitle} (Copy)`;
  }

  return `${normalizedBaseTitle} (Copy ${copyNumber})`;
}