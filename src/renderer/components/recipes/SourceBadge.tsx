type SourceBadgeProps = {
  origin: string;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  compact?: boolean;
};

function labelFromOrigin(origin: string) {
  if (origin === "imported") return "Imported";
  return "Manual";
}

function isHttpSourceUrl(sourceUrl: string | null | undefined): sourceUrl is string {
  if (!sourceUrl) {
    return false;
  }

  try {
    const protocol = new URL(sourceUrl).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function SourceBadge({
  origin,
  sourceLabel,
  sourceUrl,
  compact = false,
}: SourceBadgeProps) {
  const containerClasses = compact ? "flex items-center gap-1.5 text-[11px]" : "flex items-center gap-2 text-xs";
  const badgeClasses = compact
    ? "rounded-full px-2 py-0.5 font-medium"
    : "rounded-full px-2 py-1 font-medium";
  const canOpenSource = origin === "imported" && isHttpSourceUrl(sourceUrl);

  return (
    <div className={containerClasses}>
      <span className={`${badgeClasses} bg-green-pale text-green`}>
        {labelFromOrigin(origin)}
      </span>
      {sourceLabel ? (
        canOpenSource ? (
          <a
            aria-label={`Open original recipe: ${sourceLabel}`}
            className={`${badgeClasses} bg-orange/15 text-orange transition-colors hover:bg-orange/25 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60 focus-visible:ring-offset-1`}
            href={sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
            title="Open original recipe"
          >
            {sourceLabel}
          </a>
        ) : (
          <span className={`${badgeClasses} bg-orange/15 text-orange`}>
            {sourceLabel}
          </span>
        )
      ) : null}
    </div>
  );
}
