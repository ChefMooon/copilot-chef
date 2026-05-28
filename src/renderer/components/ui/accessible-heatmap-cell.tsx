import type { CSSProperties, MouseEvent } from "react";

export type HeatmapCellMetadata = {
  date: string;
  meals: number;
  isFuture: boolean;
};

export type HeatmapCellA11yMetadata = {
  dateLabel: string;
  ariaLabel: string;
  tooltipText: string;
};

type AccessibleHeatmapCellProps = {
  cell: HeatmapCellMetadata;
  className: string;
  style: CSSProperties;
  onMouseEnterTooltip: (
    event: MouseEvent<HTMLButtonElement>,
    tooltipText: string
  ) => void;
  onMouseLeaveTooltip: () => void;
};

function parseHeatmapDate(input: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) {
    return new Date(input);
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function getHeatmapCellA11yMetadata(
  cell: HeatmapCellMetadata
): HeatmapCellA11yMetadata {
  const dateLabel = parseHeatmapDate(cell.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const mealSummary = cell.isFuture
    ? "Not yet"
    : `${cell.meals} meal${cell.meals !== 1 ? "s" : ""}`;

  return {
    dateLabel,
    ariaLabel: `${dateLabel}: ${mealSummary}`,
    tooltipText: cell.isFuture ? "Not yet" : `${dateLabel} — ${mealSummary}`,
  };
}

export function AccessibleHeatmapCell({
  cell,
  className,
  style,
  onMouseEnterTooltip,
  onMouseLeaveTooltip,
}: AccessibleHeatmapCellProps) {
  const metadata = getHeatmapCellA11yMetadata(cell);

  return (
    <button
      aria-label={metadata.ariaLabel}
      className={className}
      onMouseEnter={(event) => onMouseEnterTooltip(event, metadata.tooltipText)}
      onMouseLeave={onMouseLeaveTooltip}
      style={style}
      type="button"
    />
  );
}