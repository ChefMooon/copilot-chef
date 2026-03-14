import {
  QUICK_FILTERS,
  formatListDate,
  isToday,
  listProgress,
  type GroceryList,
  type QuickFilter,
} from "@/lib/grocery";

import styles from "../grocery-list.module.css";

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
            <span>{filter.icon}</span>
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
                <button
                  className={`${styles.quickCardFav} ${list.favourite ? styles.quickCardFavActive : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleFav(list.id, !list.favourite);
                  }}
                  type="button"
                >
                  {list.favourite ? "⭐" : "☆"}
                </button>
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
                  {list.mealPlan ? (
                    <div className={styles.quickCardMeta}>
                      🍽 {list.mealPlan}
                    </div>
                  ) : null}
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
