"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Legend,
} from "recharts";
import type { Insights, PopulationTrend } from "@/lib/types";
import { formatWon, formatRate, rateColorClass, dataUrl } from "@/lib/utils";

// PerCapitaPoint matches the shape computed in insights/page.tsx
export interface PerCapitaPoint {
  id: string;
  name: string;
  sido: string;
  type: "감소" | "관심";
  perCapita: number;
  fund: number;
  population: number;
}

interface Props {
  perCapitaData: PerCapitaPoint[];
  latestYear: string;
  censusYear: string;
}

// Scatter tooltip
function ScatterTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PerCapitaPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-md text-xs min-w-[140px]">
      <p className="font-semibold text-slate-800 mb-1.5">{d.name}</p>
      <p className="text-slate-500">
        인구:{" "}
        <span className="font-mono text-slate-700">
          {d.population.toLocaleString()}명
        </span>
      </p>
      <p className="text-slate-500">
        기금:{" "}
        <span className="font-mono text-slate-700">{formatWon(d.fund)}</span>
      </p>
      <p className="text-slate-500">
        1인당:{" "}
        <span className="font-mono text-slate-700">{formatWon(d.perCapita)}</span>
      </p>
    </div>
  );
}

export default function InsightsView({ perCapitaData, latestYear, censusYear }: Props) {
  const [showAllTable, setShowAllTable] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [trendData, setTrendData] = useState<PopulationTrend | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    fetch(dataUrl("/data/insights.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInsights(d ?? null))
      .catch(() => setInsights(null))
      .finally(() => setInsightsLoading(false));
  }, []);

  useEffect(() => {
    fetch(dataUrl("/data/population-trend.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PopulationTrend | null) => setTrendData(d ?? null))
      .catch(() => setTrendData(null))
      .finally(() => setTrendLoading(false));
  }, []);

  const top15 = useMemo(() => perCapitaData.slice(0, 15), [perCapitaData]);

  const scatterDecrease = useMemo(
    () => perCapitaData.filter((d) => d.type === "감소" && d.population > 0 && d.fund > 0),
    [perCapitaData]
  );
  const scatterInterest = useMemo(
    () => perCapitaData.filter((d) => d.type === "관심" && d.population > 0 && d.fund > 0),
    [perCapitaData]
  );

  // 인구 감소 속도: 22.10 대비 최신월 감소율 상위 15
  const declineTop15 = useMemo(() => {
    if (!trendData) return [];
    const nameById = Object.fromEntries(
      perCapitaData.map((d) => [d.id, d.name])
    );
    const rows: { id: string; name: string; declineRate: number; absRate: number }[] = [];

    for (const [regionId, vals] of Object.entries(trendData.series)) {
      const name = nameById[regionId];
      if (!name) continue;
      const firstIdx = vals.findIndex((v) => v !== null);
      if (firstIdx === -1) continue;
      const firstVal = vals[firstIdx]!;
      if (firstVal === 0) continue;
      const lastIdx =
        vals.length - 1 - [...vals].reverse().findIndex((v) => v !== null);
      const lastVal = vals[lastIdx];
      if (lastVal == null) continue;
      const declineRate = ((lastVal - firstVal) / firstVal) * 100;
      rows.push({ id: regionId, name, declineRate, absRate: Math.abs(declineRate) });
    }

    return rows.sort((a, b) => a.declineRate - b.declineRate).slice(0, 15);
  }, [trendData, perCapitaData]);

  return (
    <div className="flex flex-col gap-8">
      {/* ===== Section 1: 1인당 기금액 랭킹 ===== */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              1인당 기금액 랭킹
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {latestYear}년 기금 ÷ {censusYear}년 총인구 · 상위 15개 지역
            </p>
          </div>
          <button
            onClick={() => setShowAllTable((v) => !v)}
            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 transition-colors"
          >
            {showAllTable ? "차트만 보기" : "전체 테이블"}
          </button>
        </div>

        {perCapitaData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400">
              regions.json에 인구·기금 데이터가 없습니다.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-6">
              <div style={{ height: 420 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={top15}
                    margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
                    barSize={18}
                  >
                    <CartesianGrid
                      horizontal={false}
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => formatWon(v, 0)}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 11, fill: "#334155" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => [
                        formatWon(typeof v === "number" ? v : 0) + "원",
                        "1인당 기금",
                      ]}
                      contentStyle={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "12px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      }}
                    />
                    <Bar dataKey="perCapita" radius={[0, 4, 4, 0]}>
                      {top15.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.type === "감소" ? "#f43f5e" : "#f59e0b"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 px-2">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-3 h-3 rounded-sm bg-rose-500 shrink-0" />
                  감소지역
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-3 h-3 rounded-sm bg-amber-400 shrink-0" />
                  관심지역
                </span>
              </div>
            </div>

            {showAllTable && (
              <div className="rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-500 w-8">
                        순위
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-500">
                        지역
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-500">
                        유형
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold text-slate-500">
                        {latestYear}년 기금
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold text-slate-500">
                        인구
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold text-slate-500">
                        1인당 기금
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {perCapitaData.map((d, i) => (
                      <tr
                        key={d.id}
                        className={`transition-colors hover:bg-slate-50/50 ${
                          i < 15 ? "bg-amber-50/20" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono text-slate-400 tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/region/${encodeURIComponent(d.id)}`}
                            className="font-medium text-slate-800 hover:text-[#1E5A8E] transition-colors"
                          >
                            {d.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ring-1 ${
                              d.type === "감소"
                                ? "bg-rose-50 text-rose-700 ring-rose-200"
                                : "bg-amber-50 text-amber-700 ring-amber-200"
                            }`}
                          >
                            {d.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                          {formatWon(d.fund)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                          {d.population.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-slate-800">
                          {formatWon(d.perCapita)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== Section 2: 초과집행 사업 ===== */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">초과집행 사업</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            예산현액 대비 지출액이 100%를 초과한 사업 전체
          </p>
        </div>

        {insightsLoading ? (
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-10 text-center">
            <p className="text-sm text-slate-400">데이터를 불러오는 중...</p>
          </div>
        ) : !insights ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400">인사이트 데이터를 준비 중입니다.</p>
            <p className="text-xs text-slate-300 mt-1">
              파이프라인 실행 후 public/data/insights.json 생성 시 자동으로 표시됩니다.
            </p>
          </div>
        ) : insights.overExecution.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-6 text-center">
            <p className="text-sm text-slate-400">초과집행 사업이 없습니다.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-500">
                    지역
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-500">
                    사업명
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-500">
                    예산현액
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-500">
                    지출액
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-500">
                    집행률
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {insights.overExecution.map((p) => (
                  <tr
                    key={`${p.regionId}|${p.dbizCd}|${p.acntDvNm}`}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/region/${encodeURIComponent(p.regionId)}`}
                        className="font-medium text-[#0B4171] hover:text-[#1E5A8E] hover:underline transition-colors"
                      >
                        {p.sido} {p.sigungu}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 max-w-[200px]">
                      <span className="line-clamp-2">{p.dbizNm}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                      {formatWon(p.bdgCashAmt)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                      {formatWon(p.epAmt)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`font-mono font-bold tabular-nums ${rateColorClass(p.rate)}`}
                      >
                        {formatRate(p.rate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===== Section 3: 인구 × 기금 산점도 ===== */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            인구 × 기금 산점도
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            x = {latestYear}년 총인구, y = {latestYear}년 기금 · 점 색상 = 지역 유형
          </p>
        </div>

        {scatterDecrease.length + scatterInterest.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400">
              regions.json에 인구·기금 데이터가 없습니다.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-6">
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    dataKey="population"
                    name="총인구"
                    tickFormatter={(v: number) =>
                      v >= 10000
                        ? `${(v / 10000).toFixed(0)}만`
                        : v.toLocaleString()
                    }
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    label={{
                      value: "총인구 (명)",
                      position: "insideBottom",
                      offset: -4,
                      fontSize: 11,
                      fill: "#94a3b8",
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="fund"
                    name="기금"
                    tickFormatter={(v: number) => formatWon(v, 0)}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                    label={{
                      value: "기금",
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 11,
                      fill: "#94a3b8",
                    }}
                  />
                  <Tooltip content={<ScatterTip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  />
                  <Scatter
                    name="감소지역"
                    data={scatterDecrease}
                    fill="#f43f5e"
                    fillOpacity={0.7}
                    r={5}
                  />
                  <Scatter
                    name="관심지역"
                    data={scatterInterest}
                    fill="#f59e0b"
                    fillOpacity={0.7}
                    r={5}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* ===== Section 4: 인구 감소 속도 ===== */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            인구 감소 속도
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            2022.10 대비 최신월 주민등록 인구 감소율 상위 15개 지역
          </p>
        </div>

        {trendLoading ? (
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-10 text-center">
            <p className="text-sm text-slate-400">데이터를 불러오는 중...</p>
          </div>
        ) : !trendData ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400">
              인구 추이 데이터를 준비 중입니다.
            </p>
            <p className="text-xs text-slate-300 mt-1">
              파이프라인 실행 후 public/data/population-trend.json 생성 시
              자동으로 표시됩니다.
            </p>
          </div>
        ) : declineTop15.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-6 text-center">
            <p className="text-sm text-slate-400">
              감소율 데이터를 계산할 수 없습니다.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-6">
            <div style={{ height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={declineTop15}
                  margin={{ top: 4, right: 72, left: 8, bottom: 4 }}
                  barSize={18}
                >
                  <CartesianGrid
                    horizontal={false}
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    tick={{ fontSize: 11, fill: "#334155" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v, _name, item) => {
                      const row = item.payload as {
                        declineRate: number;
                        absRate: number;
                      };
                      return [
                        `${row.declineRate.toFixed(1)}%`,
                        "감소율 (22.10 대비)",
                      ];
                    }}
                    contentStyle={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  />
                  <Bar dataKey="absRate" radius={[0, 4, 4, 0]}>
                    {declineTop15.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.absRate >= 8
                            ? "#be123c"
                            : entry.absRate >= 5
                            ? "#f43f5e"
                            : entry.absRate >= 3
                            ? "#fb7185"
                            : "#fda4af"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              행정안전부 주민등록 인구 (매월 말일 기준). 2022.10 첫 관측 대비
              최신 완결월 감소율. 색이 진할수록 감소 속도가 빠릅니다.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
