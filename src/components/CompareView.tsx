"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Region } from "@/lib/types";
import RegionBadge from "./RegionBadge";
import { formatNumber, formatWon } from "@/lib/utils";

const PALETTE = [
  "#1d4ed8", // blue
  "#be123c", // rose
  "#b45309", // amber
  "#065f46", // emerald
  "#6b21a8", // violet
  "#0e7490", // cyan
];

const MAX_COMPARE = 6;

interface Props {
  regions: Region[];
  fundYears: string[];
}

export default function CompareView({ regions, fundYears }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sidoFilter, setSidoFilter] = useState("전체");

  const sidos = useMemo(() => {
    const s = Array.from(new Set(regions.map((r) => r.sido))).sort();
    return ["전체", ...s];
  }, [regions]);

  const visible = useMemo(() => {
    let list = regions;
    if (sidoFilter !== "전체") list = list.filter((r) => r.sido === sidoFilter);
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(
        (r) => r.sigungu.includes(q) || r.sido.includes(q)
      );
    }
    return list;
  }, [regions, sidoFilter, search]);

  const selectedRegions = useMemo(
    () => selected.map((id) => regions.find((r) => r.id === id)).filter(Boolean) as Region[],
    [selected, regions]
  );

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_COMPARE
        ? prev
        : [...prev, id]
    );
  }

  // Chart keys use r.id (unique) — sigungu collides across sidos (동구×4, 서구×2, 중구×2, 고성군×2)
  const popData = [
    { metric: "총인구", ...Object.fromEntries(selectedRegions.map((r) => [r.id, r.population?.total ?? 0])) },
    { metric: "남성", ...Object.fromEntries(selectedRegions.map((r) => [r.id, r.population?.male ?? 0])) },
    { metric: "여성", ...Object.fromEntries(selectedRegions.map((r) => [r.id, r.population?.female ?? 0])) },
  ];

  // Fund trend data
  const fundData = fundYears.map((year) => ({
    year,
    ...Object.fromEntries(selectedRegions.map((r) => [r.id, r.fund[year] ?? 0])),
  }));

  return (
    <div className="flex flex-col gap-8">
      {/* Selection panel */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex flex-wrap gap-3 items-center">
          <h2 className="text-sm font-semibold text-stone-800">
            지역 선택
            <span className="ml-2 text-xs font-normal text-stone-400">
              ({selected.length}/{MAX_COMPARE}개 선택)
            </span>
          </h2>
          <input
            type="search"
            placeholder="시군구명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-stone-400 w-40"
          />
          <div className="flex flex-wrap gap-1">
            {sidos.map((s) => (
              <button
                key={s}
                onClick={() => setSidoFilter(s)}
                className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                  sidoFilter === s
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="ml-auto text-xs text-stone-400 hover:text-rose-600 transition-colors"
            >
              초기화
            </button>
          )}
        </div>

        <div className="max-h-56 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-stone-100">
            {visible.map((r) => {
              const isSelected = selected.includes(r.id);
              const idx = selected.indexOf(r.id);
              const isDisabled = !isSelected && selected.length >= MAX_COMPARE;

              return (
                <button
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  disabled={isDisabled}
                  className={`bg-white px-4 py-3 text-left flex items-center justify-between gap-2 transition-colors ${
                    isSelected
                      ? "bg-blue-50 ring-2 ring-inset ring-blue-500"
                      : isDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-stone-50"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] text-stone-400">{r.sido}</span>
                    <span className="text-sm font-medium text-stone-800">{r.sigungu}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <RegionBadge type={r.type} size="sm" />
                    {isSelected && (
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ backgroundColor: PALETTE[idx] }}
                      >
                        {idx + 1}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selected.length === 0 ? (
        <div className="py-20 text-center text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          위에서 2~6개 지역을 선택하면 비교 차트가 표시됩니다
        </div>
      ) : (
        <>
          {/* Selected chips */}
          <div className="flex flex-wrap gap-2">
            {selectedRegions.map((r, i) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: PALETTE[i] }}
              >
                {r.sido} {r.sigungu}
                <button
                  onClick={() => toggle(r.id)}
                  className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* Population bar chart */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-stone-800">인구 지표 비교</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={popData}
                  margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis
                    dataKey="metric"
                    tick={{ fontSize: 12, fill: "#78716c" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatNumber(v)}
                    tick={{ fontSize: 11, fill: "#78716c" }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v, name) => [formatNumber(typeof v === "number" ? v : 0) + "명", String(name ?? "")]}
                    contentStyle={{
                      border: "1px solid #e7e5e4",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                  {selectedRegions.map((r, i) => (
                    <Bar
                      key={r.id}
                      dataKey={r.id}
                      name={`${r.sido} ${r.sigungu}`}
                      fill={PALETTE[i]}
                      radius={[3, 3, 0, 0]}
                      barSize={20}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fund trend line chart */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-stone-800">
              연도별 지방소멸대응기금 예산 추이
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={fundData}
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
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
                    width={52}
                  />
                  <Tooltip
                    formatter={(v, name) => [formatWon(typeof v === "number" ? v : 0) + "원", String(name ?? "")]}
                    contentStyle={{
                      border: "1px solid #e7e5e4",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                  {selectedRegions.map((r, i) => (
                    <Line
                      key={r.id}
                      type="monotone"
                      dataKey={r.id}
                      name={`${r.sido} ${r.sigungu}`}
                      stroke={PALETTE[i]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: PALETTE[i] }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
