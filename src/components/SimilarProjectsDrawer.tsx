"use client";

import { useState, useEffect } from "react";
import type { Project, ClusterEntry } from "@/lib/types";
import { normName, shardOf, formatWon, executionRate, formatRate, rateColorClass } from "@/lib/utils";

interface Props {
  project: Project | null;
  regionName: string;
  lafCd: string;
  lafCdToName: Record<string, string>;
  onClose: () => void;
}

export default function SimilarProjectsDrawer({
  project,
  regionName,
  lafCd,
  lafCdToName,
  onClose,
}: Props) {
  const [cluster, setCluster] = useState<ClusterEntry[] | null>(null);
  const [clusterLoading, setClusterLoading] = useState(false);

  useEffect(() => {
    if (!project) {
      setCluster(null);
      return;
    }
    const norm = normName(project.dbizNm);
    const shard = shardOf(norm);
    setClusterLoading(true);
    // 빠르게 다른 사업을 연달아 열면 늦게 도착한 이전 응답이 덮어쓰지 않도록 취소 플래그 사용
    let cancelled = false;
    fetch(`/data/similar/${shard}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Record<string, ClusterEntry[]> | null) => {
        if (cancelled) return;
        setCluster(data ? (data[norm] ?? []) : []);
      })
      .catch(() => {
        if (!cancelled) setCluster([]);
      })
      .finally(() => {
        if (!cancelled) setClusterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project]);

  const others = (cluster ?? [])
    .filter((e) => e.lafCd !== lafCd)
    .sort((a, b) => b.bdgCashAmt - a.bdgCashAmt);

  const isOpen = !!project;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer panel — bottom sheet (mobile) / right slide (desktop) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="유사사업 비교"
        className={[
          "fixed z-50 bg-white shadow-2xl flex flex-col",
          "transition-transform duration-300 ease-out",
          // Mobile: anchored to bottom, full width
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl",
          // Desktop: anchored to right, full height
          "md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:max-h-none md:h-full md:rounded-none md:border-l md:border-stone-200",
          // Transform states
          isOpen
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-x-full md:translate-y-0",
        ].join(" ")}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Header — always visible even when project is null so animation looks clean */}
        {project && (
          <>
            <div className="shrink-0 border-b border-stone-100 px-5 py-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-stone-500 mb-0.5">{regionName}</p>
                <h2 className="text-sm font-semibold text-stone-900 leading-snug line-clamp-2">
                  {project.dbizNm}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="닫기"
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
              {/* ---- Section 1: Project details ---- */}
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
                  사업 정보
                </h3>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {(
                    [
                      ["회계", project.acntDvNm],
                      ["분야", project.fldNm],
                      ["부문", project.partNm],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div key={label} className="bg-stone-50 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] text-stone-400 mb-0.5">{label}</p>
                      <p className="text-xs font-medium text-stone-700 break-words">
                        {value || "—"}
                      </p>
                    </div>
                  ))}
                </div>

                {/* 재원구성 */}
                <div className="bg-stone-50 rounded-lg px-3 py-2.5 mb-3">
                  <p className="text-[10px] text-stone-400 mb-2">재원구성</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        ["국비", project.bdgNtep],
                        ["시도비", project.capep],
                        ["시군구비", project.sggep],
                        ["기타", project.etcAmt],
                      ] as [string, number][]
                    ).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[9px] text-stone-400">{label}</p>
                        <p className="font-mono text-[11px] text-stone-700 tabular-nums">
                          {formatWon(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 예산·집행 */}
                {(() => {
                  const rate = executionRate(project.epAmt, project.bdgCashAmt);
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          label: "예산현액",
                          value: formatWon(project.bdgCashAmt),
                          color: "text-stone-800",
                        },
                        {
                          label: "지출액",
                          value: formatWon(project.epAmt),
                          color: "text-stone-800",
                        },
                        {
                          label: "집행률",
                          value: formatRate(rate),
                          color: rateColorClass(rate),
                        },
                      ].map(({ label, value, color }) => (
                        <div
                          key={label}
                          className="bg-white border border-stone-200 rounded-lg px-3 py-2.5"
                        >
                          <p className="text-[10px] text-stone-400 mb-0.5">{label}</p>
                          <p
                            className={`font-mono text-sm font-bold tabular-nums ${color}`}
                          >
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </section>

              {/* ---- Section 2: Similar projects in other regions ---- */}
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
                  다른 지역 동일 사업
                </h3>

                {clusterLoading ? (
                  <p className="text-sm text-stone-400 text-center py-8">로딩 중...</p>
                ) : others.length === 0 ? (
                  <div className="rounded-xl bg-stone-50 border border-dashed border-stone-200 px-5 py-8 text-center">
                    <p className="text-sm text-stone-400">
                      다른 지역에서 동일 명칭 사업을 찾지 못했습니다
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-stone-200 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200">
                          <th className="px-3 py-2 text-left font-semibold text-stone-500">
                            지역
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-stone-500">
                            예산
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-stone-500">
                            지출
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-stone-500">
                            집행률
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {/* Current region highlighted */}
                        <tr className="bg-blue-50/60">
                          <td className="px-3 py-2.5 font-semibold text-blue-800 whitespace-nowrap">
                            {regionName}
                            <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-normal bg-blue-100 text-blue-600">
                              현재
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-stone-700">
                            {formatWon(project.bdgCashAmt)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-stone-700">
                            {formatWon(project.epAmt)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${rateColorClass(
                              executionRate(project.epAmt, project.bdgCashAmt)
                            )}`}
                          >
                            {formatRate(
                              executionRate(project.epAmt, project.bdgCashAmt)
                            )}
                          </td>
                        </tr>

                        {others.map((e) => {
                          const rate = executionRate(e.epAmt, e.bdgCashAmt);
                          const name = lafCdToName[e.lafCd] ?? e.lafCd;
                          return (
                            <tr
                              key={e.lafCd}
                              className="hover:bg-stone-50/50 transition-colors"
                            >
                              <td className="px-3 py-2.5 text-stone-700 whitespace-nowrap">
                                {name}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-stone-600">
                                {formatWon(e.bdgCashAmt)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-stone-600">
                                {formatWon(e.epAmt)}
                              </td>
                              <td
                                className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${rateColorClass(rate)}`}
                              >
                                {formatRate(rate)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}
