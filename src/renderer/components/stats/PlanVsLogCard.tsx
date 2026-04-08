type Props = {
  totalMeals: number;
  activeDays: number;
  avgMealsPerActiveDay: number;
};

export function PlanVsLogCard({
  totalMeals,
  activeDays,
  avgMealsPerActiveDay,
}: Props) {
  return (
    <div className="rounded-card border border-green/10 bg-white p-6 shadow-card">
      <h2 className="font-serif text-lg font-bold text-text">
        Planning Rhythm (30 days)
      </h2>
      <p className="mt-1 text-xs font-medium text-text-muted">
        Meal activity drawn directly from your recent calendar entries
      </p>

      <div className="mt-4 flex items-baseline gap-4">
        <div>
          <p className="font-serif text-4xl font-bold text-green">
            {avgMealsPerActiveDay.toFixed(1)}
          </p>
          <p className="text-xs font-medium text-text-muted">meals per active day</p>
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-text-muted">
          <span>{totalMeals} meals</span>
          <span>{activeDays} active days</span>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#E4DDD0]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min((avgMealsPerActiveDay / 3) * 100, 100)}%`,
            background: "linear-gradient(90deg, #3B5E45, #6FA882)",
          }}
        />
      </div>
    </div>
  );
}
