"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PopulationTrend, VitalTrend } from "@/lib/types";
import { fmtYm } from "@/lib/utils";

interface Props {
  regionId: string;
}


function fmtSigned(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("ko-KR")}`;
}

type Sign = "negative" | "positive" | "neutral";

function signOf(v: number): Sign {
  if (v < 0) return "negative";
  if (v > 0) return "positive";
  return "neutral";
}

function chipBg(s: Sign): string {
  if (s === "negative") return "bg-rose-50 border-rose-200";
  if (s === "positive") return "bg-emerald-50 border-emerald-200";
  return "bg-stone-50 border-stone-200";
}

function numCls(s: Sign): string {
  const base = "font-mono text-sm font-semibold tabular-nums";
  if (s === "negative") return `${base} text-rose-700`;
  if (s === "positive") return `${base} text-emerald-700`;
  return `${base} text-stone-700`;
}

function labelCls(s: Sign): string {
  const base = "text-[10px] font-medium uppercase tracking-wide";
  if (s === "negative") return `${base} text-rose-400`;
  if (s === "positive") return `${base} text-emerald-500`;
  return `${base} text-stone-400`;
}

interface ChartRow {
  ym: string;
  label: string;
  natural: number | null;
  social: number | null;
  totalChange: number | null;
  births: number | null;
  deaths: number | null;
}

export default function VitalDecomposition({ regionId }: Props) {
  const [popTrend, setPopTrend] = useState<PopulationTrend | null>(null);
  const [vital, setVital] = useState<VitalTrend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/data/population-trend.json")
        .then((r) => (r.ok ? (r.json() as Promise<PopulationTrend>) : Promise.resolve(null)))
        .catch(() => null as PopulationTrend | null),
      fetch("/data/vital-trend.json")
        .then((r) => (r.ok ? (r.json() as Promise<VitalTrend>) : Promise.resolve(null)))
        .catch(() => null as VitalTrend | null),
    ]).then(([pop, vit]) => {
      if (!cancelled) {
        setPopTrend(pop);
        setVital(vit);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [regionId]);

  const chartData = useMemo((): ChartRow[] | null => {
    if (!popTrend || !vital) return null;
    const popVals = popTrend.series[regionId];
    const vSeries = vital.series[regionId];
    if (!popVals || !vSeries) return null;

    const popByYm: Record<string, number | null> = {};
    popTrend.months.forEach((ym, i) => {
      popByYm[ym] = popVals[i] ?? null;
    });

    return vital.months.map((ym, i) => {
      const births = vSeries.births[i] ?? null;
      const deaths = vSeries.deaths[i] ?? null;
      const pop = popByYm[ym] ?? null;
      const prevYm = i > 0 ? vital.months[i - 1] : null;
      const prevPop = prevYm !== null ? (popByYm[prevYm] ?? null) : null;

      const natural =
        births !== null && deaths !== null ? births - deaths : null;
      const totalChange =
        pop !== null && prevPop !== null ? pop - prevPop : null;
      const social =
        natural !== null && totalChange !== null ? totalChange - natural : null;

      return { ym, label: fmtYm(ym), natural, social, totalChange, births, deaths };
    });
  }, [popTrend, vital, regionId]);

  const cumulative = useMemo(() => {
    if (!chartData) return null;
    let totalChange = 0;
    let natural = 0;
    let births = 0;
    let deaths = 0;
    let social = 0;
    let hasNatural = false;

    // 흐름(자연증감)과 저량 변화(총증감)의 창을 일치시키기 위해
    // totalChange가 계산되는 행(전월 인구가 있는 행)만 누계에 포함한다.
    // 이렇게 해야 총증감 = 자연증감 + 사회적 증감이 항상 성립한다.
    for (const row of chartData) {
      if (row.totalChange === null || row.natural === null) continue;
      natural += row.natural;
      births += row.births ?? 0;
      deaths += row.deaths ?? 0;
      hasNatural = true;
      if (row.social !== null) social += row.social;
      totalChange += row.totalChange;
    }
    if (!hasNatural) return null;
    return { totalChange, natural, births, deaths, social };
  }, [chartData]);

  const ticks = useMemo(() => {
    if (!chartData) return [];
    return chartData.filter((_, i) => i % 6 === 0).map((d) => d.label);
  }, [chartData]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <p className="text-sm text-stone-400">데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!vital || !chartData || !cumulative) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 border-dashed p-8 flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-500">
          준비 중
        </span>
        <p className="text-sm text-stone-500 max-w-sm">
          출생·사망 데이터를 준비 중입니다. data.go.kr 활용신청 승인 후
          파이프라인 실행 시 자동으로 표시됩니다.
        </p>
      </div>
    );
  }

  const totalSign = signOf(cumulative.totalChange);
  const naturalSign = signOf(cumulative.natural);
  const socialSign = signOf(cumulative.social);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <div
          className={`rounded-xl border px-4 py-2.5 flex flex-col gap-0.5 ${chipBg(totalSign)}`}
        >
          <span className={labelCls(totalSign)}>기간 누계 총증감</span>
          <span className={numCls(totalSign)}>
            {fmtSigned(cumulative.totalChange)}명
          </span>
        </div>

        <div
          className={`rounded-xl border px-4 py-2.5 flex flex-col gap-0.5 ${chipBg(naturalSign)}`}
        >
          <span className={labelCls(naturalSign)}>자연증감</span>
          <span className={numCls(naturalSign)}>
            {fmtSigned(cumulative.natural)}명
          </span>
          <span className="text-[10px] text-stone-400 font-mono tabular-nums">
            출생 {cumulative.births.toLocaleString("ko-KR")} · 사망{" "}
            {cumulative.deaths.toLocaleString("ko-KR")}
          </span>
        </div>

        <div
          className={`rounded-xl border px-4 py-2.5 flex flex-col gap-0.5 ${chipBg(socialSign)}`}
        >
          <span className={labelCls(socialSign)}>사회적 증감(근사)</span>
          <span className={numCls(socialSign)}>
            {fmtSigned(cumulative.social)}명
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
              barGap={2}
              barCategoryGap="30%"
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
                tickFormatter={(v: number) => v.toLocaleString("ko-KR")}
                tick={{ fontSize: 11, fill: "#78716c" }}
                axisLine={false}
                tickLine={false}
                width={54}
              />
              <Tooltip
                formatter={(value: unknown, name: string | number | undefined) => {
                  const v = typeof value === "number" ? value : null;
                  const labelMap: Record<string, string> = {
                    natural: "자연증감",
                    social: "사회적 증감(근사)",
                    totalChange: "총증감",
                  };
                  const key = String(name ?? "");
                  return [
                    v !== null
                      ? `${v >= 0 ? "+" : ""}${v.toLocaleString("ko-KR")}명`
                      : "—",
                    labelMap[key] ?? key,
                  ];
                }}
                contentStyle={{
                  border: "1px solid #e7e5e4",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              />
              <Bar
                dataKey="natural"
                name="natural"
                fill="#a8a29e"
                barSize={6}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="social"
                name="social"
                fill="#3b82f6"
                barSize={6}
                radius={[2, 2, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="totalChange"
                name="totalChange"
                stroke="#1c1917"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
                strokeDasharray="4 2"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5 mt-3 px-1">
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className="w-3 h-3 rounded-sm bg-stone-400 shrink-0" />
            자연증감
          </span>
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className="w-3 h-3 rounded-sm bg-blue-500 shrink-0" />
            사회적 증감(근사)
          </span>
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <span
              className="w-5 shrink-0 border-b border-dashed border-stone-700"
              style={{ borderBottomWidth: "1.5px" }}
            />
            총증감
          </span>
        </div>

        {/* Caption */}
        <p className="text-[11px] text-stone-400 mt-3 leading-relaxed">
          자연증감 = 출생등록 - 사망말소 (행정안전부 월별). 사회적 증감은
          총증감에서 자연증감을 뺀 근사치로, 전출입 외 등록 정정이 포함될 수
          있습니다.
        </p>
      </div>
    </div>
  );
}
