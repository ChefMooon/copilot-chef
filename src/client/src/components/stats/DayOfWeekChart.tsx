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
            stroke="#E4DDD0"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="day"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
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
            {data.map((entry, index) => {
              const intensity = max > 0 ? entry.count / max : 0;
              const r = Math.round(59 + (168 - 59) * (1 - intensity));
              const g = Math.round(94 + (200 - 94) * (1 - intensity));
              const b = Math.round(69 + (176 - 69) * (1 - intensity));
              return (
                <Cell fill={`rgb(${r},${g},${b})`} key={`cell-${index}`} />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
