"use client";

import { useState, useEffect, useMemo } from "react";
import type { AgePyramid } from "@/lib/types";
import { dataUrl } from "@/lib/utils";

interface Props {
  regionId: string;
}

function fmtNum(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function AgePyramidChart({ regionId }: Props) {
  const [data, setData] = useState<AgePyramid | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    fetch(dataUrl("/data/age-pyramid.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AgePyramid | null) => setData(d ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const regionData = useMemo(() => {
    if (!data) return null;
    return data.series[regionId] ?? null;
  }, [data, regionId]);

  // youth=0-19(idx 0,1), working=20-59(idx 2-5), old=60+(idx 6-10)
  const stats = useMemo(() => {
    if (!data || !regionData) return null;
    const { male, female } = regionData;
    let youth = 0, working = 0, old = 0, total = 0;
    for (let i = 0; i < data.buckets.length; i++) {
      const n = (male[i] ?? 0) + (female[i] ?? 0);
      total += n;
      if (i <= 1) youth += n;
      else if (i <= 5) working += n;
      else old += n;
    }
    if (total === 0) return null;
    return {
      youthPct: (youth / total) * 100,
      workingPct: (working / total) * 100,
      oldPct: (old / total) * 100,
      total,
    };
  }, [data, regionData]);

  const maxVal = useMemo(() => {
    if (!regionData) return 1;
    return Math.max(...regionData.male, ...regionData.female, 1);
  }, [regionData]);

  // Render from top (100+) to bottom (0-9)
  const reversedIndices = useMemo(() => {
    if (!data) return [];
    return data.buckets.map((_, i) => i).reverse();
  }, [data]);

  const statsYmLabel = useMemo(() => {
    if (!data) return "";
    const ym = data.statsYm;
    return `${ym.slice(0, 4)}.${ym.slice(4, 6)} 주민등록`;
  }, [data]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-8 text-center">
        <p className="text-sm text-slate-400">데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!data || !regionData || !stats) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] border border-dashed border-slate-200 p-8 flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
          준비 중
        </span>
        <p className="text-sm text-slate-500 max-w-sm">
          인구 구조 데이터를 준비 중입니다. 파이프라인 실행 후 자동으로
          표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-2.5 flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            유소년 (0–19세)
          </span>
          <span className="font-mono text-sm font-semibold text-slate-800 tabular-nums">
            {stats.youthPct.toFixed(1)}%
          </span>
        </div>
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-2.5 flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            생산가능 (20–59세)
          </span>
          <span className="font-mono text-sm font-semibold text-slate-800 tabular-nums">
            {stats.workingPct.toFixed(1)}%
          </span>
        </div>
        <div
          className={`rounded-xl border px-4 py-2.5 flex flex-col gap-0.5 ${
            stats.oldPct > 40
              ? "bg-rose-50 border-rose-200"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <span
            className={`text-[10px] font-medium uppercase tracking-wide ${
              stats.oldPct > 40 ? "text-rose-400" : "text-slate-400"
            }`}
          >
            고령 (60세 이상)
          </span>
          <span
            className={`font-mono text-sm font-semibold tabular-nums ${
              stats.oldPct > 40 ? "text-rose-700" : "text-slate-800"
            }`}
          >
            {stats.oldPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Pyramid */}
      <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-6">
        {/* Legend + date label */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded-sm bg-blue-500" />
              남성
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded-sm bg-rose-400" />
              여성
            </span>
          </div>
          <span className="text-[11px] text-slate-400">{statsYmLabel}</span>
        </div>

        {/* Bar rows */}
        <div className="flex flex-col gap-px">
          {reversedIndices.map((bucketIdx) => {
            const bucket = data.buckets[bucketIdx];
            const maleVal = regionData.male[bucketIdx] ?? 0;
            const femaleVal = regionData.female[bucketIdx] ?? 0;
            const malePct = (maleVal / maxVal) * 100;
            const femalePct = (femaleVal / maxVal) * 100;
            const isHovered = hovered === bucketIdx;

            return (
              <div
                key={bucket}
                className="flex items-center"
                onMouseEnter={() => setHovered(bucketIdx)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Male side — bar grows toward center (right-to-left) */}
                <div className="flex-1 flex justify-end items-center pr-1 relative min-w-0">
                  {isHovered && (
                    <span className="absolute left-0 text-[10px] font-mono text-blue-600 font-semibold whitespace-nowrap bg-white z-10 pr-1">
                      {fmtNum(maleVal)}명
                    </span>
                  )}
                  <div
                    className="h-5 rounded-l-sm bg-blue-500 transition-all duration-150 shrink-0"
                    style={{ width: `${malePct}%` }}
                  />
                </div>

                {/* Center age label */}
                <div className="w-14 shrink-0 text-center">
                  <span
                    className={`text-[10px] font-medium transition-colors ${
                      isHovered ? "text-slate-700 font-semibold" : "text-slate-400"
                    }`}
                  >
                    {bucket}
                  </span>
                </div>

                {/* Female side — bar grows from center left-to-right */}
                <div className="flex-1 flex justify-start items-center pl-1 relative min-w-0">
                  <div
                    className="h-5 rounded-r-sm bg-rose-400 transition-all duration-150 shrink-0"
                    style={{ width: `${femalePct}%` }}
                  />
                  {isHovered && (
                    <span className="absolute right-0 text-[10px] font-mono text-rose-600 font-semibold whitespace-nowrap bg-white z-10 pl-1">
                      {fmtNum(femaleVal)}명
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
          행정안전부 행정동별 성·연령별 주민등록 인구 (10세 단위). 총인구{" "}
          {fmtNum(stats.total)}명 기준.
        </p>
      </div>
    </div>
  );
}
