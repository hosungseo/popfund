"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PopulationTrend } from "@/lib/types";
import { fmtYm } from "@/lib/utils";

interface Props {
  regionId: string;
}


function fmtPop(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  // 소수 2자리 — 좁은 도메인에서 축 눈금이 같은 라벨로 뭉치지 않도록
  if (n >= 10_000) return `${parseFloat((n / 10_000).toFixed(2))}만`;
  return n.toLocaleString("ko-KR");
}

export default function PopulationTrendChart({ regionId }: Props) {
  const [trend, setTrend] = useState<PopulationTrend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/population-trend.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PopulationTrend | null) => setTrend(d ?? null))
      .catch(() => setTrend(null))
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => {
    if (!trend) return null;
    const vals = trend.series[regionId];
    if (!vals) return null;
    return trend.months.map((ym, i) => ({
      ym,
      label: fmtYm(ym),
      pop: vals[i] ?? null,
    }));
  }, [trend, regionId]);

  // 6개월 간격 틱 (label 값 기준)
  const ticks = useMemo(() => {
    if (!chartData) return [];
    return chartData
      .filter((_, i) => i % 6 === 0)
      .map((d) => d.label);
  }, [chartData]);

  const stats = useMemo(() => {
    if (!chartData) return null;
    const first = chartData.find((d) => d.pop !== null);
    const last = [...chartData].reverse().find((d) => d.pop !== null);
    if (!first || !last || first.pop == null || last.pop == null) return null;
    const diff = last.pop - first.pop;
    const pct = (diff / first.pop) * 100;
    return { first, last, diff, pct };
  }, [chartData]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <p className="text-sm text-stone-400">데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!trend || !chartData || !stats) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 border-dashed p-8 flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-500">
          준비 중
        </span>
        <p className="text-sm text-stone-500 max-w-sm">
          인구 추이 데이터를 준비 중입니다. 파이프라인 실행 후 자동으로
          표시됩니다.
        </p>
      </div>
    );
  }

  const isDecrease = stats.diff < 0;
  const nonNull = chartData.filter((d) => d.pop !== null).map((d) => d.pop!);
  const minVal = Math.min(...nonNull);
  const maxVal = Math.max(...nonNull);
  const range = maxVal - minVal;
  const margin = range > 0 ? range * 0.12 : maxVal * 0.05;
  const yDomain: [number, number] = [
    Math.floor(minVal - margin),
    Math.ceil(maxVal + margin),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 통계 칩 3개 */}
      <div className="flex flex-wrap gap-2">
        <div className="bg-stone-50 rounded-xl border border-stone-200 px-4 py-2.5 flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
            최초 관측 ({fmtYm(stats.first.ym)})
          </span>
          <span className="font-mono text-sm font-semibold text-stone-800 tabular-nums">
            {stats.first.pop!.toLocaleString("ko-KR")}명
          </span>
        </div>
        <div className="bg-stone-50 rounded-xl border border-stone-200 px-4 py-2.5 flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
            최신 ({fmtYm(stats.last.ym)})
          </span>
          <span className="font-mono text-sm font-semibold text-stone-800 tabular-nums">
            {stats.last.pop!.toLocaleString("ko-KR")}명
          </span>
        </div>
        <div
          className={`rounded-xl border px-4 py-2.5 flex flex-col gap-0.5 ${
            isDecrease
              ? "bg-rose-50 border-rose-200"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <span
            className={`text-[10px] font-medium uppercase tracking-wide ${
              isDecrease ? "text-rose-400" : "text-emerald-500"
            }`}
          >
            증감
          </span>
          <span
            className={`font-mono text-sm font-semibold tabular-nums ${
              isDecrease ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {stats.diff > 0 ? "+" : ""}
            {stats.diff.toLocaleString("ko-KR")}명&nbsp;(
            {stats.pct > 0 ? "+" : ""}
            {stats.pct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* 차트 */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e7e5e4"
              />
              <XAxis
                dataKey="label"
                ticks={ticks}
                interval={0}
                tick={{ fontSize: 11, fill: "#78716c" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v: number) => fmtPop(v)}
                tick={{ fontSize: 11, fill: "#78716c" }}
                axisLine={false}
                tickLine={false}
                width={54}
              />
              <Tooltip
                formatter={(v) => [
                  typeof v === "number"
                    ? v.toLocaleString("ko-KR") + "명"
                    : "—",
                  "주민등록 총인구",
                ]}
                contentStyle={{
                  border: "1px solid #e7e5e4",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              />
              <Line
                type="monotone"
                dataKey="pop"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#f43f5e" }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-stone-400 mt-3 leading-relaxed">
          행정안전부 주민등록 인구 (매월 말일 기준). 인구감소지역 최초 지정은
          2021.10이며, 원천 API 제공 시작점(2022.10) 이후 추이만
          표시됩니다.
        </p>
      </div>
    </div>
  );
}
