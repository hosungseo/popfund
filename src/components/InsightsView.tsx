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
import type { Insights } from "@/lib/types";
import { formatWon, formatRate, rateColorClass } from "@/lib/utils";

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
    <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-md text-xs min-w-[140px]">
      <p className="font-semibold text-stone-800 mb-1.5">{d.name}</p>
      <p className="text-stone-500">
        인구:{" "}
        <span className="font-mono text-stone-700">
          {d.population.toLocaleString()}명
        </span>
      </p>
      <p className="text-stone-500">
        기금:{" "}
        <span className="font-mono text-stone-700">{formatWon(d.fund)}</span>
      </p>
      <p className="text-stone-500">
        1인당:{" "}
        <span className="font-mono text-stone-700">{formatWon(d.perCapita)}</span>
      </p>
    </div>
  );
}

export default function InsightsView({ perCapitaData, latestYear }: Props) {
  const [showAllTable, setShowAllTable] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);

  useEffect(() => {
    fetch("/data/insights.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInsights(d ?? null))
      .catch(() => setInsights(null))
      .finally(() => setInsightsLoading(false));
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

  return (
    <div className="flex flex-col gap-8">
      {/* ===== Section 1: 1인당 기금액 랭킹 ===== */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-stone-800">
              1인당 기금액 랭킹
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {latestYear}년 기금 ÷ 2024 총인구 · 상위 15개 지역
            </p>
          </div>
          <button
            onClick={() => setShowAllTable((v) => !v)}
            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-300 transition-colors"
          >
            {showAllTable ? "차트만 보기" : "전체 테이블"}
          </button>
        </div>

        {perCapitaData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 border-dashed p-10 text-center">
            <p className="text-sm text-stone-400">
              regions.json에 인구·기금 데이터가 없습니다.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
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
                      stroke="#e7e5e4"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => formatWon(v, 0)}
                      tick={{ fontSize: 11, fill: "#78716c" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 11, fill: "#44403c" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => [
                        formatWon(typeof v === "number" ? v : 0) + "원",
                        "1인당 기금",
                      ]}
                      contentStyle={{
                        border: "1px solid #e7e5e4",
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
                <span className="flex items-center gap-1.5 text-xs text-stone-500">
                  <span className="w-3 h-3 rounded-sm bg-rose-500 shrink-0" />
                  감소지역
                </span>
                <span className="flex items-center gap-1.5 text-xs text-stone-500">
                  <span className="w-3 h-3 rounded-sm bg-amber-400 shrink-0" />
                  관심지역
                </span>
              </div>
            </div>

            {showAllTable && (
              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-stone-500 w-8">
                        순위
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-stone-500">
                        지역
                      </th>
                      <th className="px-4 py-2.5 text-left font-semibold text-stone-500">
                        유형
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold text-stone-500">
                        {latestYear}년 기금
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold text-stone-500">
                        인구
                      </th>
                      <th className="px-4 py-2.5 text-right font-semibold text-stone-500">
                        1인당 기금
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {perCapitaData.map((d, i) => (
                      <tr
                        key={d.id}
                        className={`transition-colors hover:bg-stone-50/50 ${
                          i < 15 ? "bg-amber-50/20" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono text-stone-400 tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/region/${encodeURIComponent(d.id)}`}
                            className="font-medium text-stone-800 hover:text-blue-700 transition-colors"
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
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-stone-700">
                          {formatWon(d.fund)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-stone-600">
                          {d.population.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-stone-800">
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
          <h2 className="text-base font-semibold text-stone-800">초과집행 사업</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            예산현액 대비 지출액이 100%를 초과한 사업 전체
          </p>
        </div>

        {insightsLoading ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
            <p className="text-sm text-stone-400">데이터를 불러오는 중...</p>
          </div>
        ) : !insights ? (
          <div className="bg-white rounded-2xl border border-stone-200 border-dashed p-10 text-center">
            <p className="text-sm text-stone-400">인사이트 데이터를 준비 중입니다.</p>
            <p className="text-xs text-stone-300 mt-1">
              파이프라인 실행 후 public/data/insights.json 생성 시 자동으로 표시됩니다.
            </p>
          </div>
        ) : insights.overExecution.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center">
            <p className="text-sm text-stone-400">초과집행 사업이 없습니다.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-stone-500">
                    지역
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-stone-500">
                    사업명
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-stone-500">
                    예산현액
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-stone-500">
                    지출액
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-stone-500">
                    집행률
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {insights.overExecution.map((p) => (
                  <tr
                    key={`${p.regionId}|${p.dbizCd}|${p.acntDvNm}`}
                    className="hover:bg-stone-50/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/region/${encodeURIComponent(p.regionId)}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {p.sido} {p.sigungu}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-stone-700 max-w-[200px]">
                      <span className="line-clamp-2">{p.dbizNm}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-stone-600">
                      {formatWon(p.bdgCashAmt)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-stone-600">
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
          <h2 className="text-base font-semibold text-stone-800">
            인구 × 기금 산점도
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            x = {latestYear}년 총인구, y = {latestYear}년 기금 · 점 색상 = 지역 유형
          </p>
        </div>

        {scatterDecrease.length + scatterInterest.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 border-dashed p-10 text-center">
            <p className="text-sm text-stone-400">
              regions.json에 인구·기금 데이터가 없습니다.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    type="number"
                    dataKey="population"
                    name="총인구"
                    tickFormatter={(v: number) =>
                      v >= 10000
                        ? `${(v / 10000).toFixed(0)}만`
                        : v.toLocaleString()
                    }
                    tick={{ fontSize: 11, fill: "#78716c" }}
                    axisLine={false}
                    tickLine={false}
                    label={{
                      value: "총인구 (명)",
                      position: "insideBottom",
                      offset: -4,
                      fontSize: 11,
                      fill: "#a8a29e",
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="fund"
                    name="기금"
                    tickFormatter={(v: number) => formatWon(v, 0)}
                    tick={{ fontSize: 11, fill: "#78716c" }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                    label={{
                      value: "기금",
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 11,
                      fill: "#a8a29e",
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
    </div>
  );
}
