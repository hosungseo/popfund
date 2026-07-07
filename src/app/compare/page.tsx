import type { Metadata } from "next";
import { loadRegions, loadMeta } from "@/lib/data";
import CompareView from "@/components/CompareView";

export const metadata: Metadata = {
  title: "지역 비교",
};

export default function ComparePage() {
  const regions = loadRegions();
  const meta = loadMeta();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          지역 비교
        </h1>
        <p className="text-sm text-stone-500">
          최대 6개 지역을 선택하여 인구 지표와 지방소멸대응기금 예산 추이를 비교합니다
        </p>
      </div>

      <CompareView regions={regions} fundYears={meta.fundYears} />
    </div>
  );
}
