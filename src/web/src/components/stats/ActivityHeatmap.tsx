"use client";

import { useMemo, useState } from "react";

import styles from "./ActivityHeatmap.module.css";

type HeatmapCell = { date: string; meals: number; isFuture: boolean };

type Props = {
  weeks: HeatmapCell[][];
  monthStarts: Record<string, number>;
};

function getHeatColor(meals: number, isFuture: boolean) {
  if (isFuture) return "var(--cream-dark)";
  if (meals === 0) return "#E4DDD0";
  if (meals === 1) return "#A8C8B0";
  if (meals === 2) return "#6FA882";
  return "#3B5E45";
}

export function ActivityHeatmap({ weeks, monthStarts }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const monthLabels = useMemo(() => {
    const entries = Object.entries(monthStarts);
    return entries.reduce<Record<number, string>>((acc, [month, index]) => {
      acc[index] = month;
      return acc;
    }, {});
  }, [monthStarts]);

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.monthRow}>
          <div />
          {weeks.map((_, weekIndex) => (
            <div className={styles.monthCell} key={weekIndex}>
              {monthLabels[weekIndex] ?? ""}
            </div>
          ))}
        </div>

        <div className={styles.grid}>
          {["M", "", "W", "", "F", "", ""].map((label, dayIndex) => (
            <div
              className={styles.dayLabel}
              key={`label-${dayIndex}`}
              style={{ gridColumn: 1, gridRow: dayIndex + 1 }}
            >
              {label}
            </div>
          ))}

          {weeks.map((week, weekIndex) =>
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
                  className={styles.square}
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

        <div className={styles.legend}>
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

      {tooltip ? (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </div>
  );
}
