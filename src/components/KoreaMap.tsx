"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { geoMercator, geoPath } from "d3-geo";
import { scaleSequential } from "d3-scale";
import type { Region } from "@/lib/types";
import RegionBadge from "./RegionBadge";
import { latestFund, formatWon, formatNumber } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MapMetric = "type" | "perCapita" | "agingIndex" | "fund2026";

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
};

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
  ["type",       "유형"],
  ["perCapita",  "1인당 기금"],
  ["agingIndex", "노령화지수"],
  ["fund2026",   "2026년 기금"],
];

const FILL_UNDESIGNATED = "#e7e5e4"; // stone-200
const FILL_NO_DATA      = "#f5f5f4"; // stone-100

// ─── Component ────────────────────────────────────────────────────────────────

export default function KoreaMap({ regions, highlightId, mini = false }: KoreaMapProps) {
  const router = useRouter();
  const [geoData,     setGeoData]     = useState<GeoData | null>(null);
  const [metric,      setMetric]      = useState<MapMetric>("type");
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [tooltip,     setTooltip]     = useState<TooltipState | null>(null);

  // Fetch GeoJSON once on mount (client-side, ~366 KB)
  useEffect(() => {
    fetch("/data/korea-sigungu.json")
      .then((r) => r.json())
      .then((d: GeoData) => setGeoData(d))
      .catch(() => {});
  }, []);

  // regionId → Region lookup map
  const regionMap = useMemo(() => {
    const m = new Map<string, Region>();
    regions.forEach((r) => m.set(r.id, r));
    return m;
  }, [regions]);

  // Domain [min, max] for the active sequential metric
  const [metricMin, metricMax] = useMemo((): [number, number] => {
    if (metric === "type") return [0, 1];
    const vals = regions
      .map((r) => getMetricValue(r, metric))
      .filter((v) => v > 0);
    if (!vals.length) return [0, 1];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return [min, max > min ? max : min + 1];
  }, [regions, metric]);

  // d3-scale sequential color scale
  const colorScale = useMemo(() => {
    if (metric === "type") return null;
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

  const activeRamp = metric !== "type" ? RAMPS[metric] : null;

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
                {metric !== "type" && (
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
          ) : activeRamp ? (
            <>
              <span className="font-mono text-[10px] text-stone-400">
                {formatMetricValue(metric, metricMin)}
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
                {formatMetricValue(metric, metricMax)}
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
