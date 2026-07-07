"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ReferenceLine,
  LabelList,
} from "recharts";
import type { Policy, PolicyRegion } from "@/lib/types";
import { formatWon } from "@/lib/utils";

interface Props {
  policy: Policy;
}

// ---- Scatter tooltip ----
interface ScatterPayloadItem {
  payload: PolicyRegion & { xVal: number; yVal: number };
}

function ScatterTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ScatterPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-md text-xs min-w-[168px]">
      <p className="font-semibold text-stone-800 mb-1.5">
        {d.sido} {d.sigungu}
      </p>
      <p className="text-stone-500">
        1인당 기금:{" "}
        <span className="font-mono text-stone-700">
          {(d.perCapitaFundCum / 10000).toFixed(1)}만원/인
        </span>
      </p>
      <p className="text-stone-500">
        인구 변화:{" "}
        <span
          className={`font-mono font-semibold ${
            d.declinePct < 0 ? "text-rose-600" : "text-stone-700"
          }`}
        >
          {d.declinePct.toFixed(2)}%
        </span>
      </p>
      <span
        className={`inline-flex mt-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${
          d.type === "감소"
            ? "bg-rose-50 text-rose-700 ring-rose-200"
            : "bg-amber-50 text-amber-700 ring-amber-200"
        }`}
      >
        {d.type}지역
      </span>
    </div>
  );
}

// ---- Reading guide box ----
function ReadingGuide({ text }: { text: string }) {
  return (
    <div className="bg-stone-50 border border-stone-100 rounded-xl px-4 py-3">
      <p className="text-[11px] text-stone-500 leading-relaxed">{text}</p>
    </div>
  );
}

// ---- Section header ----
function SectionHeader({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-stone-800">{title}</h2>
      <p className="text-xs text-stone-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ---- Type badge ----
function TypeBadge({ type }: { type: "감소" | "관심" }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ring-1 ${
        type === "감소"
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-amber-50 text-amber-700 ring-amber-200"
      }`}
    >
      {type}
    </span>
  );
}

// ---- Field exec-rate color ----
function fieldColor(rate: number): string {
  if (rate >= 60) return "#10b981";
  if (rate >= 40) return "#f59e0b";
  if (rate >= 20) return "#fb923c";
  return "#f43f5e";
}

// ---- Narrowed type for regions with non-null fundExecRate ----
type RegionWithExec = PolicyRegion & { fundExecRate: number };

export default function PolicyView({ policy }: Props) {
  const medX = policy.medians.perCapitaFundCum / 10000;
  const medY = policy.medians.declinePct;

  // ===== Section 1: Scatter =====
  const scatterDecrease = useMemo(
    () =>
      policy.regions
        .filter((r) => r.type === "감소")
        .map((r) => ({ ...r, xVal: r.perCapitaFundCum / 10000, yVal: r.declinePct })),
    [policy.regions]
  );
  const scatterInterest = useMemo(
    () =>
      policy.regions
        .filter((r) => r.type === "관심")
        .map((r) => ({ ...r, xVal: r.perCapitaFundCum / 10000, yVal: r.declinePct })),
    [policy.regions]
  );

  // ===== Section 2: Exec rate =====
  const execFiltered = useMemo((): RegionWithExec[] => {
    return (
      policy.regions
        .filter((r): r is RegionWithExec => r.fundExecRate !== null)
        .sort((a, b) => a.fundExecRate - b.fundExecRate)
    );
  }, [policy.regions]);

  const execBottom15 = useMemo(() => execFiltered.slice(0, 15), [execFiltered]);
  const execTop5 = useMemo(
    () => execFiltered.slice(-5).reverse(),
    [execFiltered]
  );

  const execBarData = useMemo(
    () =>
      execBottom15.map((r) => ({
        name: `${r.sido} ${r.sigungu}`,
        rate: r.fundExecRate,
        count: r.fundProjectCount,
        type: r.type,
      })),
    [execBottom15]
  );

  // ===== Section 3: Risk watch =====
  const riskTop10 = useMemo(
    () =>
      policy.regions
        .filter((r) => r.riskRank <= 10)
        .sort((a, b) => a.riskRank - b.riskRank),
    [policy.regions]
  );

  const watchInterest = useMemo(() => {
    const decreaseScores = policy.regions
      .filter((r) => r.type === "감소")
      .map((r) => r.riskScore)
      .sort((a, b) => a - b);
    if (decreaseScores.length === 0) return [];
    const mid = Math.floor(decreaseScores.length / 2);
    const medianDecScore =
      decreaseScores.length % 2 === 0
        ? (decreaseScores[mid - 1] + decreaseScores[mid]) / 2
        : decreaseScores[mid];
    return policy.regions.filter(
      (r) => r.type === "관심" && r.riskScore > medianDecScore
    );
  }, [policy.regions]);

  // ===== Section 4: Field portfolio =====
  const fieldChartData = useMemo(
    () =>
      [...policy.fields]
        .sort((a, b) => b.totalBdg - a.totalBdg)
        .map((f) => ({
          fldNm: f.fldNm,
          bdgBillions: Math.round(f.totalBdg / 100_000_000),
          execRate: f.execRate,
          totalBdg: f.totalBdg,
          count: f.count,
        })),
    [policy.fields]
  );

  return (
    <div className="flex flex-col gap-12">
      {/* ===== 1. 기금 배분과 인구 변화 ===== */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="기금 배분과 인구 변화"
          sub="x = 1인당 기금 누계(만원/인) · y = 인구 변화율(%) · 점선 십자선 = 중앙값"
        />

        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <div style={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 24, left: 8, bottom: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis
                  type="number"
                  dataKey="xVal"
                  name="1인당 기금"
                  tickFormatter={(v: number) => `${v.toFixed(0)}`}
                  tick={{ fontSize: 11, fill: "#78716c" }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "1인당 기금 누계 (만원/인)",
                    position: "insideBottom",
                    offset: -18,
                    fontSize: 11,
                    fill: "#a8a29e",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="yVal"
                  name="인구 변화율"
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  tick={{ fontSize: 11, fill: "#78716c" }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  label={{
                    value: "인구 변화율 (%)",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                    fill: "#a8a29e",
                    offset: 8,
                  }}
                />
                <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: "3 3" }} />
                {/* Crosshair at medians */}
                <ReferenceLine
                  x={medX}
                  stroke="#a8a29e"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                />
                <ReferenceLine
                  y={medY}
                  stroke="#a8a29e"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                />
                <Scatter
                  name="감소지역"
                  data={scatterDecrease}
                  fill="#f43f5e"
                  fillOpacity={0.7}
                  r={5}
                />
                <Scatter
                  name="관심지역"
                  data={scatterInterest}
                  fill="#f59e0b"
                  fillOpacity={0.7}
                  r={5}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 mt-2 px-1">
            <span className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
              감소지역
            </span>
            <span className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
              관심지역
            </span>
            <span className="flex items-center gap-1.5 text-xs text-stone-400">
              <span
                className="w-5 shrink-0 border-b border-dashed border-stone-300"
                style={{ borderBottomWidth: "1.5px" }}
              />
              중앙값 기준선
            </span>
          </div>

          {/* Quadrant labels 2×2 grid */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              {
                pos: "좌하",
                name: "기금↓·감소빠름",
                note: "주시 필요",
                cls: "bg-rose-50 border-rose-100 text-rose-700",
              },
              {
                pos: "우하",
                name: "기금↑·감소빠름",
                note: "",
                cls: "bg-amber-50 border-amber-100 text-amber-700",
              },
              {
                pos: "좌상",
                name: "기금↓·감소완만",
                note: "",
                cls: "bg-stone-50 border-stone-100 text-stone-500",
              },
              {
                pos: "우상",
                name: "기금↑·감소완만",
                note: "",
                cls: "bg-emerald-50 border-emerald-100 text-emerald-700",
              },
            ].map((q) => (
              <div
                key={q.pos}
                className={`flex items-baseline gap-1.5 rounded-lg border px-3 py-2 ${q.cls}`}
              >
                <span className="text-[10px] font-mono opacity-50 shrink-0">{q.pos}</span>
                <span className="text-[11px] font-medium">{q.name}</span>
                {q.note && (
                  <span className="text-[10px] font-semibold opacity-75">
                    ({q.note})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <ReadingGuide text="1인당 기금이 많은 지역이 대체로 인구 규모가 작은 지역이며, 기금 배분과 감소 속도 사이의 단순 상관을 인과 효과로 해석해서는 안 됩니다. 우하 사분면(기금을 상대적으로 많이 받고도 감소가 빠른 지역)은 사업 구성과 집행 역량을 함께 살펴볼 필요가 있습니다." />
      </section>

      {/* ===== 2. 집행 역량 ===== */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="집행 역량 — 지역별 기금사업 집행률"
          sub="집행률 하위 15개 지역 (null 제외) · 막대 우측 = 기금사업 건수"
        />

        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          {execBottom15.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-10">
              집행률 데이터가 없습니다.
            </p>
          ) : (
            <div style={{ height: Math.min(execBottom15.length * 38 + 32, 580) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={execBarData}
                  margin={{ top: 4, right: 72, left: 8, bottom: 4 }}
                  barSize={18}
                >
                  <CartesianGrid
                    horizontal={false}
                    strokeDasharray="3 3"
                    stroke="#e7e5e4"
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 11, fill: "#78716c" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={104}
                    tick={{ fontSize: 11, fill: "#44403c" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(_v, _name, item) => {
                      const row = item.payload as (typeof execBarData)[0];
                      return [
                        `${row.rate.toFixed(1)}% · ${row.count}건`,
                        "집행률 · 사업수",
                      ];
                    }}
                    contentStyle={{
                      border: "1px solid #e7e5e4",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                    {execBarData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.type === "감소" ? "#f43f5e" : "#f59e0b"}
                      />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      formatter={(v: unknown) =>
                        typeof v === "number" ? `${v}건` : ""
                      }
                      style={{ fontSize: 10, fill: "#78716c" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top 5 list */}
          {execTop5.length > 0 && (
            <div className="mt-5 pt-4 border-t border-stone-100">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                집행률 상위 5
              </span>
              <ol className="mt-3 flex flex-col gap-2">
                {execTop5.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-[10px] font-mono text-stone-400 shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-medium text-stone-700">
                      {r.sido} {r.sigungu}
                    </span>
                    <TypeBadge type={r.type} />
                    <span className="ml-auto font-mono text-xs font-semibold text-emerald-600 tabular-nums">
                      {r.fundExecRate.toFixed(1)}%
                    </span>
                    <span className="text-[10px] font-mono text-stone-400 tabular-nums">
                      {r.fundProjectCount}건
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <ReadingGuide text="집행률이 낮다는 것은 예산 배정 대비 실집행이 더디다는 신호입니다. 연차 초 사업 특성일 수도 있으나, 반복되면 기획·집행 역량 지원(컨설팅, 인력)이 필요한 후보군입니다." />
      </section>

      {/* ===== 3. 재지정 워치 ===== */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="재지정 워치 — 2026 하반기 재평가 대비"
          sub="위기 점수 상위 10 · 점수 = z(감소속도) + z(고령비율) + z(유소년비율역) 평균"
        />

        <div className="flex flex-col gap-4">
          {/* Top 10 table */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-4 py-2.5 text-left font-semibold text-stone-500 w-10">
                    순위
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-stone-500">
                    지역
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-stone-500">
                    유형
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-stone-500">
                    감소율
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-stone-500">
                    고령비율
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-stone-500">
                    유소년비율
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-stone-500">
                    위기점수
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {riskTop10.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-stone-50/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-stone-400 tabular-nums">
                      {r.riskRank}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-stone-800">
                      {r.sido} {r.sigungu}
                    </td>
                    <td className="px-4 py-2.5">
                      <TypeBadge type={r.type} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-stone-600">
                      {r.declinePct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-stone-600">
                      {r.elderlyPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-stone-600">
                      {r.youthPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-rose-600">
                      {r.riskScore.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Highlight card: 관심지역 중 감소지역 riskScore 중앙값 초과 */}
          {watchInterest.length > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">
                주목 — 감소지역 중앙값보다 위기 점수가 높은 관심지역
              </span>
              <div className="mt-3 flex flex-col gap-3">
                {watchInterest.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1"
                  >
                    <span className="font-semibold text-stone-800 text-sm">
                      {r.sido} {r.sigungu}
                    </span>
                    <TypeBadge type={r.type} />
                    <span className="text-xs text-stone-500">
                      위기점수{" "}
                      <span className="font-mono font-bold text-rose-600">
                        {r.riskScore.toFixed(3)}
                      </span>
                    </span>
                    <span className="text-xs text-stone-500">
                      감소율{" "}
                      <span className="font-mono text-stone-700">
                        {r.declinePct.toFixed(2)}%
                      </span>
                    </span>
                    <span className="text-xs text-stone-500">
                      고령비율{" "}
                      <span className="font-mono text-stone-700">
                        {r.elderlyPct.toFixed(1)}%
                      </span>
                    </span>
                    <span className="text-xs text-stone-500">
                      유소년비율{" "}
                      <span className="font-mono text-stone-700">
                        {r.youthPct.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <ReadingGuide text="위기 점수는 인구 감소 속도·고령 비율·유소년 비율을 표준화해 평균한 참고 지표입니다. 공식 인구감소지수(8개 지표)와 산식이 다르며, 재지정을 예측하는 지표가 아니라 주시가 필요한 지역을 좁히는 도구입니다." />
      </section>

      {/* ===== 4. 기금사업 포트폴리오 ===== */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="기금사업 포트폴리오 — 분야별"
          sub="분야별 총예산(억원) 내림차순 · 막대 색 = 집행률 수준 · 우측 숫자 = 집행률"
        />

        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          {fieldChartData.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-10">
              분야 데이터가 없습니다.
            </p>
          ) : (
            <div style={{ height: fieldChartData.length * 46 + 32 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={fieldChartData}
                  margin={{ top: 4, right: 72, left: 8, bottom: 4 }}
                  barSize={24}
                >
                  <CartesianGrid
                    horizontal={false}
                    strokeDasharray="3 3"
                    stroke="#e7e5e4"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => `${v}억`}
                    tick={{ fontSize: 11, fill: "#78716c" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="fldNm"
                    width={140}
                    tick={{ fontSize: 11, fill: "#44403c" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(_v, _name, item) => {
                      const row = item.payload as (typeof fieldChartData)[0];
                      return [
                        `${formatWon(row.totalBdg)} · 집행률 ${row.execRate.toFixed(1)}% · ${row.count}건`,
                        "예산·집행률·건수",
                      ];
                    }}
                    contentStyle={{
                      border: "1px solid #e7e5e4",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  />
                  <Bar dataKey="bdgBillions" radius={[0, 4, 4, 0]}>
                    {fieldChartData.map((f, i) => (
                      <Cell key={i} fill={fieldColor(f.execRate)} />
                    ))}
                    <LabelList
                      dataKey="execRate"
                      position="right"
                      formatter={(v: unknown) =>
                        typeof v === "number" ? `${v.toFixed(0)}%` : ""
                      }
                      style={{ fontSize: 10, fill: "#78716c" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Exec rate color legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3 px-1">
            {[
              { label: "60%+", color: "bg-emerald-500" },
              { label: "40~60%", color: "bg-amber-400" },
              { label: "20~40%", color: "bg-orange-400" },
              { label: "~20%", color: "bg-rose-500" },
            ].map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-1.5 text-xs text-stone-500"
              >
                <span className={`w-3 h-3 rounded-sm ${item.color} shrink-0`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <ReadingGuide text="예산이 몰린 분야와 집행이 더딘 분야가 다를 수 있습니다. 특정 분야의 낮은 집행률은 해당 유형 사업의 절차적 병목(부지, 인허가, 위탁계약)을 시사합니다." />
      </section>
    </div>
  );
}
