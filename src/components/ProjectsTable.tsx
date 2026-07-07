"use client";

import { useState, useEffect, useMemo } from "react";
import type { RegionProjects, Project, FundRelatedFilter } from "@/lib/types";
import { formatWon, executionRate, formatRate, rateColorClass, dataUrl } from "@/lib/utils";
import SimilarProjectsDrawer from "./SimilarProjectsDrawer";

const FUND_LABELS: Record<string, string> = {
  confirmed: "확정",
  candidate: "후보",
  excluded: "제외",
};

const FUND_BADGE: Record<string, string> = {
  confirmed: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  candidate: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  excluded: "bg-stone-100 text-stone-500 ring-1 ring-stone-200",
};

type SortCol = "bdgCashAmt" | "epAmt" | "rate";
type SortDir = "asc" | "desc";

interface Props {
  lafCd: string;
  /** Display name of the current region, shown in the drawer header */
  regionName?: string;
  /** lafCd → "시도 시군구" map for resolving similar-project region names */
  lafCdToName?: Record<string, string>;
}

export default function ProjectsTable({ lafCd, regionName, lafCdToName }: Props) {
  const [data, setData] = useState<RegionProjects | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [fundFilter, setFundFilter] = useState<FundRelatedFilter>("all");
  const [sortCol, setSortCol] = useState<SortCol>("bdgCashAmt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const PAGE_SIZE = 50;

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(dataUrl(`/data/projects/${lafCd}.json`))
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json() as Promise<RegionProjects>;
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [lafCd]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list: Project[] = data.projects;

    if (fundFilter !== "all") {
      list = list.filter((p) => p.fundRelated === fundFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.dbizNm.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
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

    return list;
  }, [data, search, fundFilter, sortCol, sortDir]);

  // Reset to first page whenever the visible list changes
  useEffect(() => {
    setPage(1);
  }, [search, fundFilter, sortCol, sortDir, lafCd]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  function Pagination() {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          이전
        </button>
        <span className="text-xs text-stone-500 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 bg-white text-stone-600 hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          다음
        </button>
      </div>
    );
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function SortIndicator({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="text-stone-300 ml-1">↕</span>;
    return (
      <span className="text-blue-600 ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>
    );
  }

  const drawerRegionName = regionName ?? lafCd;
  const drawerLafCdToName = lafCdToName ?? {};

  if (loading) {
    return (
      <div className="py-12 text-center text-stone-400 text-sm">
        세부사업 데이터를 불러오는 중...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-stone-400 text-sm">
          세부사업 데이터를 준비 중입니다.
        </p>
        <p className="text-stone-300 text-xs mt-1">
          파이프라인 실행 후 public/data/projects/{lafCd}.json 생성 시 자동으로 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="사업명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[160px] max-w-xs px-3 py-1.5 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-stone-400"
          />
          <div className="flex gap-1.5">
            {(["all", "confirmed", "candidate"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFundFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  fundFilter === f
                    ? "bg-stone-900 text-white"
                    : "bg-white text-stone-600 border border-stone-200 hover:border-stone-300"
                }`}
              >
                {f === "all" ? "전체" : FUND_LABELS[f]}
              </button>
            ))}
          </div>
          <span className="text-xs text-stone-400 ml-auto">
            {filtered.length.toLocaleString()}건
          </span>
        </div>

        <p className="text-xs text-stone-400">행을 클릭하면 다른 지역 동일 사업을 비교할 수 있습니다.</p>

        {/* Table — desktop */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">
                  사업명
                </th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">
                  분야
                </th>
                <th className="px-4 py-3 text-left font-semibold text-stone-600 text-xs">
                  기금
                </th>
                <th
                  className="px-4 py-3 text-right font-semibold text-stone-600 text-xs cursor-pointer hover:text-stone-900"
                  onClick={() => toggleSort("bdgCashAmt")}
                >
                  예산현액 <SortIndicator col="bdgCashAmt" />
                </th>
                <th
                  className="px-4 py-3 text-right font-semibold text-stone-600 text-xs cursor-pointer hover:text-stone-900"
                  onClick={() => toggleSort("epAmt")}
                >
                  지출액 <SortIndicator col="epAmt" />
                </th>
                <th
                  className="px-4 py-3 text-right font-semibold text-stone-600 text-xs cursor-pointer hover:text-stone-900"
                  onClick={() => toggleSort("rate")}
                >
                  집행률 <SortIndicator col="rate" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-stone-400 text-sm">
                    조건에 맞는 사업이 없습니다
                  </td>
                </tr>
              ) : (
                paged.map((p) => {
                  const rate = executionRate(p.epAmt, p.bdgCashAmt);
                  const isSelected = selectedProject?.dbizCd === p.dbizCd && selectedProject?.acntDvNm === p.acntDvNm;
                  return (
                    <tr
                      key={`${p.dbizCd}|${p.acntDvNm}`}
                      onClick={() => setSelectedProject(isSelected ? null : p)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50 ring-2 ring-inset ring-blue-300"
                          : "hover:bg-stone-50/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-stone-800 font-medium max-w-[240px]">
                        <span className="line-clamp-2">{p.dbizNm}</span>
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                        {p.fldNm}
                      </td>
                      <td className="px-4 py-3">
                        {p.fundRelated && p.fundRelated !== "excluded" && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${FUND_BADGE[p.fundRelated]}`}
                          >
                            {FUND_LABELS[p.fundRelated]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-stone-700 text-xs tabular-nums">
                        {formatWon(p.bdgCashAmt)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-stone-700 text-xs tabular-nums">
                        {formatWon(p.epAmt)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums ${rateColorClass(rate)}`}>
                        {formatRate(rate)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Cards — mobile */}
        <div className="md:hidden flex flex-col gap-2">
          {filtered.length === 0 ? (
            <p className="text-center text-stone-400 text-sm py-8">
              조건에 맞는 사업이 없습니다
            </p>
          ) : (
            paged.map((p) => {
              const rate = executionRate(p.epAmt, p.bdgCashAmt);
              const isSelected = selectedProject?.dbizCd === p.dbizCd && selectedProject?.acntDvNm === p.acntDvNm;
              return (
                <div
                  key={`${p.dbizCd}|${p.acntDvNm}`}
                  onClick={() => setSelectedProject(isSelected ? null : p)}
                  className={`border rounded-xl p-4 flex flex-col gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 border-blue-300"
                      : "bg-white border-stone-200 active:bg-stone-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-stone-800 leading-snug">
                      {p.dbizNm}
                    </span>
                    {p.fundRelated && p.fundRelated !== "excluded" && (
                      <span
                        className={`inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${FUND_BADGE[p.fundRelated]}`}
                      >
                        {FUND_LABELS[p.fundRelated]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-stone-500">
                    <span>{p.fldNm}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500">
                      예산 <span className="font-mono font-semibold text-stone-700">{formatWon(p.bdgCashAmt)}</span>
                    </span>
                    <span className="text-stone-500">
                      지출 <span className="font-mono font-semibold text-stone-700">{formatWon(p.epAmt)}</span>
                    </span>
                    <span className={`font-mono font-bold ${rateColorClass(rate)}`}>
                      {formatRate(rate)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Pagination />
      </div>

      {/* Similar projects drawer — rendered outside the table div so fixed positioning works correctly */}
      <SimilarProjectsDrawer
        project={selectedProject}
        regionName={drawerRegionName}
        lafCd={lafCd}
        lafCdToName={drawerLafCdToName}
        onClose={() => setSelectedProject(null)}
      />
    </>
  );
}
