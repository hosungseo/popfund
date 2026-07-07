import type { Population } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface Props {
  population: Population;
}

const metrics: Array<{
  key: keyof Population;
  label: string;
  format: (v: number) => string;
  unit?: string;
}> = [
  {
    key: "total",
    label: "총인구",
    format: formatNumber,
    unit: "명",
  },
  {
    key: "male",
    label: "남성",
    format: formatNumber,
    unit: "명",
  },
  {
    key: "female",
    label: "여성",
    format: formatNumber,
    unit: "명",
  },
  {
    key: "avgAge",
    label: "평균나이",
    format: (v) => v.toFixed(1),
    unit: "세",
  },
  {
    key: "agingIndex",
    label: "노령화지수",
    format: (v) => v.toFixed(1),
    unit: "",
  },
  {
    key: "density",
    label: "인구밀도",
    format: (v) => v.toFixed(1),
    unit: "명/km²",
  },
  {
    key: "youthDependency",
    label: "유년부양비",
    format: (v) => v.toFixed(1),
    unit: "",
  },
  {
    key: "oldAgeDependency",
    label: "노년부양비",
    format: (v) => v.toFixed(1),
    unit: "",
  },
];

export default function PopulationCards({ population }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {metrics.map(({ key, label, format, unit }) => {
        const raw = population[key];
        const value = raw != null ? format(raw as number) : "—";
        return (
          <div
            key={key}
            className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col gap-1"
          >
            <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">
              {label}
            </span>
            <span className="font-mono text-xl font-bold text-stone-900 tabular-nums">
              {value}
              {raw != null && unit && (
                <span className="text-sm font-normal text-stone-500 ml-1">
                  {unit}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
