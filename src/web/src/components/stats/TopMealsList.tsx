type Props = {
  meals: { mealName: string; count: number }[];
};

export function TopMealsList({ meals }: Props) {
  const max = Math.max(...meals.map((m) => m.count), 1);

  return (
    <div className="rounded-card border border-green/10 bg-white p-6 shadow-card">
      <h2 className="mb-4 font-serif text-lg font-bold text-text">
        Top Repeated Meals
      </h2>
      {meals.length === 0 ? (
        <p className="text-sm text-text-muted">No meal logs yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {meals.map((meal, index) => (
            <li className="flex items-center gap-3" key={meal.mealName}>
              <span className="w-5 text-right text-xs font-bold text-text-muted">
                {index + 1}
              </span>
              <div className="flex-1">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-text">
                    {meal.mealName}
                  </span>
                  <span className="text-xs font-bold text-green">
                    ×{meal.count}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#E4DDD0]">
                  <div
                    className="h-full rounded-full bg-green transition-all duration-500"
                    style={{ width: `${(meal.count / max) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
