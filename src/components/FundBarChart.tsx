"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatWon } from "@/lib/utils";

interface Props {
  fund: Record<string, number>;
  years: string[];
}

export default function FundBarChart({ fund, years }: Props) {
  const data = years.map((year) => ({
    year,
    amount: fund[year] ?? 0,
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
          barSize={32}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e7e5e4"
          />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: "#78716c" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatWon(v, 0)}
            tick={{ fontSize: 11, fill: "#78716c" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(v) => [formatWon(typeof v === "number" ? v : 0) + "원", "예산액"]}
            labelStyle={{ fontWeight: 600, color: "#1c1917" }}
            contentStyle={{
              border: "1px solid #e7e5e4",
              borderRadius: "8px",
              fontSize: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          />
          <Bar dataKey="amount" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
