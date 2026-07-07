import type { Metadata } from "next";
import { loadRegions, loadSummaryStats } from "@/lib/data";
import StatCard from "@/components/StatCard";
import RegionTable from "@/components/RegionTable";
import { formatNumber, formatWon } from "@/lib/utils";

export const metadata: Metadata = {
  title: "전국 개요",
};

export default function HomePage() {
  const regions = loadRegions();
  const { decreaseCount, interestCount, totalPopulation, totalFund, latestYear } =
    loadSummaryStats(regions);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">
      {/* Page header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          전국 개요
        </h1>
        <p className="text-sm text-stone-500">
          행정안전부 지정 인구감소지역·관심지역 {decreaseCount + interestCount}개 기초자치단체의
          인구 및 지방소멸대응기금 집행 현황
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

      {/* Region table */}
      <RegionTable regions={regions} latestYear={latestYear} />
    </div>
  );
}
