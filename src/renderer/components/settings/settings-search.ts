export type SettingsCategoryId =
  | "general"
  | "appearance"
  | "dietary-profile"
  | "meal-plans"
  | "network"
  | "data-management";

export type SettingsSearchItem = {
  settingId: string;
  categoryId: SettingsCategoryId;
  label: string;
  description: string;
  keywords: readonly string[];
  targetId: string;
  sectionId?: string;
};

export type SettingsSearchResult = SettingsSearchItem & {
  matchSource: "label" | "description" | "keyword" | "category";
};

export function searchSettings(
  items: readonly SettingsSearchItem[],
  categories: readonly { id: SettingsCategoryId; label: string }[],
  query: string
): SettingsSearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];

  const results: SettingsSearchResult[] = [];
  for (const item of items) {
    const category = categories.find((entry) => entry.id === item.categoryId);
    const label = item.label.toLocaleLowerCase();
    const description = item.description.toLocaleLowerCase();
    const keywordMatch = item.keywords.some((keyword) =>
      keyword.toLocaleLowerCase().includes(normalizedQuery)
    );

    let matchSource: SettingsSearchResult["matchSource"] | null = null;
    if (category?.label.toLocaleLowerCase().includes(normalizedQuery)) {
      matchSource = "category";
    } else if (label.includes(normalizedQuery)) matchSource = "label";
    else if (description.includes(normalizedQuery)) matchSource = "description";
    else if (keywordMatch) matchSource = "keyword";

    if (matchSource) results.push({ ...item, matchSource });
  }

  return results;
}
