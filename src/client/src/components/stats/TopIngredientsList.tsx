type Props = {
  ingredients: { ingredient: string; count: number }[];
};

export function TopIngredientsList({ ingredients }: Props) {
  const max = Math.max(...ingredients.map((i) => i.count), 1);

  function getOpacity(count: number) {
    return 0.35 + 0.65 * (count / max);
  }

  return (
    <div className="rounded-card border border-green/10 bg-white p-6 shadow-card">
      <h2 className="mb-4 font-serif text-lg font-bold text-text">
        Top Ingredients
      </h2>
      {ingredients.length === 0 ? (
        <p className="text-sm text-text-muted">No meal data yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ingredients.map((item) => (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              key={item.ingredient}
              style={{
                background: `rgba(59, 94, 69, ${getOpacity(item.count)})`,
              }}
              title={`×${item.count}`}
            >
              {item.ingredient}
              <span className="ml-1.5 opacity-75">×{item.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
