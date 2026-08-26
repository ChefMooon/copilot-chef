import {
  QUICK_FILTERS,
  formatListDate,
  isToday,
  listProgress,
  type GroceryList,
  type QuickFilter,
} from "@/lib/grocery";
import { VisualIcon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QUICK_FILTER_ICON_REGISTRY } from "@/lib/icon-registry";

import styles from "./grocery-list.module.css";

type Props = {
  lists: GroceryList[];
  selectedId: string | null;
  activeFilter: QuickFilter;
  upcomingDays: number;
  onSelectFilter: (filter: QuickFilter) => void;
  onChangeUpcomingDays: (days: number) => void;
  onSelectList: (id: string) => void;
  onToggleFav: (id: string, nextValue: boolean) => void;
};

export function QuickReference({
  lists,
  selectedId,
  activeFilter,
  upcomingDays,
  onSelectFilter,
  onChangeUpcomingDays,
  onSelectList,
  onToggleFav,
}: Props) {
  return (
    <>
      <div className={styles.sectionLabel}>Quick Reference</div>
      <div className={styles.filterTabs}>
        {QUICK_FILTERS.map((filter) => (
          <button
            className={`${styles.filterTab} ${activeFilter === filter.id ? styles.filterTabActive : ""}`}
            key={filter.id}
            onClick={() => onSelectFilter(filter.id)}
            type="button"
          >
            <VisualIcon
              aria-hidden="true"
              icon={QUICK_FILTER_ICON_REGISTRY[filter.icon]}
            />
            <span>{filter.label}</span>
          </button>
        ))}
        {activeFilter === "upcoming" ? (
          <label className={styles.upcomingControl}>
            Days:
            <input
              className={styles.upcomingInput}
              max={60}
              min={1}
              onChange={(event) =>
                onChangeUpcomingDays(Number(event.target.value) || 1)
              }
              type="number"
              value={upcomingDays}
            />
          </label>
        ) : null}
      </div>
      <div className={styles.carouselWrap}>
        <div className={styles.carousel}>
          {lists.length === 0 ? (
            <div className={styles.quickEmpty}>No lists match this filter.</div>
          ) : null}
          {lists.map((list) => {
            const pct = listProgress(list.items);

            return (
              <div
                className={`${styles.quickCard} ${selectedId === list.id ? styles.quickCardSelected : ""}`}
                key={list.id}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      aria-label={`${list.favourite ? "Remove" : "Add"} ${list.name} ${list.favourite ? "from" : "to"} favourites`}
                      className={`${styles.quickCardFav} ${list.favourite ? styles.quickCardFavActive : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleFav(list.id, !list.favourite);
                      }}
                      type="button"
                    >
                      <VisualIcon
                        aria-hidden="true"
                        icon={QUICK_FILTER_ICON_REGISTRY.star}
                        weight={list.favourite ? "bold" : "regular"}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{list.favourite ? "Remove from favourites" : "Add to favourites"}</TooltipContent>
                </Tooltip>
                <button
                  className={styles.quickCardAction}
                  onClick={() => onSelectList(list.id)}
                  type="button"
                >
                  <div className={styles.quickCardName}>{list.name}</div>
                  <div className={styles.quickCardDate}>
                    {isToday(list.date) ? "Today" : formatListDate(list.date)} ·{" "}
                    {list.items.length} items
                  </div>
                  <div className={styles.quickCardProgress}>
                    <div
                      className={styles.quickCardFill}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className={styles.quickCardPct}>{pct}% collected</div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
