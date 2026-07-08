import type { Metadata } from "next";
import { loadRegions, loadMinutesSummary } from "@/lib/data";
import MinutesHub from "@/components/MinutesHub";

export const metadata: Metadata = {
  title: "지방의회 논의",
  description: "『지방소멸대응기금』이 언급된 지방의회 회의록 전체 목록",
};

export default function MinutesPage() {
  const summaries = loadMinutesSummary();
  const regions = loadRegions();

  const totalMentions = summaries.reduce((acc, s) => acc + s.totalCount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          지방의회 논의
        </h1>
        <p className="text-sm text-slate-500">
          『지방소멸대응기금』이 언급된 {summaries.length}개 의회 회의록 · 총{" "}
          {totalMentions.toLocaleString("ko-KR")}건
        </p>
      </div>
      <MinutesHub summaries={summaries} regions={regions} />
    </div>
  );
}
