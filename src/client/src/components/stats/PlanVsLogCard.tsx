type Props = {
  planned: number;
  logged: number;
  followThroughRate: number;
};

export function PlanVsLogCard({ planned, logged, followThroughRate }: Props) {
  return (
    <div className="rounded-card border border-green/10 bg-white p-6 shadow-card">
      <h2 className="font-serif text-lg font-bold text-text">
        Plan vs. Log (30 days)
      </h2>
      <p className="mt-1 text-xs font-medium text-text-muted">
        How often logged meals matched what was planned
      </p>

      <div className="mt-4 flex items-baseline gap-4">
        <div>
          <p className="font-serif text-4xl font-bold text-green">
            {followThroughRate}%
          </p>
          <p className="text-xs font-medium text-text-muted">follow-through</p>
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-text-muted">
          <span>{planned} planned</span>
          <span>{logged} logged</span>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#E4DDD0]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(followThroughRate, 100)}%`,
            background: "linear-gradient(90deg, #3B5E45, #6FA882)",
          }}
        />
      </div>
    </div>
  );
}
