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
  data: { mealType: string; count: number }[];
};

const COLORS = [
  "#3B5E45",
  "#4d7a5a",
  "#6FA882",
  "#A8C8B0",
  "#c5ddc9",
  "#E4DDD0",
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
            stroke="#E4DDD0"
            strokeDasharray="3 3"
          />
          <XAxis
            allowDecimals={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="mealType"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            type="category"
            width={60}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #E4DDD0",
              fontSize: 12,
              background: "#fffdf8",
            }}
          />
          <Bar dataKey="count" name="Meals" radius={[0, 3, 3, 0]}>
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
