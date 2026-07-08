import type { Metadata } from "next";
import { loadPolicy } from "@/lib/data";
import PolicyView from "@/components/PolicyView";

export const metadata: Metadata = {
  title: "정책 시사점",
  description:
    "지방소멸대응기금 배분·집행·위기 지수 분석. 인구감소지역 89개·관심지역 18개 기준.",
};

function formatYm(ym: string): string {
  return `${ym.slice(0, 4)}.${ym.slice(4, 6)}`;
}

export default function PolicyPage() {
  const policy = loadPolicy();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">
      {/* Page header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          정책 시사점
        </h1>
        <p className="text-sm text-slate-500">
          기금 배분·집행·위기 지수 분석 · 인구감소 및 관심지역{" "}
          {policy.regions.length}개
        </p>
      </div>

      {/* Basis info line */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400 tabular-nums bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
        <span>
          감소율 구간{" "}
          {formatYm(policy.basis.trendRange[0])}~{formatYm(policy.basis.trendRange[1])}
        </span>
        <span className="text-slate-200 hidden sm:inline">|</span>
        <span>기금 누계 {policy.basis.fundYears.join("·")}년</span>
        <span className="text-slate-200 hidden sm:inline">|</span>
        <span>인구구조 기준 {formatYm(policy.basis.pyramidYm)}</span>
      </div>

      <PolicyView policy={policy} />

      {/* Disclaimer */}
      <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-4 leading-relaxed">
        본 페이지는 공개데이터 기반 참고 분석이며 공식 평가·통계가 아닙니다.
      </p>
    </div>
  );
}
