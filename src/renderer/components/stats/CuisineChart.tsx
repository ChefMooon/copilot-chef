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
  data: { cuisine: string; count: number }[];
};

const COLORS = [
  "var(--chart-series-1)",
  "var(--chart-series-2)",
  "var(--chart-series-3)",
  "var(--chart-series-4)",
  "var(--chart-series-5)",
  "var(--chart-series-6)",
];

export function CuisineChart({ data }: Props) {
  return (
    <div className="rounded-card border border-green/10 bg-white p-6 shadow-card">
      <h2 className="mb-4 font-serif text-lg font-bold text-text">
        Cuisine Breakdown
      </h2>
      <ResponsiveContainer height={220} width="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 24, left: -20 }}
        >
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            angle={-35}
            axisLine={false}
            dataKey="cuisine"
            interval={0}
            tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
            tickLine={false}
            textAnchor="end"
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
              color: "var(--foreground)",
            }}
            itemStyle={{ color: "var(--foreground)" }}
            labelStyle={{ color: "var(--text-muted)" }}
          />
          <Bar dataKey="count" name="Meals" radius={[3, 3, 0, 0]}>
            {data.map((_, index) => (
              <Cell
                fill={COLORS[index % COLORS.length]}
                key={`cell-${index}`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
