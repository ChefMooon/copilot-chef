type SourceBadgeProps = {
  origin: string;
  sourceLabel?: string | null;
};

function labelFromOrigin(origin: string) {
  if (origin === "imported") return "Imported";
  if (origin === "ai_generated") return "AI";
  return "Manual";
}

export function SourceBadge({ origin, sourceLabel }: SourceBadgeProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="rounded-full bg-green-pale px-2 py-1 font-medium text-green">
        {labelFromOrigin(origin)}
      </span>
      {sourceLabel ? (
        <span className="rounded-full bg-orange/15 px-2 py-1 font-medium text-orange">
          {sourceLabel}
        </span>
      ) : null}
    </div>
  );
}
