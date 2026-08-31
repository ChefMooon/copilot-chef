import { useId, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import styles from "./settings.module.css";
import type {
  SettingsCategoryId,
  SettingsSearchResult,
} from "./settings-search";

export type SettingsCategory = {
  id: SettingsCategoryId;
  label: string;
  panelId: string;
};

export type SettingsSidebarProps = {
  categories: readonly SettingsCategory[];
  activeCategory: SettingsCategoryId;
  onCategoryChange: (categoryId: SettingsCategoryId) => void;
  onCategoryKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: readonly SettingsSearchResult[];
  onSearchResultSelect: (result: SettingsSearchResult) => void;
};

export function SettingsSidebar({
  categories,
  activeCategory,
  onCategoryChange,
  onCategoryKeyDown,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSearchResultSelect,
}: SettingsSidebarProps) {
  const searchId = useId();
  const resultId = `${searchId}-results`;

  return (
    <aside className={styles.settingsSidebar} aria-label="Settings navigation">
      <div className={styles.settingsSearch}>
        <label htmlFor={searchId}>Search settings</label>
        <input
          aria-controls={resultId}
          aria-label="Search settings"
          className={styles.settingsSearchInput}
          id={searchId}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search settings"
          type="search"
          value={searchQuery}
        />
      </div>

      <nav
        aria-label="Settings categories"
        className={styles.settingsCategoryList}
        role="tablist"
      >
        {categories.map((category, index) => (
          <button
            aria-controls={category.panelId}
            aria-selected={activeCategory === category.id}
            className={cn(
              styles.settingsCategoryButton,
              activeCategory === category.id &&
                styles.settingsCategoryButtonActive
            )}
            id={`settings-category-${category.id}`}
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            onKeyDown={(event) => onCategoryKeyDown(event, index)}
            role="tab"
            tabIndex={activeCategory === category.id ? 0 : -1}
            type="button"
          >
            {category.label}
          </button>
        ))}
      </nav>

      {searchQuery.trim() ? (
        <div
          aria-label="Settings search results"
          className={styles.settingsSearchResults}
          id={resultId}
          role="listbox"
        >
          {searchResults.length > 0 ? (
            searchResults.map((result) => (
              <button
                className={styles.settingsSearchResult}
                key={result.settingId}
                onClick={() => onSearchResultSelect(result)}
                role="option"
                type="button"
              >
                <strong>{result.label}</strong>
                <span>{result.categoryId.replace("-", " ")}</span>
              </button>
            ))
          ) : (
            <div className={styles.settingsSearchEmpty} role="status">
              <span>No settings match this search.</span>
              <button
                className={styles.settingsSearchReset}
                onClick={() => onSearchQueryChange("")}
                type="button"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      ) : null}
    </aside>
  );
}
