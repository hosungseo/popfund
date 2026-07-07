import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { loadRegions, loadMeta } from "@/lib/data";
import RegionBadge from "@/components/RegionBadge";
import PopulationCards from "@/components/PopulationCards";
import FundBarChart from "@/components/FundBarChart";
import ProjectsTable from "@/components/ProjectsTable";
import KoreaMap from "@/components/KoreaMap";
import { formatWon, totalFund } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const regions = loadRegions();
  return regions.map((r) => ({ id: encodeURIComponent(r.id) }));
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
            <h2 className="text-base font-semibold text-stone-800">인구 지표</h2>
            <span className="text-xs text-stone-400">
              {meta.censusYear}년 인구총조사
            </span>
          </div>
          <PopulationCards population={region.population} />
        </section>

        {/* Fund chart section */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-stone-800">
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
            <h2 className="text-base font-semibold text-stone-800">
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

        {/* v2 placeholder tab */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-stone-800">
            지방의회 논의
          </h2>
          <div className="bg-white rounded-2xl border border-stone-200 border-dashed p-8 flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-500">
              준비 중
            </span>
            <p className="text-sm text-stone-500 max-w-sm">
              지방의회 회의록 연계 기능은 v2에서 제공 예정입니다. 국회도서관
              지방의정포털 데이터를 기반으로 해당 지역 의회의 소멸 관련 논의를
              확인할 수 있습니다.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
