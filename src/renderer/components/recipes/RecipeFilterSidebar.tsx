"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RecipeFilterSidebarProps = {
  search: string;
  origin: string;
  favouritesOnly: boolean;
  onSearchChange: (value: string) => void;
  onOriginChange: (value: string) => void;
  onFavouritesOnlyChange: (value: boolean) => void;
};

export function RecipeFilterSidebar({
  search,
  origin,
  favouritesOnly,
  onSearchChange,
  onOriginChange,
  onFavouritesOnlyChange,
}: RecipeFilterSidebarProps) {
  return (
    <aside className="space-y-4 rounded-card border border-cream-dark bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Search</label>
        <div className="relative">
          <Input
            className="pr-10"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title, tags, ingredients"
            value={search}
          />
          {search.trim().length > 0 ? (
            <Button
              aria-label="Clear search"
              className="absolute right-1 top-1 h-8 w-8"
              onClick={() => onSearchChange("")}
              size="icon"
              type="button"
              variant="ghost"
            >
              ×
            </Button>
          ) : null}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Origin</label>
        <select
          className="h-10 w-full rounded-btn border border-cream-dark bg-cream px-3 py-2 font-sans text-sm text-text outline-none transition focus:border-green-light focus:ring-2 focus:ring-green/10"
          onChange={(event) => onOriginChange(event.target.value)}
          value={origin}
        >
          <option value="">All</option>
          <option value="manual">Manual</option>
          <option value="imported">Imported</option>
          <option value="ai_generated">AI Generated</option>
        </select>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-[12px] border border-cream-dark bg-cream px-3 py-2 text-sm font-medium text-text">
        <span>Favourites only</span>
        <input
          checked={favouritesOnly}
          className="h-4 w-4 rounded border-cream-dark text-green focus:ring-green"
          onChange={(event) => onFavouritesOnlyChange(event.target.checked)}
          type="checkbox"
        />
      </label>
    </aside>
  );
}
