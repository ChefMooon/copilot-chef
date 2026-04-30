import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { useChatPageContext } from "@/context/chat-context";
import { fetchJson } from "@/lib/api";
import { getCachedConfig, isServerConfigReady } from "@/lib/config";
import { getPlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";

import styles from "./home-dashboard.module.css";

type MealSummaryPayload = {
  from: string;
  to: string;
  totalMeals: number;
};

type GroceryListPayload = {
  id: string;
  name: string;
  createdAt: string;
  checkedCount: number;
  totalItems: number;
  completionPercentage: number;
};

type HeatmapPayload = {
  weeks: Array<Array<{ date: string; meals: number; isFuture: boolean }>>;
  monthStarts: Record<string, number>;
};

type UpcomingMealPayload = {
  id: string;
  name: string;
  date: string | null;
  mealType: string;
  cuisine: string | null;
  linkedRecipe: { title: string } | null;
};

type UpcomingMealsPayload = {
  days: number;
  from: string;
  to: string;
  meals: UpcomingMealPayload[];
};

type HomeUpcomingLayout = "list" | "grouped";
type HomeUpcomingDetail = "standard" | "detailed";

type HomeDashboardSettings = {
  upcomingDays: number;
  upcomingLayout: HomeUpcomingLayout;
  upcomingDetail: HomeUpcomingDetail;
  upcomingCompact: boolean;
  showUpcomingMeals: boolean;
  showMealActivity: boolean;
  showGroceryList: boolean;
  showGreetingSubtitle: boolean;
};

const HOME_SETTINGS_DEFAULTS: HomeDashboardSettings = {
  upcomingDays: 7,
  upcomingLayout: "list",
  upcomingDetail: "standard",
  upcomingCompact: false,
  showUpcomingMeals: true,
  showMealActivity: true,
  showGroceryList: true,
  showGreetingSubtitle: true,
};

const platform = getPlatform();

function clampUpcomingDays(input: unknown) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return HOME_SETTINGS_DEFAULTS.upcomingDays;
  }

  return Math.min(30, Math.max(1, Math.floor(input)));
}

function normalizeLayout(input: unknown): HomeUpcomingLayout {
  return input === "grouped" ? "grouped" : "list";
}

function normalizeDetail(input: unknown): HomeUpcomingDetail {
  return input === "detailed" ? "detailed" : "standard";
}

function normalizeBoolean(input: unknown, fallback: boolean) {
  return typeof input === "boolean" ? input : fallback;
}

function formatMealType(mealType: string) {
  return mealType
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (value) =>
      value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
    );
}

function getHeatColor(meals: number, isFuture: boolean) {
  if (isFuture) {
    return "var(--cream-dark)";
  }

  if (meals === 0) {
    return "#E4DDD0";
  }

  if (meals === 1) {
    return "#A8C8B0";
  }

  if (meals === 2) {
    return "#6FA882";
  }

  return "var(--green)";
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function HomeDashboard() {
  const apiReady = isServerConfigReady(getCachedConfig());
  const [settings, setSettings] = useState<HomeDashboardSettings>(
    HOME_SETTINGS_DEFAULTS
  );
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  useEffect(() => {
    let canceled = false;

    async function loadHomeSettings() {
      try {
        const [
          upcomingDays,
          upcomingLayout,
          upcomingDetail,
          upcomingCompact,
          showUpcomingMeals,
          showMealActivity,
          showGroceryList,
          showGreetingSubtitle,
        ] = await Promise.all([
          platform.getSetting("home_upcoming_days"),
          platform.getSetting("home_upcoming_layout"),
          platform.getSetting("home_upcoming_detail"),
          platform.getSetting("home_upcoming_compact"),
          platform.getSetting("home_show_upcoming_meals"),
          platform.getSetting("home_show_meal_activity"),
          platform.getSetting("home_show_grocery_list"),
          platform.getSetting("home_show_greeting_subtitle"),
        ]);

        if (canceled) {
          return;
        }

        setSettings({
          upcomingDays: clampUpcomingDays(upcomingDays),
          upcomingLayout: normalizeLayout(upcomingLayout),
          upcomingDetail: normalizeDetail(upcomingDetail),
          upcomingCompact: normalizeBoolean(
            upcomingCompact,
            HOME_SETTINGS_DEFAULTS.upcomingCompact
          ),
          showUpcomingMeals: normalizeBoolean(
            showUpcomingMeals,
            HOME_SETTINGS_DEFAULTS.showUpcomingMeals
          ),
          showMealActivity: normalizeBoolean(
            showMealActivity,
            HOME_SETTINGS_DEFAULTS.showMealActivity
          ),
          showGroceryList: normalizeBoolean(
            showGroceryList,
            HOME_SETTINGS_DEFAULTS.showGroceryList
          ),
          showGreetingSubtitle: normalizeBoolean(
            showGreetingSubtitle,
            HOME_SETTINGS_DEFAULTS.showGreetingSubtitle
          ),
        });
      } catch {
        if (!canceled) {
          setSettings(HOME_SETTINGS_DEFAULTS);
        }
      }
    }

    void loadHomeSettings();

    return () => {
      canceled = true;
    };
  }, []);

  const mealSummaryQuery = useQuery({
    queryKey: ["stats", "meal-summary"],
    enabled: apiReady,
    queryFn: () =>
      fetchJson<{ data: MealSummaryPayload }>("/api/stats/meal-summary").then(
        (response) => response.data
      ),
  });

  const groceryListQuery = useQuery({
    queryKey: ["grocery-list", "current"],
    enabled: apiReady && settings.showGroceryList,
    queryFn: () =>
      fetchJson<{ data: GroceryListPayload | null }>(
        "/api/grocery-lists?current=1"
      ).then((response) => response.data),
  });

  const heatmapQuery = useQuery({
    queryKey: ["meals", "heatmap", 13],
    enabled: apiReady && settings.showMealActivity,
    queryFn: () =>
      fetchJson<{ data: HeatmapPayload }>("/api/meals/heatmap?weeks=13").then(
        (response) => response.data
      ),
  });

  const upcomingMealsQuery = useQuery({
    queryKey: ["meals", "upcoming", settings.upcomingDays],
    enabled: apiReady && settings.showUpcomingMeals,
    queryFn: () =>
      fetchJson<{ data: UpcomingMealsPayload }>(
        `/api/meals/upcoming?days=${settings.upcomingDays}`
      ).then((response) => response.data),
  });

  const greetingDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    []
  );

  const monthLabels = useMemo(() => {
    const entries = Object.entries(heatmapQuery.data?.monthStarts ?? {});
    return entries.reduce<Record<number, string>>(
      (accumulator, [month, index]) => {
        accumulator[index] = month;
        return accumulator;
      },
      {}
    );
  }, [heatmapQuery.data?.monthStarts]);

  const totalMeals = mealSummaryQuery.data?.totalMeals ?? 0;
  const groceryList = groceryListQuery.data;
  const heatmap = heatmapQuery.data?.weeks ?? [];
  const upcomingMeals = upcomingMealsQuery.data?.meals ?? [];

  const groupedUpcomingMeals = useMemo(() => {
    return upcomingMeals.reduce<Record<string, UpcomingMealPayload[]>>(
      (accumulator, meal) => {
        const key = meal.date ?? "unscheduled";
        if (!accumulator[key]) {
          accumulator[key] = [];
        }
        accumulator[key].push(meal);
        return accumulator;
      },
      {}
    );
  }, [upcomingMeals]);

  const upcomingGroupKeys = useMemo(() => {
    return Object.keys(groupedUpcomingMeals).sort();
  }, [groupedUpcomingMeals]);

  const visibleOverviewCount =
    Number(settings.showMealActivity) + Number(settings.showGroceryList);
  const hasOverviewContent = settings.showUpcomingMeals || visibleOverviewCount > 0;

  useChatPageContext({
    page: "home",
    totalMeals,
    groceryListName: groceryList?.name ?? null,
    groceryCompletion: groceryList?.completionPercentage ?? 0,
  });

  return (
    <>
      <div className={cn(styles.pageGreeting, styles.fadeIn)}>
        {settings.showGreetingSubtitle ? (
          <div className={styles.greetingEyebrow}>{greetingDate}</div>
        ) : null}
        <h1 className={styles.greetingTitle}>{getGreeting()}, Chef!</h1>
        {settings.showGreetingSubtitle ? (
          <p className={styles.greetingSub}>
            {totalMeals > 0
              ? `You have ${totalMeals} meals planned this week. Let's get cooking.`
              : "Your first weekly plan is ready to take shape."}
          </p>
        ) : null}
      </div>

      {hasOverviewContent ? (
        <>
          <div className={cn(styles.sectionDivider, styles.fadeIn)}>Overview</div>
          <section className={cn(styles.overviewStack, styles.fadeIn)}>
            {settings.showUpcomingMeals ? (
              <div
                className={cn(
                  styles.card,
                  styles.upcomingCard,
                  settings.upcomingCompact && styles.upcomingCardCompact
                )}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>⏭️ Upcoming Meals</div>
                  <Link className={styles.cardAction} to="/meal-plan">
                    Open Planner →
                  </Link>
                </div>

                {upcomingMealsQuery.isLoading ? (
                  <p className={styles.upcomingEmptyMessage}>Loading upcoming meals...</p>
                ) : upcomingMeals.length === 0 ? (
                  <p className={styles.upcomingEmptyMessage}>
                    No upcoming meals are planned.
                  </p>
                ) : settings.upcomingLayout === "grouped" ? (
                  <div className={styles.upcomingGroupedList}>
                    {upcomingGroupKeys.map((dateKey) => {
                      const label =
                        dateKey === "unscheduled"
                          ? "Unscheduled"
                          : new Date(dateKey).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            });

                      return (
                        <div className={styles.upcomingGroup} key={dateKey}>
                          <div className={styles.upcomingGroupTitle}>{label}</div>
                          {groupedUpcomingMeals[dateKey].map((meal) => (
                            <div className={styles.upcomingMealRow} key={meal.id}>
                              <div>
                                <div className={styles.upcomingMealName}>{meal.name}</div>
                                <div className={styles.upcomingMeta}>
                                  {formatMealType(meal.mealType)}
                                  {settings.upcomingDetail === "detailed" && meal.cuisine
                                    ? ` · ${meal.cuisine}`
                                    : ""}
                                  {settings.upcomingDetail === "detailed" &&
                                  meal.linkedRecipe?.title
                                    ? ` · ${meal.linkedRecipe.title}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.upcomingList}>
                    {upcomingMeals.map((meal) => (
                      <div className={styles.upcomingMealRow} key={meal.id}>
                        <div>
                          <div className={styles.upcomingMealName}>{meal.name}</div>
                          <div className={styles.upcomingMeta}>
                            {meal.date
                              ? new Date(meal.date).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "Unscheduled"}
                            {` · ${formatMealType(meal.mealType)}`}
                            {settings.upcomingDetail === "detailed" && meal.cuisine
                              ? ` · ${meal.cuisine}`
                              : ""}
                            {settings.upcomingDetail === "detailed" && meal.linkedRecipe?.title
                              ? ` · ${meal.linkedRecipe.title}`
                              : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {visibleOverviewCount > 0 ? (
              <div
                className={cn(
                  styles.overviewGrid,
                  visibleOverviewCount === 1 && styles.overviewGridSingle
                )}
              >
                {settings.showMealActivity ? (
                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitle}>🔥 Meal Activity</div>
                      <Link className={styles.cardAction} to="/stats">
                        View Stats →
                      </Link>
                    </div>

                    <div className={styles.heatmapWrap}>
                      <div className={styles.heatmapMonthRow}>
                        <div />
                        {heatmap.map((_, weekIndex) => (
                          <div className={styles.monthCell} key={weekIndex}>
                            {monthLabels[weekIndex] ?? ""}
                          </div>
                        ))}
                      </div>

                      <div className={styles.heatmapGrid}>
                        {["M", "", "W", "", "F", "", ""].map((label, dayIndex) => (
                          <div
                            className={styles.dayLabel}
                            key={`label-${dayIndex}`}
                            style={{ gridColumn: 1, gridRow: dayIndex + 1 }}
                          >
                            {label}
                          </div>
                        ))}

                        {heatmap.map((week, weekIndex) =>
                          week.map((cell, dayIndex) => {
                            const dateLabel = new Date(cell.date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              }
                            );

                            return (
                              <button
                                className={styles.heatmapSquare}
                                key={`${weekIndex}-${dayIndex}`}
                                onMouseEnter={(event) =>
                                  setTooltip({
                                    x: event.clientX,
                                    y: event.clientY,
                                    text: cell.isFuture
                                      ? "Not yet"
                                      : `${dateLabel} — ${cell.meals} meal${cell.meals !== 1 ? "s" : ""}`,
                                  })
                                }
                                onMouseLeave={() => setTooltip(null)}
                                style={{
                                  gridColumn: weekIndex + 2,
                                  gridRow: dayIndex + 1,
                                  background: getHeatColor(cell.meals, cell.isFuture),
                                }}
                                type="button"
                              />
                            );
                          })
                        )}
                      </div>

                      <div className={styles.heatmapLegend}>
                        <span className={styles.legendLabel}>Less</span>
                        {["#E4DDD0", "#A8C8B0", "#6FA882", "#3B5E45"].map((color) => (
                          <div
                            className={styles.legendSquare}
                            key={color}
                            style={{ background: color }}
                          />
                        ))}
                        <span className={styles.legendLabel}>More</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {settings.showGroceryList ? (
                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitle}>🛒 Grocery List</div>
                      <Link className={styles.cardAction} to="/grocery-list">
                        Full List →
                      </Link>
                    </div>

                    <div className={styles.grocerySummary}>
                      <div>
                        <div className={styles.groceryListName}>
                          {groceryList?.name ?? "Loading this week's list"}
                        </div>
                        <div className={styles.groceryMeta}>
                          {groceryList
                            ? `Created ${new Date(
                                groceryList.createdAt
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })} · ${groceryList.totalItems} items`
                            : "Fetching current list"}
                        </div>
                      </div>

                      <div>
                        <div className={styles.groceryStatRow}>
                          <div>
                            <span className={styles.groceryStatBig}>
                              {groceryList?.checkedCount ?? 0}
                            </span>
                            <span className={styles.groceryStatLabel}> collected</span>
                          </div>
                          <div>
                            <span className={styles.groceryStatBig}>
                              {groceryList
                                ? groceryList.totalItems - groceryList.checkedCount
                                : 0}
                            </span>
                            <span className={styles.groceryStatLabel}> remaining</span>
                          </div>
                        </div>
                        <div className={styles.groceryBar}>
                          <div
                            className={styles.groceryBarFill}
                            style={{
                              width: `${groceryList?.completionPercentage ?? 0}%`,
                            }}
                          />
                        </div>
                        <div className={styles.groceryPct}>
                          {groceryList?.completionPercentage ?? 0}% complete
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {tooltip ? (
        <div
          className={styles.tooltip}
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 32,
            position: "fixed",
            pointerEvents: "none",
          }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </>
  );
}
