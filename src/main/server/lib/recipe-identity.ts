export function collapseRecipeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeRecipeTitle(title: string) {
  return collapseRecipeWhitespace(title);
}

export function normalizeRecipeTitle(title: string) {
  return sanitizeRecipeTitle(title).toLowerCase();
}

const ANALYTICS_PARAMETER_PATTERNS = [/^utm_/i];
const ANALYTICS_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "twclid",
  "yclid",
  "gbraid",
  "wbraid",
  "_gl",
]);

function createRecipeUrl(sourceUrl: string) {
  const trimmed = sourceUrl.trim();
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^\/\//.test(trimmed)
      ? `https:${trimmed}`
      : `https://${trimmed}`;

  return new URL(candidate);
}

function removeAnalyticsParameters(url: URL) {
  for (const parameter of Array.from(url.searchParams.keys())) {
    if (
      ANALYTICS_PARAMETERS.has(parameter.toLowerCase()) ||
      ANALYTICS_PARAMETER_PATTERNS.some((pattern) => pattern.test(parameter))
    ) {
      url.searchParams.delete(parameter);
    }
  }
}

function normalizeRecipeUrlPath(url: URL) {
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/$/, "");
  }
}

export function cleanRecipeSourceUrl(sourceUrl: string | null | undefined) {
  const trimmed = sourceUrl?.trim();
  if (!trimmed) {
    return null;
  }

  const url = createRecipeUrl(trimmed);
  url.hash = "";
  removeAnalyticsParameters(url);
  url.search = url.searchParams.toString();

  return url.toString();
}

export function normalizeRecipeSourceUrl(sourceUrl: string | null | undefined) {
  const cleaned = cleanRecipeSourceUrl(sourceUrl);
  if (!cleaned) {
    return null;
  }

  const url = new URL(cleaned);
  url.hostname = url.hostname.replace(/^www\./i, "");
  normalizeRecipeUrlPath(url);
  url.search = url.searchParams.toString();

  return url.toString();
}

export function buildDuplicateRecipeTitle(baseTitle: string, copyNumber: number) {
  const normalizedBaseTitle = sanitizeRecipeTitle(baseTitle) || "Untitled Recipe";

  if (copyNumber <= 1) {
    return `${normalizedBaseTitle} (Copy)`;
  }

  return `${normalizedBaseTitle} (Copy ${copyNumber})`;
}