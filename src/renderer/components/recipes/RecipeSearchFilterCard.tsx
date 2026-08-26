import { FunnelSimple, X } from "@phosphor-icons/react";
import { useState } from "react";

import { VisualIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CUISINE_OPTIONS,
  RECIPE_SEARCH_SORT_MODE_VALUES,
  RECIPE_SORT_BY_OPTIONS,
  type RecipeSearchSortModeValue,
  type RecipeSortByValue,
  type RecipeSortOrderValue,
} from "@shared/api/constants";

import styles from "./RecipeSearchFilterCard.module.css";

type RecipeSearchFilterCardProps = {
  search: string;
  origin: string;
  cuisine: string;
  favouritesOnly: boolean;
  sortBy: RecipeSortByValue;
  sortOrder: RecipeSortOrderValue;
  searchSortMode: RecipeSearchSortModeValue;
  onSearchChange: (value: string) => void;
  onOriginChange: (value: string) => void;
  onCuisineChange: (value: string) => void;
  onFavouritesOnlyChange: (value: boolean) => void;
  onSortByChange: (value: string) => void;
  onSortOrderToggle: () => void;
  onSearchSortModeChange: (value: RecipeSearchSortModeValue) => void;
  onClearFilters: () => void;
};

const advancedPanelId = "recipe-advanced-filters";

export function RecipeSearchFilterCard({
  search,
  origin,
  cuisine,
  favouritesOnly,
  sortBy,
  sortOrder,
  searchSortMode,
  onSearchChange,
  onOriginChange,
  onCuisineChange,
  onFavouritesOnlyChange,
  onSortByChange,
  onSortOrderToggle,
  onSearchSortModeChange,
  onClearFilters,
}: RecipeSearchFilterCardProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const hasActiveFilters =
    search.trim().length > 0 ||
    origin !== "" ||
    cuisine !== "" ||
    favouritesOnly;
  const hasAdvancedFilters = origin !== "" || cuisine !== "" || favouritesOnly;

  return (
    <section aria-label="Recipe search and filters" className={styles.card}>
      <div className={styles.primaryRow}>
        <div className={styles.searchField}>
          <div className="relative">
            <Input
              className="pr-10"
              id="recipe-search"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search title, tags, ingredients"
              value={search}
            />
            {search.trim().length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Clear search"
                    className="absolute right-1 top-1 h-8 w-8"
                    onClick={() => onSearchChange("")}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <VisualIcon aria-hidden="true" icon={X} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear search</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>

        <div aria-label="Recipe sorting" className={styles.sortControls}>
          <span className={styles.sortLabel}>Sort</span>
          <select
            aria-label="Sort recipes by"
            className={styles.select}
            onChange={(event) => onSortByChange(event.target.value)}
            value={sortBy}
          >
            {RECIPE_SORT_BY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            aria-label={`Sort ${sortOrder === "asc" ? "ascending" : "descending"}. Toggle order`}
            className="h-10 min-w-[64px] px-2 text-xs"
            onClick={onSortOrderToggle}
            size="sm"
            type="button"
            variant="outline"
          >
            {sortOrder === "asc" ? "Asc" : "Desc"}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-controls={advancedPanelId}
                aria-expanded={isAdvancedOpen}
                aria-label={
                  isAdvancedOpen
                    ? "Hide advanced recipe filters"
                    : "Show advanced recipe filters"
                }
                className={`${styles.advancedToggle} ${isAdvancedOpen ? styles.advancedToggleOpen : ""} ${hasAdvancedFilters ? styles.advancedToggleActive : ""}`}
                onClick={() => setIsAdvancedOpen((open) => !open)}
                type="button"
              >
                <FunnelSimple
                  aria-hidden="true"
                  className={styles.advancedToggleIcon}
                  size={18}
                  weight="bold"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isAdvancedOpen
                ? "Hide advanced recipe filters"
                : "Show advanced recipe filters"}
            </TooltipContent>
          </Tooltip>
          {search.trim().length > 0 ? (
            <select
              aria-label="Search sort mode"
              className={styles.select}
              onChange={(event) => {
                if (
                  (
                    RECIPE_SEARCH_SORT_MODE_VALUES as readonly string[]
                  ).includes(event.target.value)
                ) {
                  onSearchSortModeChange(
                    event.target.value as RecipeSearchSortModeValue
                  );
                }
              }}
              value={searchSortMode}
            >
              <option value="relevance">Relevance</option>
              <option value="selected">Selected sort</option>
            </select>
          ) : null}
        </div>
      </div>

      <div
        aria-hidden={!isAdvancedOpen}
        className={`${styles.advancedPanel} ${isAdvancedOpen ? styles.advancedPanelOpen : ""}`}
        id={advancedPanelId}
      >
        <div className={styles.advancedPanelInner}>
          <label className={styles.field}>
            Origin
            <select
              aria-label="Recipe origin"
              className={styles.select}
              disabled={!isAdvancedOpen}
              onChange={(event) => onOriginChange(event.target.value)}
              value={origin}
            >
              <option value="">All</option>
              <option value="manual">Manual</option>
              <option value="imported">Imported</option>
            </select>
          </label>
          <label className={styles.field}>
            Cuisine
            <select
              aria-label="Recipe cuisine"
              className={styles.select}
              disabled={!isAdvancedOpen}
              onChange={(event) => onCuisineChange(event.target.value)}
              value={cuisine}
            >
              <option value="">All</option>
              {CUISINE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.checkboxField}>
            <span>Favourites only</span>
            <input
              aria-label="Favourites only"
              checked={favouritesOnly}
              disabled={!isAdvancedOpen}
              onChange={(event) => onFavouritesOnlyChange(event.target.checked)}
              type="checkbox"
            />
          </label>
        </div>
      </div>

      {hasActiveFilters ? (
        <div className={styles.footerRow}>
          <span className={styles.activeHint}>
            Filters are applied to your recipe library.
          </span>
          <Button
            onClick={onClearFilters}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clear filters
          </Button>
        </div>
      ) : null}
    </section>
  );
}
