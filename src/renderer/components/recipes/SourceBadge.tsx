type SourceBadgeProps = {
  origin: string;
  sourceLabel?: string | null;
  compact?: boolean;
};

function labelFromOrigin(origin: string) {
  if (origin === "imported") return "Imported";
  return "Manual";
}

export function SourceBadge({ origin, sourceLabel, compact = false }: SourceBadgeProps) {
  const containerClasses = compact ? "flex items-center gap-1.5 text-[11px]" : "flex items-center gap-2 text-xs";
  const badgeClasses = compact
    ? "rounded-full px-2 py-0.5 font-medium"
    : "rounded-full px-2 py-1 font-medium";

  return (
    <div className={containerClasses}>
      <span className={`${badgeClasses} bg-green-pale text-green`}>
        {labelFromOrigin(origin)}
      </span>
      {sourceLabel ? (
        <span className={`${badgeClasses} bg-orange/15 text-orange`}>
          {sourceLabel}
        </span>
      ) : null}
    </div>
  );
}
