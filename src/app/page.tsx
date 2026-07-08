import type { Metadata } from "next";
import Link from "next/link";
import { loadRegions, loadSummaryStats, loadLifepop } from "@/lib/data";
import StatCard from "@/components/StatCard";
import RegionTable from "@/components/RegionTable";
import KoreaMap from "@/components/KoreaMap";
import { formatNumber, formatWon, latestFund } from "@/lib/utils";

export const metadata: Metadata = {
  title: "전국 개요",
};

export default function HomePage() {
  const regions = loadRegions();
  const { decreaseCount, interestCount, totalPopulation, totalFund, latestYear } =
    loadSummaryStats(regions);

  // Top 3 stay ratio (체류 배율)
  const lifepop = loadLifepop();
  const top3StayRatio = lifepop
    ? [...regions]
        .filter((r) => {
          const s = lifepop.series[r.id];
          return s && s.stayRatio != null;
        })
        .map((r) => ({ ...r, stayRatio: lifepop.series[r.id].stayRatio! }))
        .sort((a, b) => b.stayRatio - a.stayRatio)
        .slice(0, 3)
    : [];

  // Top 3 per-capita fund (latest year fund ÷ population)
  const top3PerCapita = [...regions]
    .filter((r) => (r.population?.total ?? 0) > 0 && latestFund(r.fund) > 0)
    .map((r) => ({
      ...r,
      perCapita: latestFund(r.fund) / r.population.total,
    }))
    .sort((a, b) => b.perCapita - a.perCapita)
    .slice(0, 3);

  // Top 3 aging index
  const top3Aging = [...regions]
    .filter((r) => (r.population?.agingIndex ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.population?.agingIndex ?? 0) - (a.population?.agingIndex ?? 0)
    )
    .slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-12">
      {/* Page header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          전국 개요
        </h1>
        <p className="text-sm text-slate-500">
          행정안전부 지정 인구감소지역·관심지역{" "}
          {decreaseCount + interestCount}개 기초자치단체의 인구 및
          지방소멸대응기금 집행 현황
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="인구감소지역"
          value={`${decreaseCount}개`}
          sub="행정안전부 고시"
          accent
        />
        <StatCard
          label="관심지역"
          value={`${interestCount}개`}
          sub="행정안전부 고시"
        />
        <StatCard
          label="총인구 합계"
          value={formatNumber(totalPopulation)}
          sub="명 (2024 인구총조사)"
        />
        <StatCard
          label={`${latestYear}년 기금 합계`}
          value={formatWon(totalFund)}
          sub="지방소멸대응기금 세출예산"
        />
      </div>

      {/* Map section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">
            지정 현황 지도
          </h2>
          <span className="text-xs text-slate-400">클릭하면 지역 상세로 이동</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
          {/* Choropleth map */}
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-6">
            <KoreaMap regions={regions} />
          </div>

          {/* Stats sidebar */}
          <div className="flex flex-col gap-5">
            {/* Type count chips */}
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-5 flex flex-col gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                지정 현황
              </span>
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 ring-1 ring-rose-200 rounded-full px-3 py-1 text-sm">
                  <span className="font-mono font-bold">{decreaseCount}</span>
                  <span className="text-xs">감소지역</span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 ring-1 ring-amber-200 rounded-full px-3 py-1 text-sm">
                  <span className="font-mono font-bold">{interestCount}</span>
                  <span className="text-xs">관심지역</span>
                </span>
              </div>
            </div>

            {/* Top 3 per-capita fund */}
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-5 flex flex-col gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                1인당 기금 상위
              </span>
              <ol className="flex flex-col gap-2">
                {top3PerCapita.map((r, i) => (
                  <li key={r.id}>
                    <Link
                      href={`/region/${encodeURIComponent(r.id)}`}
                      className="flex items-center justify-between gap-2 hover:text-slate-900 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-[10px] font-mono text-slate-400">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                          {r.sigungu}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {formatWon(Math.round(r.perCapita))}/인
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>

            {/* Top 3 aging index */}
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-5 flex flex-col gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                노령화지수 상위
              </span>
              <ol className="flex flex-col gap-2">
                {top3Aging.map((r, i) => (
                  <li key={r.id}>
                    <Link
                      href={`/region/${encodeURIComponent(r.id)}`}
                      className="flex items-center justify-between gap-2 hover:text-slate-900 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-[10px] font-mono text-slate-400">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                          {r.sigungu}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {r.population?.agingIndex?.toFixed(1) ?? "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>

            {/* Top 3 stay ratio */}
            {top3StayRatio.length > 0 && (
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-5 flex flex-col gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  체류 배율 상위
                </span>
                <ol className="flex flex-col gap-2">
                  {top3StayRatio.map((r, i) => (
                    <li key={r.id}>
                      <Link
                        href={`/region/${encodeURIComponent(r.id)}`}
                        className="flex items-center justify-between gap-2 hover:text-slate-900 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-4 text-[10px] font-mono text-slate-400">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                            {r.sigungu}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-teal-600 tabular-nums">
                          {r.stayRatio.toFixed(1)}×
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Region table */}
      <RegionTable regions={regions} latestYear={latestYear} />
    </div>
  );
}
