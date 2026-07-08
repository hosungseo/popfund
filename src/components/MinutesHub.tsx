"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Region, MinutesSummary } from "@/lib/types";
import CouncilMinutes from "./CouncilMinutes";

interface Props {
  summaries: MinutesSummary[];
  regions: Region[];
}

function fmtDate(d: string): string {
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

const TYPE_COLORS: Record<string, string> = {
  "감소": "bg-rose-50 text-rose-700 ring-rose-200",
  "관심": "bg-amber-50 text-amber-700 ring-amber-200",
};

export default function MinutesHub({ summaries, regions }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidoFilter, setSidoFilter] = useState("전체");
  const [search, setSearch] = useState("");

  const regionMap = useMemo(
    () => new Map(regions.map((r) => [r.id, r])),
    [regions]
  );

  const sidos = useMemo(() => {
    const set = new Set<string>();
    for (const s of summaries) {
      const r = regionMap.get(s.regionId);
      if (r) set.add(r.sido);
    }
    return ["전체", ...Array.from(set).sort()];
  }, [summaries, regionMap]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return summaries
      .filter((s) => {
        const r = regionMap.get(s.regionId);
        if (!r) return false;
        if (sidoFilter !== "전체" && r.sido !== sidoFilter) return false;
        if (q) return r.sigungu.includes(q) || s.council.includes(q);
        return true;
      })
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [summaries, regionMap, sidoFilter, search]);

  const selectedRegion = selectedId ? regionMap.get(selectedId) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Filter row */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {sidos.map((sido) => (
            <button
              key={sido}
              onClick={() => setSidoFilter(sido)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                sidoFilter === sido
                  ? "bg-[#0B4171] text-white"
                  : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-800 hover:ring-slate-300"
              }`}
            >
              {sido}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="시군구명 또는 의회명 검색..."
          className="w-full sm:w-80 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* Main area: ranking grid + detail panel */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Ranking grid */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 mb-3">
            {filtered.length}개 의회 · 언급 건수 내림차순
          </p>
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-400">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {filtered.map((s, i) => {
                const r = regionMap.get(s.regionId);
                if (!r) return null;
                const isSelected = selectedId === s.regionId;
                return (
                  <button
                    key={s.regionId}
                    onClick={() => setSelectedId(isSelected ? null : s.regionId)}
                    className={`text-left rounded-xl border p-4 flex flex-col gap-2 transition-all ${
                      isSelected
                        ? "border-[#0B4171] bg-[#E8EFF6] ring-1 ring-[#0B4171]/30"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                          #{i + 1}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 leading-snug">
                          {r.sigungu}
                        </span>
                        <span className="text-[11px] text-slate-400">{r.sido}</span>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${TYPE_COLORS[r.type] ?? "bg-slate-50 text-slate-600 ring-slate-200"}`}
                      >
                        {r.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 ring-1 ring-sky-200">
                        언급 {s.totalCount.toLocaleString("ko-KR")}건
                      </span>
                      {s.latestDate && (
                        <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {fmtDate(s.latestDate)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedRegion && selectedId && (
          <div className="w-full lg:w-[420px] xl:w-[480px] shrink-0">
            <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-800">
                    {selectedRegion.sigungu}
                  </h3>
                  <span className="text-xs text-slate-400">{selectedRegion.sido}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/region/${encodeURIComponent(selectedId)}#council`}
                    className="text-xs text-slate-400 hover:text-slate-700 transition-colors whitespace-nowrap"
                  >
                    지역 상세 →
                  </Link>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                    aria-label="패널 닫기"
                  >
                    ×
                  </button>
                </div>
              </div>
              <CouncilMinutes regionId={selectedId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
