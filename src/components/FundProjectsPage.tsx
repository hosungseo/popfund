"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { FundProject } from "@/lib/types";
import { formatWon, executionRate, formatRate, rateColorClass, dataUrl } from "@/lib/utils";

const PAGE_SIZE = 50;

const FUND_LABELS: Record<string, string> = {
  confirmed: "확정",
  candidate: "후보",
};
const FUND_BADGE: Record<string, string> = {
  confirmed: "bg-[#E8EFF6] text-[#0B4171] ring-1 ring-[#0B4171]/20",
  candidate: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
};

type SortCol = "bdgCashAmt" | "epAmt" | "rate";
type SortDir = "asc" | "desc";

export default function FundProjectsPage() {
  const [data, setData] = useState<FundProject[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sidoFilter, setSidoFilter] = useState("전체");
  const [fundFilter, setFundFilter] = useState<"all" | "confirmed" | "candidate">("all");
  const [sortCol, setSortCol] = useState<SortCol>("bdgCashAmt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(dataUrl("/data/fund-projects.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const sidos = useMemo(() => {
    if (!data) return [];
    const s = Array.from(new Set(data.map((p) => p.sido))).sort();
    return ["전체", ...s];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data;
    if (sidoFilter !== "전체") list = list.filter((p) => p.sido === sidoFilter);
    if (fundFilter !== "all") list = list.filter((p) => p.fundRelated === fundFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.dbizNm.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let va = 0, vb = 0;
      if (sortCol === "rate") {
        va = executionRate(a.epAmt, a.bdgCashAmt);
        vb = executionRate(b.epAmt, b.bdgCashAmt);
      } else {
        va = a[sortCol];
        vb = b[sortCol];
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [data, sidoFilter, fundFilter, search, sortCol, sortDir]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, sidoFilter, fundFilter, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  // Summary stats for filtered set
  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const totalBudget = filtered.reduce((a, p) => a + p.bdgCashAmt, 0);
    const avgRate =
      filtered.reduce((a, p) => a + executionRate(p.epAmt, p.bdgCashAmt), 0) /
      filtered.length;
    return { count: filtered.length, totalBudget, avgRate };
  }, [filtered]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-[#0B4171] ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">
        기금사업 목록을 불러오는 중...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-400 text-sm">기금사업 데이터를 준비 중입니다.</p>
        <p className="text-slate-300 text-xs mt-1">
          파이프라인 실행 후 public/data/fund-projects.json 생성 시 자동으로 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "검색 결과", value: `${stats.count.toLocaleString()}건` },
            { label: "총 예산", value: formatWon(stats.totalBudget) },
            { label: "평균 집행률", value: formatRate(stats.avgRate) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-white rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] px-4 py-3 flex flex-col gap-0.5"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {label}
              </span>
              <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-start">
        {/* Search */}
        <input
          type="search"
          placeholder="사업명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] max-w-sm px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0B4171]/20 focus:border-[#1E5A8E] placeholder:text-slate-400"
        />

        {/* Sido filter */}
        <div className="flex flex-wrap gap-1">
          {sidos.map((s) => (
            <button
              key={s}
              onClick={() => setSidoFilter(s)}
              className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                sidoFilter === s
                  ? "bg-[#0B4171] text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Fund filter */}
        <div className="flex gap-1">
          {(["all", "confirmed", "candidate"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFundFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                fundFilter === f
                  ? "bg-[#0B4171] text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {f === "all" ? "전체" : FUND_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                지역
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                사업명
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                분야
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                기금
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-900"
                onClick={() => toggleSort("bdgCashAmt")}
              >
                예산현액 <SortIcon col="bdgCashAmt" />
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-900"
                onClick={() => toggleSort("epAmt")}
              >
                지출액 <SortIcon col="epAmt" />
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-900"
                onClick={() => toggleSort("rate")}
              >
                집행률 <SortIcon col="rate" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400 text-sm">
                  조건에 맞는 사업이 없습니다
                </td>
              </tr>
            ) : (
              paged.map((p) => {
                const rate = executionRate(p.epAmt, p.bdgCashAmt);
                const isOver = rate > 100;
                const isUnder = rate < 30;
                return (
                  <tr
                    key={`${p.regionId}|${p.dbizCd}|${p.acntDvNm}`}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/region/${encodeURIComponent(p.regionId)}`}
                        className="text-xs font-medium text-[#0B4171] hover:text-[#1E5A8E] hover:underline transition-colors"
                      >
                        {p.sido} {p.sigungu}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium max-w-[200px]">
                      <span className="line-clamp-2 text-sm">{p.dbizNm}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {p.fldNm}
                    </td>
                    <td className="px-4 py-3">
                      {p.fundRelated && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${FUND_BADGE[p.fundRelated]}`}
                        >
                          {FUND_LABELS[p.fundRelated]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {formatWon(p.bdgCashAmt)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {formatWon(p.epAmt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${rateColorClass(rate)}`}
                      >
                        {formatRate(rate)}
                      </span>
                      {isOver && (
                        <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                          초과
                        </span>
                      )}
                      {isUnder && !isOver && (
                        <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                          저조
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">
            조건에 맞는 사업이 없습니다
          </p>
        ) : (
          paged.map((p) => {
            const rate = executionRate(p.epAmt, p.bdgCashAmt);
            const isOver = rate > 100;
            const isUnder = rate < 30;
            return (
              <div
                key={`${p.regionId}|${p.dbizCd}|${p.acntDvNm}`}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/region/${encodeURIComponent(p.regionId)}`}
                      className="text-[11px] font-medium text-[#0B4171] hover:underline"
                    >
                      {p.sido} {p.sigungu}
                    </Link>
                    <p className="text-sm font-medium text-slate-800 leading-snug mt-0.5">
                      {p.dbizNm}
                    </p>
                  </div>
                  {p.fundRelated && (
                    <span
                      className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${FUND_BADGE[p.fundRelated]}`}
                    >
                      {FUND_LABELS[p.fundRelated]}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">{p.fldNm}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    예산{" "}
                    <span className="font-mono font-semibold text-slate-700">
                      {formatWon(p.bdgCashAmt)}
                    </span>
                  </span>
                  <span className="text-slate-500">
                    지출{" "}
                    <span className="font-mono font-semibold text-slate-700">
                      {formatWon(p.epAmt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`font-mono font-bold ${rateColorClass(rate)}`}>
                      {formatRate(rate)}
                    </span>
                    {isOver && (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                        초과
                      </span>
                    )}
                    {isUnder && !isOver && (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                        저조
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            이전
          </button>
          <span className="text-xs text-slate-500 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
