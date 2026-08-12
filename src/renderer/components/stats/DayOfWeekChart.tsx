"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: { day: string; count: number }[];
};

export function DayOfWeekChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-card border border-green/10 bg-white p-6 shadow-card">
      <h2 className="mb-4 font-serif text-lg font-bold text-text">
        Day of Week Patterns
      </h2>
      <ResponsiveContainer height={200} width="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
        >
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="day"
            tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--chart-grid)",
              fontSize: 12,
              background: "var(--chart-tooltip)",
            }}
          />
          <Bar dataKey="count" name="Meals" radius={[3, 3, 0, 0]}>
            {data.map((entry, index) => {
              const intensity = max > 0 ? entry.count / max : 0;
              return (
                <Cell
                  fill={
                    intensity === 0
                      ? "var(--chart-series-6)"
                      : intensity < 0.34
                        ? "var(--chart-series-4)"
                        : intensity < 0.67
                          ? "var(--chart-series-2)"
                          : "var(--chart-series-1)"
                  }
                  key={`cell-${index}`}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
