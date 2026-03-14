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
  "#3B5E45",
  "#4d7a5a",
  "#6FA882",
  "#A8C8B0",
  "#c5ddc9",
  "#E4DDD0",
  "#d6cfc5",
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
            stroke="#E4DDD0"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            angle={-35}
            axisLine={false}
            dataKey="cuisine"
            interval={0}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            textAnchor="end"
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #E4DDD0",
              fontSize: 12,
              background: "#fffdf8",
            }}
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
