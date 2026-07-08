import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { loadRegions, loadMeta, loadPolicy, loadLifepop, loadVitalTrend, loadPopulationTrend } from "@/lib/data";
import RegionBadge from "@/components/RegionBadge";
import PopulationCards from "@/components/PopulationCards";
import PopulationTrendChart from "@/components/PopulationTrendChart";
import AgePyramidChart from "@/components/AgePyramid";
import LifepopCard from "@/components/LifepopCard";
import FundBarChart from "@/components/FundBarChart";
import ProjectsTable from "@/components/ProjectsTable";
import KoreaMap from "@/components/KoreaMap";
import VitalDecomposition from "@/components/VitalDecomposition";
import CouncilMinutes from "@/components/CouncilMinutes";
import { formatWon, totalFund, computeDeclineType } from "@/lib/utils";
import type { DeclineType } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const regions = loadRegions();
  // 원본 id 그대로 반환해야 정적 export 폴더가 UTF-8 이름(경북-의성군/)으로 생성된다.
  // encodeURIComponent를 반환하면 퍼센트 문자열이 리터럴 폴더명이 되어 GitHub Pages에서 404.
  // (브라우저 요청의 %인코딩은 서버가 UTF-8로 디코드해 매칭하므로 Link href의 encode는 유지)
  return regions.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const regions = loadRegions();
  const region = regions.find((r) => r.id === decodeURIComponent(id));
  if (!region) return { title: "지역 없음" };
  return {
    title: `${region.sido} ${region.sigungu}`,
    description: `${region.sido} ${region.sigungu} 인구 현황 및 지방소멸대응기금 집행 모니터`,
  };
}

export default async function RegionPage({ params }: Props) {
  const { id } = await params;

  const allRegions = loadRegions();
  const region = allRegions.find((r) => r.id === decodeURIComponent(id));
  if (!region) notFound();

  const meta = loadMeta();
  const tf = totalFund(region.fund);

  // v2.0 summary badge data (loaded server-side; null if files not yet built)
  const policy = loadPolicy();
  const lifepop = loadLifepop();
  const vitalTrend = loadVitalTrend();
  const popTrend = loadPopulationTrend();

  const policyRegion = policy.regions.find((r) => r.id === region.id) ?? null;
  const stayRatio = lifepop?.series[region.id]?.stayRatio ?? null;
  const declineType: DeclineType | null =
    vitalTrend && popTrend
      ? computeDeclineType(region.id, vitalTrend, popTrend)
      : null;

  const DECLINE_TYPE_COLORS: Record<DeclineType, string> = {
    "이중감소형":     "bg-rose-50 text-rose-700 ring-rose-200",
    "자연감소주도형": "bg-amber-50 text-amber-700 ring-amber-200",
    "유출주도형":     "bg-violet-50 text-violet-700 ring-violet-200",
    "회복형":         "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };

  // Build lafCd → "시도 시군구" map for the drawer's region name lookup
  const lafCdToName: Record<string, string> = Object.fromEntries(
    allRegions.map((r) => [r.lafCd, `${r.sido} ${r.sigungu}`])
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-stone-400">
        <Link href="/" className="hover:text-stone-700 transition-colors">
          전국 개요
        </Link>
        <span>/</span>
        <span className="text-stone-600">{region.sido}</span>
        <span>/</span>
        <span className="text-stone-900 font-medium">{region.sigungu}</span>
      </nav>

      {/* Region header — title left, mini map right */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">
              {region.sigungu}
            </h1>
            <RegionBadge type={region.type} />
            <span className="text-sm text-stone-500">{region.sido}</span>
          </div>

          {/* v2.0 summary badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* ① 위기 순위 */}
            {policyRegion && (
              <span
                className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 ring-1 ${
                  policyRegion.riskRank <= 20
                    ? "bg-rose-50 text-rose-700 ring-rose-200"
                    : "bg-stone-50 text-stone-600 ring-stone-200"
                }`}
              >
                위기 {policyRegion.riskRank}위/107
              </span>
            )}

            {/* ② 감소 유형 */}
            {declineType && (
              <span
                className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 ring-1 ${DECLINE_TYPE_COLORS[declineType]}`}
              >
                {declineType}
              </span>
            )}

            {/* ③ 체류 배율 */}
            {stayRatio != null && (
              <span
                className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 ring-1 ${
                  stayRatio >= 5
                    ? "bg-blue-50 text-blue-700 ring-blue-200"
                    : "bg-stone-50 text-stone-600 ring-stone-200"
                }`}
              >
                체류 {stayRatio.toFixed(1)}×
              </span>
            )}

            {/* ④ 기금사업 집행률 */}
            {policyRegion && policyRegion.fundExecRate != null && (
              <span
                className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 ring-1 ${
                  policyRegion.fundExecRate < 30
                    ? "bg-rose-50 text-rose-700 ring-rose-200"
                    : "bg-stone-50 text-stone-600 ring-stone-200"
                }`}
              >
                집행 {policyRegion.fundExecRate.toFixed(1)}%
              </span>
            )}
          </div>

          <p className="text-sm text-stone-500">
            {meta.fundYears[0]}~{meta.fundYears[meta.fundYears.length - 1]}년 누계
            기금 총액:{" "}
            <span className="font-mono font-semibold text-stone-800">
              {formatWon(tf)}원
            </span>
          </p>
        </div>

        {/* Mini choropleth — highlight this region, no interaction */}
        <div className="w-24 sm:w-32 shrink-0">
          <KoreaMap
            regions={allRegions}
            highlightId={region.id}
            mini
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col gap-10">
        {/* Population section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-stone-800">인구 지표</h2>
            <span className="text-xs text-stone-400">
              {meta.censusYear}년 인구총조사
            </span>
          </div>
          <PopulationCards population={region.population} />
        </section>

        {/* Population trend section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-stone-800">인구 추이</h2>
            <span className="text-xs text-stone-400">
              행정안전부 주민등록 인구 (2022.10~)
            </span>
          </div>
          <PopulationTrendChart regionId={region.id} />
        </section>

        {/* Vital decomposition section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-stone-800">
              인구 증감 분해
            </h2>
            <span className="text-xs text-stone-400">
              자연증감 · 사회적 증감 분해
            </span>
          </div>
          <VitalDecomposition regionId={region.id} />
        </section>

        {/* Age pyramid section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-stone-800">인구 구조</h2>
          </div>
          <AgePyramidChart regionId={region.id} />
        </section>

        {/* Lifepop section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-stone-800">생활인구</h2>
            <span className="text-xs text-stone-400">
              행안부 생활인구 공표 (2025년 4분기)
            </span>
          </div>
          <LifepopCard regionId={region.id} />
        </section>

        {/* Fund chart section */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-stone-800">
            지방소멸대응기금 연도별 예산
          </h2>
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <FundBarChart fund={region.fund} years={meta.fundYears} />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {meta.fundYears.map((year) => (
              <div
                key={year}
                className="bg-white rounded-xl border border-stone-200 p-3 flex flex-col gap-0.5"
              >
                <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
                  {year}년
                </span>
                <span className="font-mono text-sm font-semibold text-stone-800 tabular-nums">
                  {region.fund[year] != null
                    ? formatWon(region.fund[year])
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Projects section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-stone-800">
              세부사업 현황
            </h2>
            <span className="text-xs text-stone-400">
              집행일자 기준{" "}
              {meta.exeYmd.replace(/(\d{4})(\d{2})(\d{2})/, "$1.$2.$3")}
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <ProjectsTable
              lafCd={region.lafCd}
              regionName={`${region.sido} ${region.sigungu}`}
              lafCdToName={lafCdToName}
            />
          </div>
        </section>

        {/* v2.2 council minutes */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-stone-800">
            지방의회 논의
          </h2>
          <CouncilMinutes regionId={region.id} />
        </section>
      </div>
    </div>
  );
}
