import type { Metadata } from "next";
import FundProjectsPage from "@/components/FundProjectsPage";

export const metadata: Metadata = {
  title: "기금사업 탐색",
  description: "지방소멸대응기금 확정·후보 사업 전국 목록을 검색하고 집행률로 분석합니다",
};

export default function ProjectsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          기금사업 탐색
        </h1>
        <p className="text-sm text-slate-500">
          전국 인구감소지역·관심지역의 지방소멸대응기금 확정·후보 사업 현황
        </p>
      </div>
      <FundProjectsPage />
    </div>
  );
}
