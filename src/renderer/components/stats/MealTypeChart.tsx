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
  data: { mealType: string; slotCount: number }[];
};

const COLORS = [
  "var(--chart-series-1)",
  "var(--chart-series-2)",
  "var(--chart-series-3)",
  "var(--chart-series-4)",
  "var(--chart-series-5)",
  "var(--chart-series-6)",
];

export function MealTypeChart({ data }: Props) {
  return (
    <div className="rounded-card border border-green/10 bg-white p-6 shadow-card">
      <h2 className="mb-4 font-serif text-lg font-bold text-text">
        Meal Type Distribution
      </h2>
      <ResponsiveContainer height={220} width="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 60 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
          />
          <XAxis
            allowDecimals={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--chart-muted)" }}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="mealType"
            tick={{ fontSize: 10, fill: "var(--chart-axis)" }}
            tickLine={false}
            type="category"
            width={60}
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
          <Bar dataKey="slotCount" name="Meals" radius={[0, 3, 3, 0]}>
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
