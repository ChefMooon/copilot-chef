"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: { weekLabel: string; meals: number }[];
};

export function WeeklyTrendChart({ data }: Props) {
  return (
    <div className="rounded-card border border-green/10 bg-white p-6 shadow-card">
      <h2 className="mb-4 font-serif text-lg font-bold text-text">
        Weekly Trend
      </h2>
      <ResponsiveContainer height={200} width="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
        >
          <defs>
            <linearGradient id="mealsGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-series-1)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--chart-series-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--chart-grid)"
            vertical={false}
          />
          <XAxis
            dataKey="weekLabel"
            tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--chart-grid)",
              fontSize: 12,
              background: "var(--chart-tooltip)",
              color: "var(--foreground)",
            }}
            itemStyle={{ color: "var(--foreground)" }}
            labelStyle={{ color: "var(--text-muted)", fontWeight: 700 }}
          />
          <Area
            dataKey="meals"
            fill="url(#mealsGradient)"
            name="Meals"
            stroke="var(--chart-series-1)"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
