"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Region, SortKey, RegionType } from "@/lib/types";
import RegionBadge from "./RegionBadge";
import { formatNumber, formatWon, latestFund } from "@/lib/utils";

const SIDOS = ["전체", "부산", "대구", "인천", "광주", "대전", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남"];

interface Props {
  regions: Region[];
  latestYear: string;
}

function perCapitaFundValue(r: Region): number {
  const pop = r.population?.total ?? 0;
  if (pop === 0) return 0;
  return latestFund(r.fund) / pop;
}

export default function RegionTable({ regions, latestYear }: Props) {
  const router = useRouter();
  const [sido, setSido] = useState("전체");
  const [typeFilter, setTypeFilter] = useState<RegionType>("전체");
  const [sortKey, setSortKey] = useState<SortKey>("population");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const filtered = useMemo(() => {
    let list = regions;
    if (sido !== "전체") list = list.filter((r) => r.sido === sido);
    if (typeFilter !== "전체") list = list.filter((r) => r.type === typeFilter);

    return [...list].sort((a, b) => {
      let va = 0, vb = 0;
      if (sortKey === "population") {
        va = a.population?.total ?? 0;
        vb = b.population?.total ?? 0;
      } else if (sortKey === "fund") {
        va = latestFund(a.fund);
        vb = latestFund(b.fund);
      } else if (sortKey === "agingIndex") {
        va = a.population?.agingIndex ?? 0;
        vb = b.population?.agingIndex ?? 0;
      } else if (sortKey === "perCapitaFund") {
        va = perCapitaFundValue(a);
        vb = perCapitaFundValue(b);
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [regions, sido, typeFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-[#0B4171] ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-start">
        {/* Sido select */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">시도</span>
          <div className="flex flex-wrap gap-1">
            {SIDOS.map((s) => (
              <button
                key={s}
                onClick={() => setSido(s)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                  sido === s
                    ? "bg-[#0B4171] text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Type filter */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">유형</span>
          <div className="flex gap-1">
            {(["전체", "감소", "관심"] as RegionType[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                  typeFilter === t
                    ? t === "감소"
                      ? "bg-rose-600 text-white"
                      : t === "관심"
                      ? "bg-amber-500 text-white"
                      : "bg-[#0B4171] text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                }`}
              >
                {t === "전체" ? "전체" : `${t}지역`}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-1.5 ml-auto">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 text-right">정렬</span>
          <div className="flex gap-1">
            {([
              ["population", "인구"],
              ["fund", "기금"],
              ["agingIndex", "노령화"],
              ["perCapitaFund", "1인당"],
            ] as [SortKey, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => toggleSort(k)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors flex items-center ${
                  sortKey === k
                    ? "bg-[#0B4171] text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                }`}
              >
                {label}
                {sortKey === k && (
                  <span className="ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">{filtered.length}개 지역</p>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">시도</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">시군구</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">유형</th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-800"
                onClick={() => toggleSort("population")}
              >
                총인구 <SortIcon k="population" />
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-800"
                onClick={() => toggleSort("agingIndex")}
              >
                노령화지수 <SortIcon k="agingIndex" />
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-800"
                onClick={() => toggleSort("fund")}
              >
                {latestYear}년 기금 <SortIcon k="fund" />
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-800"
                onClick={() => toggleSort("perCapitaFund")}
              >
                1인당 기금 <SortIcon k="perCapitaFund" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => {
              const pcf = perCapitaFundValue(r);
              return (
                <tr
                  key={r.id}
                  className="hover:bg-[#E8EFF6]/40 transition-colors cursor-pointer"
                  onClick={() => router.push(`/region/${encodeURIComponent(r.id)}`)}
                >
                  <td className="px-4 py-4 text-slate-500 text-sm">{r.sido}</td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/region/${encodeURIComponent(r.id)}`}
                      className="font-semibold text-slate-900 hover:text-[#1E5A8E] transition-colors"
                    >
                      {r.sigungu}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <RegionBadge type={r.type} size="sm" />
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm text-slate-700 tabular-nums">
                    {formatNumber(r.population?.total ?? 0)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm text-slate-700 tabular-nums">
                    {r.population?.agingIndex?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm text-slate-700 tabular-nums">
                    {formatWon(latestFund(r.fund))}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm text-slate-700 tabular-nums">
                    {pcf > 0 ? formatWon(Math.round(pcf)) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((r) => {
          const pcf = perCapitaFundValue(r);
          return (
            <Link
              key={r.id}
              href={`/region/${encodeURIComponent(r.id)}`}
              className="bg-white rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-4 flex flex-col gap-3 hover:shadow-[0_2px_8px_0_rgba(11,65,113,0.12)] transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">{r.sido}</p>
                  <p className="font-semibold text-slate-900">{r.sigungu}</p>
                </div>
                <RegionBadge type={r.type} size="sm" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">총인구</span>
                  <span className="font-mono text-sm font-semibold text-slate-800 tabular-nums">
                    {formatNumber(r.population?.total ?? 0)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">노령화</span>
                  <span className="font-mono text-sm font-semibold text-slate-800">
                    {r.population?.agingIndex?.toFixed(0) ?? "—"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">{latestYear}기금</span>
                  <span className="font-mono text-sm font-semibold text-slate-800">
                    {formatWon(latestFund(r.fund))}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">1인당</span>
                  <span className="font-mono text-sm font-semibold text-slate-800">
                    {pcf > 0 ? formatWon(Math.round(pcf)) : "—"}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
