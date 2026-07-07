"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { geoMercator, geoPath } from "d3-geo";
import { scaleSequential } from "d3-scale";
import type { Region, Lifepop, VitalTrend, PopulationTrend, DeclineType } from "@/lib/types";
import RegionBadge from "./RegionBadge";
import { latestFund, formatWon, formatNumber, computeDeclineType } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MapMetric =
  | "type"
  | "perCapita"
  | "agingIndex"
  | "fund2026"
  | "stayRatio"
  | "declineType";

interface SigunguProps {
  code: string;
  name: string;
  sido: string;
  regionId?: string;
}

interface GeoFeature {
  type: "Feature";
  properties: SigunguProps;
  geometry: object;
}

interface GeoData {
  type: "FeatureCollection";
  features: GeoFeature[];
}

interface TooltipState {
  x: number;
  y: number;
  name: string;
  sido: string;
  region?: Region;
}

export interface KoreaMapProps {
  regions: Region[];
  /** regionId of the polygon to highlight (mini mode) */
  highlightId?: string;
  /** Compact display — no switcher, no legend, no interaction */
  mini?: boolean;
}

// ─── Color ramps ─────────────────────────────────────────────────────────────
// Each ramp: start (light) → end (dark) in RGB

const RAMPS: Record<string, [[number, number, number], [number, number, number]]> = {
  perCapita:  [[219, 234, 254], [29,  78, 216]],   // blue-200  → blue-700
  agingIndex: [[237, 233, 254], [109, 40, 217]],   // violet-200 → violet-700
  fund2026:   [[167, 243, 208], [21,  128,  61]],  // emerald-200 → green-700
  stayRatio:  [[204, 251, 241], [15,  118, 110]],  // teal-100 → teal-700
};

// ─── Decline type categorical colors ─────────────────────────────────────────

const DECLINE_TYPE_COLORS: Record<DeclineType, string> = {
  "이중감소형":     "#e11d48", // rose-600
  "자연감소주도형": "#f59e0b", // amber-500
  "유출주도형":     "#8b5cf6", // violet-500
  "회복형":         "#10b981", // emerald-500
};

const DECLINE_TYPES: [DeclineType, string][] = [
  ["이중감소형",     "#e11d48"],
  ["자연감소주도형", "#f59e0b"],
  ["유출주도형",     "#8b5cf6"],
  ["회복형",         "#10b981"],
];

function lerp(t: number, a: number, b: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

function makeInterpolator(metric: MapMetric) {
  const r = RAMPS[metric];
  if (!r) return (_t: number) => "#e7e5e4";
  return (t: number) =>
    `rgb(${lerp(t, r[0][0], r[1][0])},${lerp(t, r[0][1], r[1][1])},${lerp(t, r[0][2], r[1][2])})`;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getMetricValue(region: Region, metric: MapMetric): number {
  switch (metric) {
    case "perCapita": {
      const pop = region.population?.total ?? 0;
      return pop > 0 ? latestFund(region.fund) / pop : 0;
    }
    case "agingIndex":
      return region.population?.agingIndex ?? 0;
    case "fund2026":
      return region.fund["2026"] ?? 0;
    default:
      return 0;
  }
}

function formatMetricValue(metric: MapMetric, value: number): string {
  switch (metric) {
    case "perCapita":
      return `${formatWon(Math.round(value))}/인`;
    case "agingIndex":
      return value.toFixed(1);
    case "fund2026":
      return formatWon(value);
    default:
      return "";
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SVG_W = 600;
const SVG_H = 740;

const METRICS: [MapMetric, string][] = [
  ["type",        "유형"],
  ["perCapita",   "1인당 기금"],
  ["agingIndex",  "노령화지수"],
  ["fund2026",    "2026년 기금"],
  ["stayRatio",   "체류 배율"],
  ["declineType", "감소 유형"],
];

const FILL_UNDESIGNATED = "#e7e5e4"; // stone-200
const FILL_NO_DATA      = "#f5f5f4"; // stone-100

// ─── Lifepop map entry ────────────────────────────────────────────────────────

interface LifepopEntry {
  stayRatio: number;
  lastRegistered?: number;
  lastStaying?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KoreaMap({ regions, highlightId, mini = false }: KoreaMapProps) {
  const router = useRouter();
  const [geoData,     setGeoData]     = useState<GeoData | null>(null);
  const [metric,      setMetric]      = useState<MapMetric>("type");
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [tooltip,     setTooltip]     = useState<TooltipState | null>(null);

  // Lazy-fetched data for v2 metrics
  const [lifepopData,    setLifepopData]    = useState<Lifepop | null>(null);
  const [lifepopFetched, setLifepopFetched] = useState(false);
  const [vitalTrend,     setVitalTrend]     = useState<VitalTrend | null>(null);
  const [popTrend,       setPopTrend]       = useState<PopulationTrend | null>(null);
  const [vitalPopFetched, setVitalPopFetched] = useState(false);

  const [geoError, setGeoError] = useState(false);

  // Fetch GeoJSON once on mount (client-side, ~366 KB)
  useEffect(() => {
    fetch("/data/korea-sigungu.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: GeoData) => setGeoData(d))
      .catch(() => setGeoError(true));
  }, []);

  // Lazy fetch lifepop when "stayRatio" first selected
  useEffect(() => {
    if (metric !== "stayRatio" || lifepopFetched) return;
    setLifepopFetched(true);
    fetch("/data/lifepop.json")
      .then((r) => (r.ok ? (r.json() as Promise<Lifepop>) : Promise.resolve(null)))
      .then((d) => setLifepopData(d ?? null))
      .catch(() => {});
  }, [metric, lifepopFetched]);

  // Lazy fetch vital-trend + population-trend when "declineType" first selected
  useEffect(() => {
    if (metric !== "declineType" || vitalPopFetched) return;
    setVitalPopFetched(true);
    Promise.all([
      fetch("/data/vital-trend.json")
        .then((r) => (r.ok ? (r.json() as Promise<VitalTrend>) : Promise.resolve(null)))
        .catch(() => null as VitalTrend | null),
      fetch("/data/population-trend.json")
        .then((r) => (r.ok ? (r.json() as Promise<PopulationTrend>) : Promise.resolve(null)))
        .catch(() => null as PopulationTrend | null),
    ]).then(([vit, pop]) => {
      setVitalTrend(vit);
      setPopTrend(pop);
    });
  }, [metric, vitalPopFetched]);

  // regionId → Region lookup map
  const regionMap = useMemo(() => {
    const m = new Map<string, Region>();
    regions.forEach((r) => m.set(r.id, r));
    return m;
  }, [regions]);

  // regionId → LifepopEntry (built from lifepopData)
  const lifepopMap = useMemo((): Map<string, LifepopEntry> => {
    const m = new Map<string, LifepopEntry>();
    if (!lifepopData) return m;
    const lastYm = lifepopData.months[lifepopData.months.length - 1];
    for (const [id, series] of Object.entries(lifepopData.series)) {
      if (series.stayRatio == null) continue;
      const lastM = series.monthly[lastYm] ?? {};
      m.set(id, {
        stayRatio: series.stayRatio,
        lastRegistered: lastM.registered,
        lastStaying: lastM.staying,
      });
    }
    return m;
  }, [lifepopData]);

  // regionId → DeclineType (computed from vitalTrend + popTrend)
  const declineTypeMap = useMemo((): Map<string, DeclineType> => {
    const m = new Map<string, DeclineType>();
    if (!vitalTrend || !popTrend) return m;
    for (const region of regions) {
      const dt = computeDeclineType(region.id, vitalTrend, popTrend);
      if (dt) m.set(region.id, dt);
    }
    return m;
  }, [vitalTrend, popTrend, regions]);

  // Domain [min, max] for the active sequential metric
  const [metricMin, metricMax] = useMemo((): [number, number] => {
    if (metric === "type" || metric === "declineType") return [0, 1];
    if (metric === "stayRatio") {
      const vals = [...lifepopMap.values()].map((e) => e.stayRatio).filter((v) => v > 0);
      if (!vals.length) return [0, 1];
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      return [min, max > min ? max : min + 1];
    }
    const vals = regions
      .map((r) => getMetricValue(r, metric))
      .filter((v) => v > 0);
    if (!vals.length) return [0, 1];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return [min, max > min ? max : min + 1];
  }, [regions, metric, lifepopMap]);

  // d3-scale sequential color scale (not used for categorical metrics)
  const colorScale = useMemo(() => {
    if (metric === "type" || metric === "declineType") return null;
    return scaleSequential(makeInterpolator(metric)).domain([metricMin, metricMax]);
  }, [metric, metricMin, metricMax]);

  // d3-geo path generator (recomputed when GeoJSON loads)
  const pathFn = useMemo(() => {
    if (!geoData) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = geoMercator().fitSize([SVG_W, SVG_H], geoData as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return geoPath(proj as any);
  }, [geoData]);

  // Fill color for a feature
  function getFill(feature: GeoFeature): string {
    const { regionId } = feature.properties;

    // Mini mode: highlight target, grey everything else
    if (mini) {
      if (!regionId) return FILL_UNDESIGNATED;
      if (regionId === highlightId) {
        const r = regionMap.get(regionId);
        return r?.type === "감소" ? "#f43f5e" : "#fbbf24";
      }
      return "#d6d3d1"; // stone-300 (slightly darker for contrast)
    }

    if (!regionId) return FILL_UNDESIGNATED;
    const region = regionMap.get(regionId);
    if (!region) return FILL_UNDESIGNATED;

    if (metric === "type") {
      return region.type === "감소" ? "#f43f5e" : "#fbbf24";
    }

    if (metric === "stayRatio") {
      const entry = lifepopMap.get(regionId);
      if (!entry || !colorScale) return FILL_NO_DATA;
      return colorScale(entry.stayRatio) as string;
    }

    if (metric === "declineType") {
      const dt = declineTypeMap.get(regionId);
      if (!dt) return FILL_NO_DATA;
      return DECLINE_TYPE_COLORS[dt];
    }

    const val = getMetricValue(region, metric);
    if (!val || !colorScale) return FILL_NO_DATA;
    return colorScale(val) as string;
  }

  // ─── Skeleton ─────────────────────────────────────────────────────────────

  if (!geoData || !pathFn) {
    return (
      <div
        className={`${
          mini ? "w-full" : "w-full"
        } aspect-[5/6] bg-stone-100 rounded-xl animate-pulse flex items-center justify-center`}
      >
        {!mini && (
          <span className="text-[10px] text-stone-400">지도 불러오는 중…</span>
        )}
      </div>
    );
  }

  const activeRamp = metric !== "type" && metric !== "declineType" ? RAMPS[metric] : null;

  // Whether lazy data for the current metric is still loading
  const isDataLoading =
    (metric === "stayRatio" && lifepopFetched && lifepopMap.size === 0) ||
    (metric === "declineType" && vitalPopFetched && declineTypeMap.size === 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col ${mini ? "gap-1" : "gap-4"}`}>
      {/* Metric switcher — full mode only */}
      {!mini && (
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                metric === key
                  ? "bg-stone-900 text-white"
                  : "bg-white text-stone-600 border border-stone-200 hover:border-stone-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* SVG map with tooltip overlay */}
      <div className="relative">
        {/* Loading overlay for lazy-fetched metrics */}
        {isDataLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl z-10">
            <span className="text-xs text-stone-400">데이터 불러오는 중…</span>
          </div>
        )}

        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto block"
          onMouseLeave={() => {
            setHoveredCode(null);
            setTooltip(null);
          }}
        >
          {geoData.features.map((feature) => {
            const { code, regionId } = feature.properties;
            const isHovered = !mini && hoveredCode === code;
            const canClick  = !mini && !!regionId;

            return (
              <path
                key={code}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                d={pathFn(feature as any) ?? ""}
                fill={getFill(feature)}
                stroke="white"
                strokeWidth={isHovered ? 2 : 0.5}
                strokeLinejoin="round"
                style={{
                  cursor: canClick ? "pointer" : "default",
                  transition: "fill 0.12s ease, stroke-width 0.08s ease",
                  filter: isHovered ? "brightness(0.88)" : "none",
                }}
                onMouseMove={
                  mini
                    ? undefined
                    : (e) => {
                        setHoveredCode(code);
                        const svg = (e.currentTarget as SVGPathElement)
                          .ownerSVGElement;
                        if (!svg) return;
                        const rect = svg.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        const region = regionId
                          ? regionMap.get(regionId)
                          : undefined;
                        setTooltip({
                          x,
                          y,
                          name: feature.properties.name,
                          sido: feature.properties.sido,
                          region,
                        });
                      }
                }
                onClick={
                  canClick
                    ? () =>
                        router.push(
                          `/region/${encodeURIComponent(regionId!)}`
                        )
                    : undefined
                }
              />
            );
          })}
        </svg>

        {/* Floating tooltip */}
        {tooltip && (
          <div
            className="absolute z-20 pointer-events-none bg-white rounded-xl shadow-lg border border-stone-200 px-3 py-2.5 text-xs min-w-[148px]"
            style={{
              left: tooltip.x + 14,
              top:  Math.max(tooltip.y - 70, 4),
            }}
          >
            <p className="font-semibold text-stone-900 leading-tight">
              {tooltip.name}
            </p>
            <p className="text-[10px] text-stone-400 mb-1.5">{tooltip.sido}</p>
            {tooltip.region ? (
              <>
                <RegionBadge type={tooltip.region.type} size="sm" />

                {/* stayRatio tooltip content */}
                {metric === "stayRatio" && (() => {
                  const entry = lifepopMap.get(tooltip.region!.id);
                  if (!entry) return null;
                  return (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      <span className="font-mono font-semibold text-teal-700">
                        {entry.stayRatio.toFixed(1)}×
                      </span>
                      {entry.lastRegistered != null && (
                        <span className="text-[10px] text-stone-400">
                          주민등록 {formatNumber(entry.lastRegistered)}명
                        </span>
                      )}
                      {entry.lastStaying != null && (
                        <span className="text-[10px] text-stone-400">
                          체류 {formatNumber(entry.lastStaying)}명
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* declineType tooltip content */}
                {metric === "declineType" && (() => {
                  const dt = declineTypeMap.get(tooltip.region!.id);
                  if (!dt) return null;
                  return (
                    <p
                      className="mt-1.5 text-xs font-semibold"
                      style={{ color: DECLINE_TYPE_COLORS[dt] }}
                    >
                      {dt}
                    </p>
                  );
                })()}

                {/* Sequential metric tooltip content */}
                {metric !== "type" && metric !== "stayRatio" && metric !== "declineType" && (
                  <p className="mt-1.5 font-mono text-stone-700">
                    {formatMetricValue(
                      metric,
                      getMetricValue(tooltip.region, metric)
                    )}
                  </p>
                )}

                <p className="mt-1 text-stone-500">
                  {formatNumber(tooltip.region.population?.total ?? 0)}명
                </p>
              </>
            ) : (
              <p className="text-[10px] text-stone-400 mt-0.5">지정 외 지역</p>
            )}
          </div>
        )}
      </div>

      {/* Legend — full mode only */}
      {!mini && (
        <div className="flex items-center gap-3 flex-wrap text-xs">
          {metric === "type" ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-rose-500 flex-shrink-0" />
                <span className="text-stone-600">감소지역</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-amber-400 flex-shrink-0" />
                <span className="text-stone-600">관심지역</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-stone-200 flex-shrink-0" />
                <span className="text-stone-400">지정 외</span>
              </span>
            </>
          ) : metric === "declineType" ? (
            <>
              {DECLINE_TYPES.map(([type, color]) => (
                <span key={type} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm inline-block flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-stone-600">{type}</span>
                </span>
              ))}
              <span className="flex items-center gap-1.5 ml-2">
                <span className="w-3 h-3 rounded-sm inline-block bg-stone-100 border border-stone-200 flex-shrink-0" />
                <span className="text-stone-400">데이터 없음</span>
              </span>
            </>
          ) : activeRamp ? (
            <>
              <span className="font-mono text-[10px] text-stone-400">
                {metric === "stayRatio"
                  ? `${metricMin.toFixed(1)}×`
                  : formatMetricValue(metric, metricMin)}
              </span>
              <div
                className="h-3 rounded flex-1 min-w-[60px] max-w-[120px]"
                style={{
                  background: `linear-gradient(to right,
                    rgb(${activeRamp[0].join(",")}),
                    rgb(${activeRamp[1].join(",")})
                  )`,
                }}
              />
              <span className="font-mono text-[10px] text-stone-400">
                {metric === "stayRatio"
                  ? `${metricMax.toFixed(1)}×`
                  : formatMetricValue(metric, metricMax)}
              </span>
              <span className="flex items-center gap-1.5 ml-2">
                <span className="w-3 h-3 rounded-sm inline-block bg-stone-100 border border-stone-200 flex-shrink-0" />
                <span className="text-stone-400">데이터 없음</span>
              </span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
