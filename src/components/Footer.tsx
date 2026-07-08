import type { Meta } from "@/lib/types";

interface Props {
  meta: Meta;
}

export default function Footer({ meta }: Props) {
  const builtDate = new Date(meta.builtAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            데이터 출처
          </p>
          <ul className="flex flex-col gap-1">
            {meta.sources.map((s) => (
              <li key={s} className="text-xs text-slate-500 leading-relaxed">
                {s}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-2">
            스냅샷 기준일: {meta.exeYmd.replace(/(\d{4})(\d{2})(\d{2})/, "$1년 $2월 $3일")}
            &nbsp;&middot;&nbsp;
            빌드: {builtDate}
          </p>
          <p className="text-xs text-slate-400">
            본 사이트는 공공데이터를 시각화한 참고용 모니터링 도구입니다. 공식 통계는 각 출처를 직접 확인하세요.
          </p>
        </div>
      </div>
    </footer>
  );
}
