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
