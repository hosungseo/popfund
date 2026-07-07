import type { Metadata } from "next";
import { loadRegions, loadMeta } from "@/lib/data";
import { latestFund } from "@/lib/utils";
import InsightsView from "@/components/InsightsView";
import type { PerCapitaPoint } from "@/components/InsightsView";

export const metadata: Metadata = {
  title: "인사이트",
  description: "1인당 기금액 랭킹, 초과집행 사업, 인구-기금 상관관계 분석",
};

export default function InsightsPage() {
  const regions = loadRegions();
  const meta = loadMeta();
  const latestYear = meta.fundYears[meta.fundYears.length - 1];

  const perCapitaData: PerCapitaPoint[] = regions
    .filter((r) => (r.population?.total ?? 0) > 0)
    .map((r) => ({
      id: r.id,
      name: `${r.sido} ${r.sigungu}`,
      sido: r.sido,
      type: r.type,
      perCapita: Math.round(latestFund(r.fund) / r.population.total),
      fund: latestFund(r.fund),
      population: r.population.total,
    }))
    .sort((a, b) => b.perCapita - a.perCapita);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">인사이트</h1>
        <p className="text-sm text-stone-500">
          {latestYear}년 기준 지방소멸대응기금 집행 패턴 분석
        </p>
      </div>
      <InsightsView perCapitaData={perCapitaData} latestYear={latestYear} censusYear={meta.censusYear} />
    </div>
  );
}
