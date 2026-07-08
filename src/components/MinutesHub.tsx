"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { Region, MinutesSummary } from "@/lib/types";
import CouncilMinutes from "./CouncilMinutes";
import KoreaMap from "./KoreaMap";
import { dataUrl } from "@/lib/utils";

interface Props {
  summaries: MinutesSummary[];
  regions: Region[];
}

// ── 13-c minutes-topics.json schema ─────────────────────────────────────────
interface MinutesTopics {
  global: {
    period: [string, string];
    topics: [string, number][];
    agendaTypes: [string, number][];
  };
  regions: Record<string, { topics: [string, number][] }>;
}

// ── Topic color palette (bg + text + ring color) ─────────────────────────────
const TOPIC_COLORS: Record<string, string> = {
  "청년":        "bg-sky-50 text-sky-700 ring-sky-200",
  "주거·주택":   "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "관광·축제":   "bg-orange-50 text-orange-700 ring-orange-200",
  "일자리·창업": "bg-teal-50 text-teal-700 ring-teal-200",
  "의료·돌봄":   "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "생활인구":    "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "귀농귀촌":    "bg-lime-50 text-lime-700 ring-lime-200",
  "교육":        "bg-violet-50 text-violet-700 ring-violet-200",
  "집행 문제":   "bg-rose-50 text-rose-700 ring-rose-200",
  "공모·평가":   "bg-slate-100 text-slate-600 ring-slate-200",
};

// Solid bar fill colors for the mini bar chart
const TOPIC_BAR_COLORS: Record<string, string> = {
  "청년":        "bg-sky-400",
  "주거·주택":   "bg-indigo-400",
  "관광·축제":   "bg-orange-400",
  "일자리·창업": "bg-teal-400",
  "의료·돌봄":   "bg-emerald-400",
  "생활인구":    "bg-cyan-400",
  "귀농귀촌":    "bg-lime-400",
  "교육":        "bg-violet-400",
  "집행 문제":   "bg-rose-400",
  "공모·평가":   "bg-slate-400",
};

function fmtDate(d: string): string {
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

// "20220207" → "2022.02"
function fmtPeriodYm(d: string): string {
  if (d.length !== 8) return d;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}`;
}

function isActive90(dateStr: string): boolean {
  if (!dateStr || dateStr.length !== 8) return false;
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(4, 6), 10) - 1;
  const d = parseInt(dateStr.slice(6, 8), 10);
  const date = new Date(y, m, d);
  return Date.now() - date.getTime() <= 90 * 86_400_000;
}

function isRecentDays(dateStr: string, days: number): boolean {
  if (!dateStr || dateStr.length !== 8) return false;
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(4, 6), 10) - 1;
  const d = parseInt(dateStr.slice(6, 8), 10);
  const date = new Date(y, m, d);
  return Date.now() - date.getTime() <= days * 86_400_000;
}

const TYPE_COLORS: Record<string, string> = {
  "감소": "bg-rose-50 text-rose-700 ring-rose-200",
  "관심": "bg-amber-50 text-amber-700 ring-amber-200",
};

type SortKey = "count" | "recent";

export default function MinutesHub({ summaries, regions }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidoFilter, setSidoFilter] = useState("전체");
  const [topicFilter, setTopicFilter] = useState("전체");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("count");
  const [topicsData, setTopicsData] = useState<MinutesTopics | null>(null);

  // ── Fetch minutes-topics.json once on mount (client only) ────────────────
  useEffect(() => {
    fetch(dataUrl("/data/minutes-topics.json"))
      .then((r) => (r.ok ? (r.json() as Promise<MinutesTopics>) : null))
      .then((d) => setTopicsData(d))
      .catch(() => {
        // File absent: topic UI silently omitted
      });
  }, []);

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

  // All topic labels from global data (preserves frequency order)
  const allTopics = useMemo<string[]>(() => {
    if (!topicsData) return [];
    return topicsData.global.topics.map(([name]) => name);
  }, [topicsData]);

  // ─── Summary strip stats ─────────────────────────────────────────────────

  const totalMentions = useMemo(
    () => summaries.reduce((acc, s) => acc + s.totalCount, 0),
    [summaries]
  );

  const topSummary = useMemo(() => {
    if (!summaries.length) return null;
    return summaries.reduce((best, s) =>
      s.totalCount > best.totalCount ? s : best
    );
  }, [summaries]);

  const recent30Count = useMemo(
    () => summaries.filter((s) => isRecentDays(s.latestDate, 30)).length,
    [summaries]
  );

  // ─── Sido bar chart ──────────────────────────────────────────────────────

  const sidoBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of summaries) {
      const key = s.regionId.split("-")[0];
      map.set(key, (map.get(key) ?? 0) + s.totalCount);
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const maxVal = sorted[0]?.[1] ?? 1;
    return sorted.map(([sido, count]) => ({
      sido,
      count,
      pct: (count / maxVal) * 100,
    }));
  }, [summaries]);

  // ─── Global topic top 6 for mini bar chart ───────────────────────────────

  const globalTopTopics = useMemo(() => {
    if (!topicsData) return [];
    const top6 = topicsData.global.topics.slice(0, 6);
    const maxCount = top6[0]?.[1] ?? 1;
    return top6.map(([name, count]) => ({
      name,
      count,
      pct: (count / maxCount) * 100,
    }));
  }, [topicsData]);

  const topAgendaTypes = useMemo<[string, number][]>(() => {
    if (!topicsData) return [];
    return topicsData.global.agendaTypes.slice(0, 3);
  }, [topicsData]);

  // ─── Filtered + sorted ranking list ──────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim();

    const base = summaries.filter((s) => {
      const r = regionMap.get(s.regionId);
      if (!r) return false;
      if (sidoFilter !== "전체" && r.sido !== sidoFilter) return false;
      if (q && !r.sigungu.includes(q) && !s.council.includes(q)) return false;
      if (topicFilter !== "전체" && topicsData) {
        const rt = topicsData.regions[s.regionId]?.topics ?? [];
        if (!rt.some(([name]) => name === topicFilter)) return false;
      }
      return true;
    });

    return base.sort((a, b) => {
      // When topic filter active: sort by that topic's mention count
      if (topicFilter !== "전체" && topicsData) {
        const topicCountOf = (s: MinutesSummary) => {
          const rt = topicsData.regions[s.regionId]?.topics ?? [];
          return rt.find(([name]) => name === topicFilter)?.[1] ?? 0;
        };
        const diff = topicCountOf(b) - topicCountOf(a);
        if (diff !== 0) return diff;
      }
      if (sortBy === "recent") {
        return (b.latestDate ?? "").localeCompare(a.latestDate ?? "");
      }
      return b.totalCount - a.totalCount;
    });
  }, [summaries, regionMap, sidoFilter, topicFilter, search, sortBy, topicsData]);

  const selectedRegion = selectedId ? regionMap.get(selectedId) : null;

  const topRegion = topSummary ? regionMap.get(topSummary.regionId) : null;
  const topDisplayName = topRegion
    ? `${topRegion.sigungu}의회`
    : (topSummary?.council ?? "");

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero: Heatmap + Stats ─────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        {/* Left: Korea map */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
            논의 히트맵 — 지역 클릭으로 회의록 열기
          </p>
          <KoreaMap
            regions={regions}
            defaultMetric="minutes"
            hideSwitcher
            onRegionClick={(id) =>
              setSelectedId((prev) => (prev === id ? null : id))
            }
          />
        </div>

        {/* Right: Summary strip + Sido bars + National topic profile */}
        <div className="flex flex-col gap-4">
          {/* Summary strip */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              전체 현황
            </p>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-slate-500">총 언급</span>
                <span className="text-xl font-bold text-[#0B4171] tabular-nums">
                  {totalMentions.toLocaleString("ko-KR")}건
                </span>
              </div>

              {topSummary && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-500 shrink-0">최다 의회</span>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs font-semibold text-slate-800 text-right leading-tight">
                      {topDisplayName}
                    </span>
                    <span className="text-xs font-bold text-rose-600 tabular-nums">
                      {topSummary.totalCount.toLocaleString("ko-KR")}건
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-slate-500">최근 30일 논의</span>
                <span className="text-base font-bold text-emerald-600 tabular-nums">
                  {recent30Count}곳
                </span>
              </div>
            </div>

            {/* Heat legend */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-slate-400">적음</span>
              <div
                className="flex-1 h-2 rounded"
                style={{
                  background:
                    "linear-gradient(to right, rgb(253,230,138), rgb(225,29,72))",
                }}
              />
              <span className="text-[10px] text-slate-400">많음</span>
            </div>
          </div>

          {/* Sido bar chart */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              시도별 논의 합계
            </p>
            <div className="flex flex-col gap-1.5">
              {sidoBars.map(({ sido, count, pct }) => (
                <div key={sido} className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 w-6 shrink-0 tabular-nums">
                    {sido}
                  </span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
                      style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 w-14 text-right shrink-0 tabular-nums">
                    {count.toLocaleString("ko-KR")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 전국 논의 프로필 카드 (13-c global) ─────────────────────── */}
          {topicsData && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                전국 논의 프로필
              </p>

              <p className="text-[11px] text-slate-500">
                논의 기간{" "}
                <span className="font-semibold text-slate-700">
                  {fmtPeriodYm(topicsData.global.period[0])} ~{" "}
                  {fmtPeriodYm(topicsData.global.period[1])}
                </span>
              </p>

              {/* Top 6 topics mini bar */}
              <div className="flex flex-col gap-1.5">
                {globalTopTopics.map(({ name, count, pct }) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-600 w-16 shrink-0 truncate">
                      {name}
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${TOPIC_BAR_COLORS[name] ?? "bg-slate-400"}`}
                        style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 w-6 text-right shrink-0 tabular-nums">
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              {/* Top 3 agenda types */}
              {topAgendaTypes.length > 0 && (
                <div className="border-t border-slate-100 pt-2 flex flex-col gap-1">
                  <p className="text-[10px] text-slate-400 mb-0.5">주요 안건 유형</p>
                  {topAgendaTypes.map(([name, count]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-[11px] text-slate-600 truncate">
                        {name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                        {count.toLocaleString("ko-KR")}건
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-slate-400 leading-tight">
                발언·안건 텍스트 규칙 분류 기준
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter row ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Sido filter */}
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

        {/* Topic filter bar */}
        {allTopics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] font-medium text-slate-400 shrink-0 mr-0.5">
              주제
            </span>
            <button
              onClick={() => setTopicFilter("전체")}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 transition-colors ${
                topicFilter === "전체"
                  ? "bg-slate-700 text-white ring-slate-700"
                  : "bg-white text-slate-500 ring-slate-200 hover:text-slate-800 hover:ring-slate-300"
              }`}
            >
              전체
            </button>
            {allTopics.map((topic) => {
              const colorCls =
                TOPIC_COLORS[topic] ?? "bg-slate-50 text-slate-600 ring-slate-200";
              const isActive = topicFilter === topic;
              return (
                <button
                  key={topic}
                  onClick={() => setTopicFilter(isActive ? "전체" : topic)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 transition-all ${colorCls} ${
                    isActive
                      ? "ring-2 font-semibold"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  {topic}
                </button>
              );
            })}
          </div>
        )}

        {/* Search + sort */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="시군구명 또는 의회명 검색..."
            className="w-full sm:w-72 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 shrink-0">정렬</span>
            {(["count", "recent"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                  sortBy === key
                    ? "bg-[#0B4171] text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                }`}
              >
                {key === "count" ? "언급 많은 순" : "최근 논의 순"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main area: ranking grid + detail panel ────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Ranking grid */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 mb-3">
            {filtered.length}개 의회 ·{" "}
            {topicFilter !== "전체"
              ? `"${topicFilter}" 논의 지역, 건수 내림차순`
              : sortBy === "count"
              ? "언급 건수 내림차순"
              : "최근 논의 순"}
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
                const active = isActive90(s.latestDate);
                const regionTopTopics =
                  topicsData?.regions[s.regionId]?.topics.slice(0, 2) ?? [];

                return (
                  <button
                    key={s.regionId}
                    onClick={() =>
                      setSelectedId(isSelected ? null : s.regionId)
                    }
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
                        <span className="text-[11px] text-slate-400">
                          {r.sido}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${
                            TYPE_COLORS[r.type] ??
                            "bg-slate-50 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {r.type}
                        </span>
                        {active && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                            최근 활발
                          </span>
                        )}
                      </div>
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

                    {/* Topic chips — top 2 */}
                    {regionTopTopics.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {regionTopTopics.map(([name]) => (
                          <span
                            key={name}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 ${
                              TOPIC_COLORS[name] ??
                              "bg-slate-50 text-slate-500 ring-slate-200"
                            }`}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
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
                  <span className="text-xs text-slate-400">
                    {selectedRegion.sido}
                  </span>
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

              {/* Region topic chips — up to 5, with mention count */}
              {topicsData &&
                (() => {
                  const regionTopics =
                    topicsData.regions[selectedId]?.topics.slice(0, 5) ?? [];
                  if (regionTopics.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {regionTopics.map(([name, count]) => (
                        <span
                          key={name}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${
                            TOPIC_COLORS[name] ??
                            "bg-slate-50 text-slate-500 ring-slate-200"
                          }`}
                        >
                          {name}
                          <span className="opacity-50 tabular-nums">{count}</span>
                        </span>
                      ))}
                    </div>
                  );
                })()}

              <CouncilMinutes regionId={selectedId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
