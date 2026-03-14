type KpiCard = {
  label: string;
  value: string | number;
  sub?: string;
};

type Props = {
  cards: KpiCard[];
};

export function StatKpiRow({ cards }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article
          className="rounded-card border border-green/10 bg-white p-6 shadow-card"
          key={card.label}
        >
          <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-text-muted">
            {card.label}
          </p>
          <p className="mt-3 font-serif text-5xl font-bold text-green">
            {card.value}
          </p>
          {card.sub ? (
            <p className="mt-1 text-xs font-medium text-text-muted">
              {card.sub}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
