"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Lifepop } from "@/lib/types";
import { dataUrl } from "@/lib/utils";

interface Props {
  regionId: string;
}

function fmtNum(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  return n.toLocaleString("ko-KR");
}

function fmtMonthLabel(ym: string): string {
  return `${parseInt(ym.slice(4, 6), 10)}월`;
}

export default function LifepopCard({ regionId }: Props) {
  const [data, setData] = useState<Lifepop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(dataUrl("/data/lifepop.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Lifepop | null) => setData(d ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const regionSeries = useMemo(() => {
    if (!data) return null;
    return data.series[regionId] ?? null;
  }, [data, regionId]);

  const lastMonth = useMemo(() => {
    if (!data || !regionSeries) return null;
    const lastYm = data.months[data.months.length - 1];
    return regionSeries.monthly[lastYm] ?? null;
  }, [data, regionSeries]);

  const chartData = useMemo(() => {
    if (!data || !regionSeries) return null;
    return data.months.map((ym) => {
      const m = regionSeries.monthly[ym] ?? {};
      return {
        ym,
        label: fmtMonthLabel(ym),
        registered: m.registered ?? 0,
        staying: m.staying ?? 0,
      };
    });
  }, [data, regionSeries]);

  const stayRatio = regionSeries?.stayRatio ?? null;
  const isHighRatio = stayRatio !== null && stayRatio >= 5;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-8 text-center">
        <p className="text-sm text-slate-400">데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!data || !regionSeries || !lastMonth || !chartData) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-dashed border-slate-200 p-8 flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
          준비 중
        </span>
        <p className="text-sm text-slate-500 max-w-sm">
          생활인구 데이터를 준비 중입니다. 파이프라인 실행 후 자동으로
          표시됩니다.
        </p>
      </div>
    );
  }

  const lastYm = data.months[data.months.length - 1];

  return (
    <div className="flex flex-col gap-4">
      {/* Stat chips: 생활인구 / 주민등록인구 / 체류인구 */}
      <div className="flex flex-wrap gap-2">
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-2.5 flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            생활인구 ({fmtMonthLabel(lastYm)})
          </span>
          <span className="font-mono text-sm font-semibold text-slate-800 tabular-nums">
            {lastMonth.living != null ? fmtNum(lastMonth.living) + "명" : "—"}
          </span>
        </div>
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-2.5 flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            주민등록인구 ({fmtMonthLabel(lastYm)})
          </span>
          <span className="font-mono text-sm font-semibold text-slate-800 tabular-nums">
            {lastMonth.registered != null
              ? fmtNum(lastMonth.registered) + "명"
              : "—"}
          </span>
        </div>
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-2.5 flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            체류인구 ({fmtMonthLabel(lastYm)})
          </span>
          <span className="font-mono text-sm font-semibold text-slate-800 tabular-nums">
            {lastMonth.staying != null
              ? fmtNum(lastMonth.staying) + "명"
              : "—"}
          </span>
        </div>
      </div>

      {/* stayRatio emphasis card */}
      {stayRatio !== null && (
        <div
          className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-4 ${
            isHighRatio
              ? "bg-[#E8EFF6] border-[#0B4171]/20"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <span
              className={`text-[10px] font-medium uppercase tracking-wide ${
                isHighRatio ? "text-[#1E5A8E]" : "text-slate-400"
              }`}
            >
              체류 배율 (분기 평균)
            </span>
            <span
              className={`font-mono text-xl font-bold tabular-nums ${
                isHighRatio ? "text-[#0B4171]" : "text-slate-700"
              }`}
            >
              {stayRatio.toFixed(1)}×
            </span>
          </div>
          <p
            className={`text-xs leading-snug max-w-[220px] text-right ${
              isHighRatio ? "text-[#1E5A8E]" : "text-slate-500"
            }`}
          >
            주민등록인구 1명당 체류인구{" "}
            <span className="font-semibold">{stayRatio.toFixed(1)}명</span>
            {isHighRatio && (
              <span className="block text-[10px] mt-0.5 text-[#0B4171]">
                관광·통근형 수요 기반 신호
              </span>
            )}
          </p>
        </div>
      )}

      {/* Mini stacked bar chart */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-6">
        <div className="flex items-center gap-4 mb-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block w-3 h-2.5 rounded-sm bg-slate-300 shrink-0" />
            주민등록인구
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block w-3 h-2.5 rounded-sm bg-sky-400 shrink-0" />
            체류인구
          </span>
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
              barSize={40}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => fmtNum(v)}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={54}
              />
              <Tooltip
                formatter={(value: unknown, name) => {
                  const v =
                    typeof value === "number"
                      ? value.toLocaleString("ko-KR") + "명"
                      : "—";
                  const label =
                    name === "registered" ? "주민등록인구" : "체류인구";
                  return [v, label];
                }}
                contentStyle={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              />
              <Bar
                dataKey="registered"
                stackId="a"
                fill="#cbd5e1"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="staying"
                stackId="a"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          행정안전부 생활인구 공표 (2025년 4분기). 생활인구 = 주민등록인구 +
          체류인구(월 1회, 하루 3시간 이상 체류) + 등록외국인.
        </p>
      </div>
    </div>
  );
}
