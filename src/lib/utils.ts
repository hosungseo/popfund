import type { VitalTrend, PopulationTrend, DeclineType } from "./types";

/** Format a number with thousands comma separator */
export function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** Abbreviate large won amounts to 억/조 units */
export function formatWon(n: number, digits = 1): string {
  if (n >= 1_000_000_000_000) {
    return `${(n / 1_000_000_000_000).toFixed(digits)}조`;
  }
  if (n >= 100_000_000) {
    return `${(n / 100_000_000).toFixed(digits)}억`;
  }
  if (n >= 10_000) {
    return `${(n / 10_000).toFixed(digits)}만`;
  }
  return formatNumber(n);
}

/** Sum all values in a fund record */
export function totalFund(fund: Record<string, number>): number {
  return Object.values(fund).reduce((a, b) => a + b, 0);
}

/** Compute execution rate (epAmt / bdgCashAmt * 100).
 * 초과집행(>100%)은 감시 대상 신호이므로 상한을 두지 않는다. */
export function executionRate(epAmt: number, bdgCashAmt: number): number {
  if (bdgCashAmt === 0) return 0;
  return (epAmt / bdgCashAmt) * 100;
}

/** Format execution rate as percentage string */
export function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

/** Color class for execution rate — 초과집행은 별도 강조 */
export function rateColorClass(rate: number): string {
  if (rate > 100) return "text-violet-700";
  if (rate >= 90) return "text-emerald-600";
  if (rate >= 70) return "text-amber-600";
  return "text-rose-600";
}

/** Latest fund year value from a fund record */
export function latestFund(fund: Record<string, number>): number {
  const years = Object.keys(fund).sort();
  const latest = years[years.length - 1];
  return fund[latest] ?? 0;
}

/** Normalize a project name for similarity matching (data-contract spec) */
export function normName(name: string): string {
  return name.replace(/\([^)]*\)/g, "").replace(/\s+/g, "");
}

/**
 * Classify a region's population decline type from cumulative vital + social change.
 * Mirrors the VitalDecomposition monthly formula: natural = births-deaths,
 * social ≈ totalChange - natural.
 */
export function computeDeclineType(
  regionId: string,
  vital: VitalTrend,
  popTrend: PopulationTrend,
): DeclineType | null {
  const vSeries = vital.series[regionId];
  const pVals = popTrend.series[regionId];
  if (!vSeries || !pVals) return null;

  const popByYm: Record<string, number | null> = {};
  popTrend.months.forEach((ym, i) => {
    popByYm[ym] = pVals[i] ?? null;
  });

  let naturalCum = 0;
  let socialCum = 0;
  let hasData = false;

  vital.months.forEach((ym, i) => {
    const births = vSeries.births[i] ?? null;
    const deaths = vSeries.deaths[i] ?? null;
    if (births === null || deaths === null) return;

    const natural = births - deaths;
    const pop = popByYm[ym] ?? null;
    const prevYm = i > 0 ? vital.months[i - 1] : null;
    const prevPop = prevYm ? (popByYm[prevYm] ?? null) : null;
    const totalChange =
      pop !== null && prevPop !== null ? pop - prevPop : null;
    const social = totalChange !== null ? totalChange - natural : null;

    naturalCum += natural;
    if (social !== null) socialCum += social;
    hasData = true;
  });

  if (!hasData) return null;

  if (naturalCum < 0 && socialCum < 0) return "이중감소형";
  if (naturalCum < 0 && socialCum >= 0) return "자연감소주도형";
  if (naturalCum >= 0 && socialCum < 0) return "유출주도형";
  return "회복형";
}

/** Compute 2-digit hex shard key for a normalized project name (data-contract spec) */
export function shardOf(norm: string): string {
  let h = 5381;
  for (let i = 0; i < norm.length; i++) {
    h = ((h * 33) ^ norm.charCodeAt(i)) >>> 0;
  }
  return (h & 0xff).toString(16).padStart(2, "0");
}

/** "202210" → "22.10" 축약 연월 표기 (차트 축 공통) */
export function fmtYm(ym: string): string {
  return `${ym.slice(2, 4)}.${ym.slice(4, 6)}`;
}
